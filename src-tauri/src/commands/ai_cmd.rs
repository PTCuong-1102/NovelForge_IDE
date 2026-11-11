use crate::ai_bridge::mcp_server::{list_novelforge_mcp_tools, McpToolCallResult, McpToolSpec};
use crate::ai_bridge::rag_engine::{hybrid_search_lore_sqlite, RagSearchResult};
use crate::core_engine::indexer::init_sqlite_db;
use crate::core_engine::paths::canonical_within;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InlineDiffProposal {
    pub id: String,
    pub agent_name: String,
    pub chapter_id: String,
    pub paragraph_index: usize,
    pub original_text: String,
    pub proposed_text: String,
    pub rationale: String,
}

#[tauri::command]
pub async fn mcp_execute_tool(
    project_root: Option<String>,
    tool_name: String,
    arguments: Value,
) -> Result<McpToolCallResult, String> {
    let available: Vec<McpToolSpec> = list_novelforge_mcp_tools();
    if !available.iter().any(|t| t.name == tool_name) {
        return Err(format!("Unknown MCP tool: {}", tool_name));
    }

    let root = match project_root {
        Some(r) if !r.trim().is_empty() => std::path::PathBuf::from(r),
        _ => std::env::current_dir().map_err(|e| e.to_string())?,
    };

    let payload = crate::ai_bridge::mcp_stdio::call_tool(&root, &tool_name, &arguments);
    let status = if payload.get("error").is_some() {
        "error"
    } else {
        "ok"
    };

    Ok(McpToolCallResult {
        tool_name,
        status: status.to_string(),
        payload,
    })
}

#[tauri::command]
pub async fn propose_inline_diff(
    project_root: Option<String>,
    agent_name: String,
    chapter_id: String,
    paragraph_index: usize,
    original_text: String,
    proposed_text: String,
    rationale: String,
) -> Result<InlineDiffProposal, String> {
    let proposal = InlineDiffProposal {
        id: format!("diff-{}", chrono::Utc::now().timestamp_millis()),
        agent_name,
        chapter_id,
        paragraph_index,
        original_text,
        proposed_text,
        rationale,
    };

    // Persist the proposal so it survives restarts and can be reviewed later.
    if let Some(root) = project_root {
        let dir = Path::new(&root).join(".novelforge").join("proposals");
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("Cannot create {}: {e}", dir.display()))?;
        let path = dir.join(format!("{}.json", proposal.id));
        let body = json!({
            "id": proposal.id,
            "agent_name": proposal.agent_name,
            "chapter_id": proposal.chapter_id,
            "paragraph_index": proposal.paragraph_index,
            "original_text": proposal.original_text,
            "proposed_text": proposal.proposed_text,
            "rationale": proposal.rationale,
            "created_at": chrono::Utc::now().to_rfc3339(),
            "status": "proposed",
        });
        std::fs::write(&path, body.to_string()).map_err(|e| e.to_string())?;
    }

    Ok(proposal)
}

#[tauri::command]
pub async fn list_edit_proposals(project_root: String) -> Result<Vec<Value>, String> {
    let dir = Path::new(&project_root)
        .join(".novelforge")
        .join("proposals");
    let mut proposals = Vec::new();

    let Ok(entries) = std::fs::read_dir(&dir) else {
        return Ok(proposals);
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let Ok(raw) = std::fs::read_to_string(&path) else {
            continue;
        };
        let Ok(value) = serde_json::from_str::<Value>(&raw) else {
            continue;
        };
        if value.get("status").and_then(|s| s.as_str()) != Some("proposed") {
            continue;
        }
        proposals.push(value);
    }

    proposals.sort_by(|a, b| {
        a.get("created_at")
            .and_then(|c| c.as_str())
            .unwrap_or("")
            .cmp(b.get("created_at").and_then(|c| c.as_str()).unwrap_or(""))
    });

    Ok(proposals)
}

#[tauri::command]
pub async fn dismiss_edit_proposal(
    project_root: String,
    proposal_id: String,
) -> Result<(), String> {
    // The id becomes a file name: only a plain identifier is accepted.
    if proposal_id.is_empty()
        || !proposal_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err(format!("Invalid proposal_id: {proposal_id}"));
    }

    let dir = Path::new(&project_root).join(".novelforge").join("proposals");
    if !dir.exists() {
        return Err(format!("Proposal not found: {proposal_id}"));
    }
    let path = canonical_within(&dir, Path::new(&format!("{proposal_id}.json")))
        .map_err(|e| format!("Invalid proposal_id: {e}"))?;
    if !path.exists() {
        return Err(format!("Proposal not found: {proposal_id}"));
    }

    let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut value: Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    if let Some(obj) = value.as_object_mut() {
        obj.insert("status".to_string(), Value::String("resolved".to_string()));
    }
    std::fs::write(&path, value.to_string()).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn search_lore_rag(
    project_root: Option<String>,
    query: String,
    entity_type: Option<String>,
) -> Result<Vec<RagSearchResult>, String> {
    // No silent fake data: a project (or the MCP stdio bridge) is required.
    let root = project_root.ok_or_else(|| {
        "search_lore_rag requires a project_root. Open a project in the desktop app, or use the stdio MCP bridge: `novelforge-ide mcp [project_root]`.".to_string()
    })?;
    let db_path = Path::new(&root).join(".novelforge").join("index.sqlite");
    let conn = init_sqlite_db(&db_path).map_err(|e| e.to_string())?;
    hybrid_search_lore_sqlite(&conn, &query, entity_type.as_deref(), 8)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn dismiss_edit_proposal_marks_the_proposal_resolved() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().to_string_lossy().to_string();
        let proposals = dir.path().join(".novelforge").join("proposals");
        std::fs::create_dir_all(&proposals).unwrap();
        std::fs::write(
            proposals.join("prop-1.json"),
            r#"{"id":"prop-1","status":"proposed"}"#,
        )
        .unwrap();

        dismiss_edit_proposal(root, "prop-1".to_string()).await.unwrap();

        let raw = std::fs::read_to_string(proposals.join("prop-1.json")).unwrap();
        let value: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(
            value.get("status").and_then(|s| s.as_str()),
            Some("resolved")
        );
    }

    #[tokio::test]
    async fn dismiss_edit_proposal_rejects_path_traversal() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().to_string_lossy().to_string();
        let proposals = dir.path().join(".novelforge").join("proposals");
        std::fs::create_dir_all(&proposals).unwrap();
        // A file outside the proposals directory must never be touched.
        std::fs::write(dir.path().join("escaped.json"), "ORIGINAL").unwrap();

        for evil in ["../../escaped", "..\\..\\escaped", "sub/dir", ".."] {
            let err = dismiss_edit_proposal(root.clone(), evil.to_string())
                .await
                .unwrap_err();
            assert!(
                err.contains("proposal_id"),
                "a traversing id must be rejected, got: {err}"
            );
        }

        assert_eq!(
            std::fs::read_to_string(dir.path().join("escaped.json")).unwrap(),
            "ORIGINAL",
            "no file outside the proposals directory may be touched"
        );
    }
}
