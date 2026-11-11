//! Minimal but real MCP (Model Context Protocol) stdio server exposing the
//! NovelForge literature engine to external agents (Cline, Claude Desktop,
//! OpenCode). JSON-RPC 2.0 over stdio, no external crates.
//!
//! Run as: `novelforge-ide mcp [project_root]`
//! (defaults to the current working directory when no root is passed).

use crate::ai_bridge::mcp_server::list_novelforge_mcp_tools;
use crate::ai_bridge::rag_engine::hybrid_search_lore_sqlite;
use crate::core_engine::indexer::init_sqlite_db;
use crate::core_engine::linter::{check_chapter_continuity, LoreCharacterSpec};
use crate::core_engine::parser::parse_markdown_with_frontmatter;
use crate::core_engine::paths::canonical_within;
use serde_json::{json, Value};
use std::fs;
use std::io::{self, BufRead, BufWriter, Write};
use std::path::{Path, PathBuf};

pub fn run_stdio(project_root: &Path) {
    let stdin = io::stdin();
    let mut stdout = BufWriter::new(io::stdout());

    for line in stdin.lock().lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => break,
        };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Some(response) = handle_message(project_root, trimmed) {
            let _ = writeln!(stdout, "{}", response);
            let _ = stdout.flush();
        }
    }
}

fn json_response(id: Option<Value>, result: Value) -> Option<String> {
    id.map(|id| json!({"jsonrpc": "2.0", "id": id, "result": result}).to_string())
}

fn json_error(id: Option<Value>, code: i64, message: &str) -> Option<String> {
    id.map(|id| {
        json!({"jsonrpc": "2.0", "id": id, "error": {"code": code, "message": message}})
            .to_string()
    })
}

fn handle_message(root: &Path, line: &str) -> Option<String> {
    let msg: Value = match serde_json::from_str(line) {
        Ok(value) => value,
        Err(_) => return json_error(Some(Value::Null), -32700, "Parse error"),
    };
    let id = msg.get("id").cloned();
    let method = msg.get("method").and_then(|m| m.as_str()).unwrap_or("");

    match method {
        "initialize" => json_response(
            id,
            json!({
                "protocolVersion": "2024-11-05",
                "capabilities": { "tools": {} },
                "serverInfo": {
                    "name": "novelforge-mcp",
                    "version": env!("CARGO_PKG_VERSION")
                }
            }),
        ),
        // Notifications carry no id and expect no response.
        "notifications/initialized" | "initialized" => None,
        "ping" => json_response(id, json!({})),
        "tools/list" => json_response(
            id,
            json!({
                "tools": list_novelforge_mcp_tools()
                    .into_iter()
                    .map(|t| json!({
                        "name": t.name,
                        "description": t.description,
                        "inputSchema": t.input_schema,
                    }))
                    .collect::<Vec<_>>()
            }),
        ),
        "tools/call" => {
            let params = msg.get("params").cloned().unwrap_or(json!({}));
            let name = params
                .get("name")
                .and_then(|n| n.as_str())
                .unwrap_or("")
                .to_string();
            let args = params.get("arguments").cloned().unwrap_or(json!({}));
            let result = call_tool(root, &name, &args);
            let is_error = result.get("error").is_some();
            json_response(
                id,
                json!({
                    "content": [{ "type": "text", "text": result.to_string() }],
                    "isError": is_error,
                }),
            )
        }
        other => json_error(id, -32601, &format!("Method not found: {other}")),
    }
}

pub fn call_tool(root: &Path, name: &str, args: &Value) -> Value {
    match name {
        "novel_search_lore" => tool_search_lore(root, args),
        "novel_get_chapter_context" => tool_chapter_context(root, args),
        "novel_check_continuity" => tool_check_continuity(root, args),
        "novel_propose_edit" => tool_propose_edit(root, args),
        other => json!({ "error": format!("Unknown tool: {other}") }),
    }
}

fn lore_db_path(root: &Path) -> PathBuf {
    root.join(".novelforge").join("index.sqlite")
}

fn tool_search_lore(root: &Path, args: &Value) -> Value {
    let query = args.get("query").and_then(|q| q.as_str()).unwrap_or("");
    if query.trim().is_empty() {
        return json!({ "error": "query must not be empty" });
    }
    let entity_type = args
        .get("entity_type")
        .and_then(|q| q.as_str())
        .filter(|s| *s != "all");

    let db = lore_db_path(root);
    let conn = match init_sqlite_db(&db) {
        Ok(c) => c,
        Err(e) => return json!({ "error": format!("Cannot open lore index {:?}: {}", db, e) }),
    };
    match hybrid_search_lore_sqlite(&conn, query, entity_type, 5) {
        Ok(results) => json!({ "results": results }),
        Err(e) => json!({ "error": e.to_string() }),
    }
}

struct ChapterRecord {
    id: String,
    title: String,
    act_id: String,
    order: i64,
    story_date: String,
    is_flashback: bool,
    body: String,
    path: PathBuf,
}

fn load_chapters(root: &Path) -> Vec<ChapterRecord> {
    fn walk(dir: &Path, out: &mut Vec<PathBuf>) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    walk(&path, out);
                } else if path.extension().map_or(false, |e| e == "md") {
                    out.push(path);
                }
            }
        }
    }

    let mut files = Vec::new();
    walk(&root.join("manuscript"), &mut files);

    let mut chapters = Vec::new();
    for file in files {
        let Ok(raw) = fs::read_to_string(&file) else {
            continue;
        };
        let parsed = parse_markdown_with_frontmatter(&raw);
        let fm = &parsed.frontmatter;
        let id = fm
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if id.is_empty() {
            continue;
        }
        chapters.push(ChapterRecord {
            id,
            title: fm
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("Untitled")
                .to_string(),
            act_id: fm
                .get("act_id")
                .and_then(|v| v.as_str())
                .unwrap_or("act_01")
                .to_string(),
            order: fm.get("order").and_then(|v| v.as_i64()).unwrap_or(999),
            story_date: fm
                .get("story_date")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            is_flashback: fm
                .get("is_flashback")
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            body: parsed.body.trim().to_string(),
            path: file,
        });
    }

    chapters.sort_by(|a, b| {
        a.act_id
            .cmp(&b.act_id)
            .then(a.order.cmp(&b.order))
            .then(a.path.cmp(&b.path))
    });
    chapters
}

fn truncate(s: &str, max_chars: usize) -> String {
    if s.chars().count() <= max_chars {
        return s.to_string();
    }
    s.chars().take(max_chars).collect::<String>() + "…"
}

fn chapter_summary(c: &ChapterRecord) -> Value {
    json!({
        "id": c.id,
        "title": c.title,
        "act_id": c.act_id,
        "order": c.order,
        "path": c.path.to_string_lossy(),
        "excerpt": truncate(&c.body, 400),
    })
}

fn tool_chapter_context(root: &Path, args: &Value) -> Value {
    let chapter_id = match args.get("chapter_id").and_then(|c| c.as_str()) {
        Some(id) if !id.trim().is_empty() => id,
        _ => return json!({ "error": "chapter_id must not be empty" }),
    };
    let window = args
        .get("window_size")
        .and_then(|w| w.as_u64())
        .unwrap_or(1)
        .min(5) as usize;

    let chapters = load_chapters(root);
    let Some(idx) = chapters.iter().position(|c| c.id == chapter_id) else {
        return json!({ "error": format!("chapter not found: {chapter_id}") });
    };

    let current = &chapters[idx];
    let before: Vec<Value> = chapters[..idx]
        .iter()
        .rev()
        .take(window)
        .rev()
        .map(chapter_summary)
        .collect();
    let after: Vec<Value> = chapters[idx + 1..]
        .iter()
        .take(window)
        .map(chapter_summary)
        .collect();

    json!({
        "current": {
            "id": current.id,
            "title": current.title,
            "act_id": current.act_id,
            "order": current.order,
            "story_date": current.story_date,
            "is_flashback": current.is_flashback,
            "path": current.path.to_string_lossy(),
            "body": truncate(&current.body, 8000),
        },
        "before": before,
        "after": after,
    })
}

fn load_character_specs(root: &Path) -> Vec<LoreCharacterSpec> {
    let mut specs = Vec::new();
    let chars_dir = root.join("lorebook").join("characters");
    let Ok(entries) = fs::read_dir(&chars_dir) else {
        return specs;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().map_or(true, |e| e != "md") {
            continue;
        }
        let Ok(raw) = fs::read_to_string(&path) else {
            continue;
        };
        let parsed = parse_markdown_with_frontmatter(&raw);
        let fm = &parsed.frontmatter;
        let name = fm
            .get("title")
            .or_else(|| fm.get("name"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if name.is_empty() {
            continue;
        }
        let aliases = fm
            .get("aliases")
            .and_then(|v| v.as_array())
            .map(|a| {
                a.iter()
                    .filter_map(|x| x.as_str().map(str::to_string))
                    .collect()
            })
            .unwrap_or_default();
        let status = fm
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("alive")
            .to_string();
        let death_chapter_order = fm
            .get("death_chapter_order")
            .and_then(|v| v.as_u64())
            .map(|n| n as u32);
        let death_date = fm.get("death_date").and_then(|v| v.as_str()).map(str::to_string);
        let death_chapter_title = fm
            .get("death_chapter_title")
            .and_then(|v| v.as_str())
            .map(str::to_string);
        let attributes = crate::core_engine::storage::lore_attributes(fm);
        specs.push(LoreCharacterSpec {
            id: fm
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or(&name)
                .to_string(),
            name,
            aliases,
            status,
            death_chapter_order,
            death_date,
            death_chapter_title,
            attributes,
        });
    }
    specs
}

fn tool_check_continuity(root: &Path, args: &Value) -> Value {
    let draft_text = match args.get("draft_text").and_then(|d| d.as_str()) {
        Some(t) if !t.trim().is_empty() => t,
        _ => return json!({ "error": "draft_text must not be empty" }),
    };
    let chapter_id = args
        .get("chapter_id")
        .and_then(|c| c.as_str())
        .unwrap_or("");

    let chapters = load_chapters(root);
    let record = chapters.iter().find(|c| c.id == chapter_id);
    let chapter_order = record.map(|r| r.order.max(0) as u32).unwrap_or(1);
    let is_flashback = record.map(|r| r.is_flashback).unwrap_or(false);
    let chapter_date = record.map(|r| r.story_date.clone()).unwrap_or_else(|| "unknown".to_string());

    let paragraphs: Vec<String> = draft_text
        .replace("\r\n", "\n")
        .split("\n\n")
        .map(|p| p.trim().trim_start_matches('#').trim().to_string())
        .filter(|p| !p.is_empty())
        .collect();

    let specs = load_character_specs(root);
    let diagnostics = check_chapter_continuity(
        chapter_order,
        is_flashback,
        &chapter_date,
        &paragraphs,
        &specs,
    );

    json!({
        "chapter_id": chapter_id,
        "chapter_order": chapter_order,
        "characters_indexed": specs.len(),
        "diagnostics": diagnostics,
    })
}

fn tool_propose_edit(root: &Path, args: &Value) -> Value {
    let file_rel = match args.get("file_path").and_then(|f| f.as_str()) {
        Some(f) if !f.trim().is_empty() => f,
        _ => return json!({ "error": "file_path must not be empty" }),
    };
    let start_line = args.get("start_line").and_then(|s| s.as_u64()).unwrap_or(0) as usize;
    let end_line = args.get("end_line").and_then(|s| s.as_u64()).unwrap_or(0) as usize;
    let new_content = args
        .get("new_content")
        .and_then(|n| n.as_str())
        .unwrap_or("");
    let rationale = args
        .get("rationale")
        .and_then(|n| n.as_str())
        .unwrap_or("");

    if start_line == 0 || end_line < start_line {
        return json!({ "error": "start_line must be >= 1 and end_line >= start_line" });
    }

    let safe_path = match canonical_within(root, Path::new(file_rel)) {
        Ok(p) => p,
        Err(e) => return json!({ "error": format!("Path rejected: {e}") }),
    };

    // Proposals are only allowed for manuscript/lorebook markdown files.
    let canonical_root = root.canonicalize().unwrap_or_else(|_| root.to_path_buf());
    let rel = match safe_path.strip_prefix(&canonical_root) {
        Ok(p) => p.to_path_buf(),
        Err(_) => return json!({ "error": format!("Path rejected: {file_rel} is outside the project root") }),
    };
    let rel_str = rel.to_string_lossy().replace('\\', "/");
    if !(rel_str.starts_with("manuscript/") || rel_str.starts_with("lorebook/"))
        || !rel_str.ends_with(".md")
    {
        return json!({ "error": "novel_propose_edit only permits markdown files under manuscript/ or lorebook/" });
    }

    let original = match fs::read_to_string(&safe_path) {
        Ok(c) => c,
        Err(e) => return json!({ "error": format!("Cannot read {file_rel}: {e}") }),
    };

    let lines: Vec<&str> = original.lines().collect();
    if start_line > lines.len() {
        return json!({ "error": format!("start_line {start_line} exceeds file length ({})", lines.len()) });
    }
    let end = end_line.min(lines.len());
    let original_text = lines[start_line - 1..end].join("\n");

    let proposal_id = format!(
        "prop-{}",
        chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)
    );
    let proposal = json!({
        "id": proposal_id,
        "file_path": rel_str,
        "start_line": start_line,
        "end_line": end,
        "original_text": original_text,
        "new_content": new_content,
        "rationale": rationale,
        "created_at": chrono::Utc::now().to_rfc3339(),
        "status": "proposed",
    });

    let proposals_dir = root.join(".novelforge").join("proposals");
    if let Err(e) = fs::create_dir_all(&proposals_dir) {
        return json!({ "error": format!("Cannot create {}: {e}", proposals_dir.display()) });
    }
    let proposal_path = proposals_dir.join(format!("{proposal_id}.json"));
    if let Err(e) = fs::write(&proposal_path, proposal.to_string()) {
        return json!({ "error": format!("Cannot write proposal: {e}") });
    }

    json!({
        "status": "proposed",
        "proposal_id": proposal_id,
        "proposal_file": proposal_path.to_string_lossy(),
        "preview": {
            "before": original_text,
            "after": new_content,
        },
        "note": "Proposal stored under .novelforge/proposals/. Apply it manually or via the IDE; the file was NOT modified.",
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn propose_edit_only_accepts_manuscript_and_lorebook_markdown() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::create_dir_all(root.join("manuscript/act-01")).unwrap();
        std::fs::write(root.join("notes.txt"), "secret\n").unwrap();
        std::fs::write(root.join("manuscript/act-01/ch-01.md"), "Dong\n").unwrap();

        let outside = tool_propose_edit(
            root,
            &json!({ "file_path": "notes.txt", "start_line": 1, "end_line": 1, "new_content": "x" }),
        );
        assert_eq!(
            outside.get("error").and_then(|e| e.as_str()),
            Some("novel_propose_edit only permits markdown files under manuscript/ or lorebook/")
        );

        let allowed = tool_propose_edit(
            root,
            &json!({
                "file_path": "manuscript/act-01/ch-01.md",
                "start_line": 1,
                "end_line": 1,
                "new_content": "Dong moi"
            }),
        );
        assert_eq!(allowed.get("status").and_then(|s| s.as_str()), Some("proposed"));
    }

    #[test]
    fn malformed_json_returns_a_parse_error() {
        let dir = tempfile::tempdir().unwrap();
        let response =
            handle_message(dir.path(), "{bad json").expect("a JSON-RPC error response");
        let parsed: Value = serde_json::from_str(&response).unwrap();
        assert_eq!(
            parsed
                .get("error")
                .and_then(|e| e.get("code"))
                .and_then(|c| c.as_i64()),
            Some(-32700),
            "a malformed request must answer with the JSON-RPC parse error code"
        );
    }

    #[test]
    fn check_continuity_splits_crlf_drafts_into_paragraphs() {
        let dir = tempfile::tempdir().unwrap();
        let chars = dir.path().join("lorebook").join("characters");
        std::fs::create_dir_all(&chars).unwrap();
        std::fs::write(
            chars.join("khanh.md"),
            "---\nid: char_khanh\ntype: character\ntitle: Chỉ huy Khánh\nstatus: dead\ndeath_chapter_order: 0\ndeath_chapter_title: Chương 1\n---\n\nHồ sơ.",
        )
        .unwrap();

        let args = json!({
            "draft_text": "Chỉ huy Khánh bước ra.\r\n\r\n[Hồi tưởng] Chỉ huy Khánh quay lại.",
            "chapter_id": "ch_02"
        });
        let result = tool_check_continuity(dir.path(), &args);
        let diagnostics = result
            .get("diagnostics")
            .and_then(|d| d.as_array())
            .cloned()
            .unwrap_or_default();

        assert!(
            diagnostics.iter().any(|d| d.get("rule_id").and_then(|r| r.as_str())
                == Some("DEAD_CHARACTER")),
            "a CRLF draft must be split into paragraphs before linting"
        );
    }
}
