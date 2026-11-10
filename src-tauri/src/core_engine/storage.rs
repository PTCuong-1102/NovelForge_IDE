use crate::ai_bridge::rag_engine::upsert_rag_chunk;
use crate::core_engine::indexer::{
    compute_content_hash, init_sqlite_db, replace_chapter_entity_mentions, upsert_entity_record,
    EntityMentionRecord, LoreEntityRecord,
};
use crate::core_engine::linter::{scan_implicit_entities, LoreCharacterSpec};
use crate::core_engine::parser::{
    parse_markdown_with_frontmatter, serialize_markdown_with_ordered_frontmatter, ParsedDocument,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectWorkspaceLayout {
    pub project_root: String,
    pub novelforge_dir: String,
    pub sqlite_db_path: String,
    pub config_path: String,
    pub manuscript_dir: String,
    pub lorebook_dir: String,
    pub timeline_path: String,
    pub exports_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceSyncSummary {
    pub entities_indexed: usize,
    pub chapters_indexed: usize,
    pub mentions_recorded: usize,
    pub rag_chunks_indexed: usize,
    pub sqlite_db_path: String,
}

/// Ensures the standard Local-First directory layout defined in `.docs/prd-technical-architecture.md` (Section 3.1)
/// exists on disk and initializes `.novelforge/index.sqlite`.
pub fn ensure_project_workspace(project_root: &Path) -> Result<ProjectWorkspaceLayout, String> {
    let novelforge_dir = project_root.join(".novelforge");
    let snapshots_dir = novelforge_dir.join("snapshots");
    let sqlite_db_path = novelforge_dir.join("index.sqlite");
    let config_path = novelforge_dir.join("config.json");
    let manuscript_dir = project_root.join("manuscript");
    let lorebook_dir = project_root.join("lorebook");
    let characters_dir = lorebook_dir.join("characters");
    let locations_dir = lorebook_dir.join("locations");
    let items_dir = lorebook_dir.join("items");
    let timeline_path = lorebook_dir.join("timeline.json");
    let exports_dir = project_root.join("exports");

    for dir in [
        &novelforge_dir,
        &snapshots_dir,
        &manuscript_dir,
        &lorebook_dir,
        &characters_dir,
        &locations_dir,
        &items_dir,
        &exports_dir,
    ] {
        std::fs::create_dir_all(dir)
            .map_err(|e| format!("Failed to create directory {}: {}", dir.display(), e))?;
    }

    if !config_path.exists() {
        let default_config = json!({
            "project_name": project_root.file_name().and_then(|s| s.to_str()).unwrap_or("NovelForge Project"),
            "version": "1.0.0",
            "linter": {
                "dead_character_check": true,
                "attribute_consistency_check": true,
                "pacing_repetition_threshold": 4
            },
            "rag": {
                "engine": "sqlite-vec",
                "embedding_dim": 768
            }
        });
        let _ = std::fs::write(
            &config_path,
            serde_json::to_string_pretty(&default_config).unwrap_or_default(),
        );
    }

    if !timeline_path.exists() {
        let default_timeline = json!({
            "calendar_system": "Gregorian",
            "events": []
        });
        let _ = std::fs::write(
            &timeline_path,
            serde_json::to_string_pretty(&default_timeline).unwrap_or_default(),
        );
    }

    let _conn = init_sqlite_db(&sqlite_db_path)
        .map_err(|e| format!("Failed to initialize SQLite database: {}", e))?;

    Ok(ProjectWorkspaceLayout {
        project_root: project_root.to_string_lossy().to_string(),
        novelforge_dir: novelforge_dir.to_string_lossy().to_string(),
        sqlite_db_path: sqlite_db_path.to_string_lossy().to_string(),
        config_path: config_path.to_string_lossy().to_string(),
        manuscript_dir: manuscript_dir.to_string_lossy().to_string(),
        lorebook_dir: lorebook_dir.to_string_lossy().to_string(),
        timeline_path: timeline_path.to_string_lossy().to_string(),
        exports_dir: exports_dir.to_string_lossy().to_string(),
    })
}

/// Reads a `.md` file from disk and parses its YAML frontmatter + Markdown AST losslessly.
pub fn load_markdown_document(file_path: &Path) -> Result<ParsedDocument, String> {
    let raw = std::fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read markdown file {}: {}", file_path.display(), e))?;
    Ok(parse_markdown_with_frontmatter(&raw))
}

/// Saves a `.md` file atomically using ordered YAML frontmatter + lossless Markdown body.
pub fn save_markdown_document(
    file_path: &Path,
    frontmatter: &HashMap<String, Value>,
    ordered_keys: &[String],
    body: &str,
) -> Result<String, String> {
    if let Some(parent) = file_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directory: {}", e))?;
    }
    let serialized = serialize_markdown_with_ordered_frontmatter(frontmatter, ordered_keys, body);
    std::fs::write(file_path, &serialized)
        .map_err(|e| format!("Failed to write markdown file {}: {}", file_path.display(), e))?;
    Ok(compute_content_hash(&serialized))
}

fn collect_markdown_files(dir: &Path, out: &mut Vec<PathBuf>) {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                collect_markdown_files(&path, out);
            } else if path.extension().and_then(|s| s.to_str()) == Some("md") {
                out.push(path);
            }
        }
    }
}

/// Extracts the lore profile fields the continuity linter compares against.
pub fn lore_attributes(frontmatter: &HashMap<String, Value>) -> HashMap<String, String> {
    let mut attributes = HashMap::new();
    for key in ["appearance", "personality", "faction", "role"] {
        if let Some(value) = frontmatter.get(key).and_then(|v| v.as_str()) {
            if !value.trim().is_empty() {
                attributes.insert(key.to_string(), value.to_string());
            }
        }
    }
    attributes
}

/// Scans `lorebook/` and `manuscript/` markdown files, synchronizing all entities,
/// implicit entity mentions, and 768-dim `sqlite-vec` RAG embeddings into `.novelforge/index.sqlite`.
pub fn sync_workspace_to_sqlite(project_root: &Path) -> Result<WorkspaceSyncSummary, String> {
    let layout = ensure_project_workspace(project_root)?;
    let db_path = Path::new(&layout.sqlite_db_path);
    let mut conn = init_sqlite_db(db_path).map_err(|e| e.to_string())?;

    let mut lore_files = Vec::new();
    collect_markdown_files(Path::new(&layout.lorebook_dir), &mut lore_files);

    let mut manuscript_files = Vec::new();
    collect_markdown_files(Path::new(&layout.manuscript_dir), &mut manuscript_files);

    let mut entities_indexed = 0usize;
    let mut chapters_indexed = 0usize;
    let mut mentions_recorded = 0usize;
    let mut rag_chunks_indexed = 0usize;
    let mut character_specs = Vec::new();
    let mut seen_entity_ids: HashSet<String> = HashSet::new();
    let mut seen_file_paths: HashSet<String> = HashSet::new();

    // The whole sync runs in one transaction: a failed scan never leaves a half-written index.
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // 1. Index Lorebook files (`characters/`, `locations/`, `items/`)
    for file_path in &lore_files {
        let Ok(raw) = std::fs::read_to_string(file_path) else {
            continue;
        };
        let parsed = parse_markdown_with_frontmatter(&raw);
        let rel_path = file_path
            .strip_prefix(project_root)
            .unwrap_or(file_path)
            .to_string_lossy()
            .to_string();

        let id = parsed
            .frontmatter
            .get("id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| {
                file_path
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("entity")
                    .to_string()
            });

        let entity_type = parsed
            .frontmatter
            .get("type")
            .or_else(|| parsed.frontmatter.get("entity_type"))
            .and_then(|v| v.as_str())
            .unwrap_or_else(|| {
                if rel_path.contains("locations") {
                    "location"
                } else if rel_path.contains("items") {
                    "item"
                } else {
                    "character"
                }
            })
            .to_string();

        let title = parsed
            .frontmatter
            .get("name")
            .or_else(|| parsed.frontmatter.get("title"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .or_else(|| parsed.headings.first().cloned())
            .unwrap_or_else(|| id.clone());

        let aliases: Vec<String> = parsed
            .frontmatter
            .get("aliases")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|item| item.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();

        seen_entity_ids.insert(id.clone());
        seen_file_paths.insert(rel_path.clone());

        let record = LoreEntityRecord {
            id: id.clone(),
            entity_type: entity_type.clone(),
            title: title.clone(),
            aliases: aliases.clone(),
            file_path: rel_path,
            metadata: serde_json::to_value(&parsed.frontmatter).unwrap_or(Value::Null),
            content_hash: compute_content_hash(&raw),
            updated_at: chrono::Utc::now().to_rfc3339(),
        };

        upsert_entity_record(&tx, &record).map_err(|e| e.to_string())?;
        entities_indexed += 1;

        // Index into `sqlite-vec` RAG store
        let chunk_text = if parsed.body.trim().is_empty() {
            title.clone()
        } else {
            parsed.body.clone()
        };
        upsert_rag_chunk(
            &tx,
            &format!("chunk_{}", id),
            &id,
            &title,
            &entity_type,
            &chunk_text,
            None,
        )
        .map_err(|e| e.to_string())?;
        rag_chunks_indexed += 1;

        character_specs.push(LoreCharacterSpec {
            id,
            name: title,
            aliases,
            status: parsed
                .frontmatter
                .get("status")
                .and_then(|v| v.as_str())
                .unwrap_or("alive")
                .to_string(),
            death_chapter_order: parsed
                .frontmatter
                .get("death_chapter_order")
                .and_then(|v| v.as_u64())
                .map(|n| n as u32),
            death_date: parsed
                .frontmatter
                .get("death_date")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            death_chapter_title: parsed
                .frontmatter
                .get("death_chapter_title")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            attributes: lore_attributes(&parsed.frontmatter),
        });
    }

    // 2. Index Manuscript chapters & build `entity_mentions` graph
    for file_path in &manuscript_files {
        let Ok(raw) = std::fs::read_to_string(file_path) else {
            continue;
        };
        let parsed = parse_markdown_with_frontmatter(&raw);
        let rel_path = file_path
            .strip_prefix(project_root)
            .unwrap_or(file_path)
            .to_string_lossy()
            .to_string();

        let chapter_id = parsed
            .frontmatter
            .get("id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| {
                file_path
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("chapter")
                    .to_string()
            });

        let title = parsed
            .frontmatter
            .get("title")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .or_else(|| parsed.headings.first().cloned())
            .unwrap_or_else(|| chapter_id.clone());

        seen_entity_ids.insert(chapter_id.clone());
        seen_file_paths.insert(rel_path.clone());

        let record = LoreEntityRecord {
            id: chapter_id.clone(),
            entity_type: "chapter".to_string(),
            title: title.clone(),
            aliases: Vec::new(),
            file_path: rel_path,
            metadata: serde_json::to_value(&parsed.frontmatter).unwrap_or(Value::Null),
            content_hash: compute_content_hash(&raw),
            updated_at: chrono::Utc::now().to_rfc3339(),
        };

        upsert_entity_record(&tx, &record).map_err(|e| e.to_string())?;
        chapters_indexed += 1;

        let spans = scan_implicit_entities(&parsed.paragraphs, &character_specs);
        let mention_records: Vec<EntityMentionRecord> = spans
            .into_iter()
            .map(|s| EntityMentionRecord {
                id: 0,
                source_chapter_id: chapter_id.clone(),
                target_entity_id: s.entity_id,
                paragraph_index: s.paragraph_index,
                char_offset: s.start_offset,
                context_snippet: parsed
                    .paragraphs
                    .get(s.paragraph_index)
                    .cloned()
                    .unwrap_or_default(),
            })
            .collect();

        replace_chapter_entity_mentions(&tx, &chapter_id, &mention_records)
            .map_err(|e| e.to_string())?;
        mentions_recorded += mention_records.len();
    }

    // 3. Prune rows whose source file disappeared from disk (or was renamed).
    let stale_rows: Vec<(String, String)> = {
        let mut stmt = tx
            .prepare("SELECT id, file_path FROM entities")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
            .map_err(|e| e.to_string())?;
        rows.flatten()
            .filter(|(id, file_path)| {
                !seen_entity_ids.contains(id) || !seen_file_paths.contains(file_path)
            })
            .collect()
    };
    for (id, _) in stale_rows {
        tx.execute("DELETE FROM entities WHERE id = ?1", rusqlite::params![&id])
            .map_err(|e| e.to_string())?;
        tx.execute(
            "DELETE FROM lore_embeddings_store WHERE entity_id = ?1",
            rusqlite::params![&id],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;

    Ok(WorkspaceSyncSummary {
        entities_indexed,
        chapters_indexed,
        mentions_recorded,
        rag_chunks_indexed,
        sqlite_db_path: layout.sqlite_db_path,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai_bridge::rag_engine::hybrid_search_lore_sqlite;
    use std::fs;

    #[test]
    fn sync_then_hybrid_search_finds_seeded_lore() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        let man = root.join("manuscript").join("act-01");
        let chars = root.join("lorebook").join("characters");
        fs::create_dir_all(&man).unwrap();
        fs::create_dir_all(&chars).unwrap();

        fs::write(
            chars.join("lam-vu-linh.md"),
            "---\nid: \"char_linh_001\"\ntype: \"character\"\ntitle: \"Lâm Vũ Linh\"\naliases: [\"Tiểu Linh\", \"Đặc vụ số 7\"]\nstatus: \"alive\"\n---\n\n# Hồ sơ\n\nCựu đặc vụ Aegis, chuyên giải mã tín hiệu lượng tử tại Bến Cảng Đông. Mưa axit không làm cô chùn bước.\n",
        )
        .unwrap();
        fs::write(
            man.join("ch-01.md"),
            "---\nid: \"ch_01\"\nact_id: \"act_01\"\norder: 1\ntitle: \"Mở đầu\"\nstatus: \"draft\"\nstory_date: \"02/10/2026\"\n---\n\nLâm Vũ Linh đứng giữa cơn mưa axit ở Bến Cảng Đông, tay siết chặt chiếc vali dữ liệu.\n",
        )
        .unwrap();

        let summary = sync_workspace_to_sqlite(root).unwrap();
        assert_eq!(summary.entities_indexed, 1, "one lore entity indexed");
        assert_eq!(summary.chapters_indexed, 1, "one chapter indexed");
        assert_eq!(summary.rag_chunks_indexed, 1, "one lore chunk indexed");

        let db = root.join(".novelforge").join("index.sqlite");
        let conn = init_sqlite_db(&db).unwrap();
        let hits = hybrid_search_lore_sqlite(&conn, "Lâm Vũ Linh", None, 5).unwrap();
        assert!(
            hits.iter().any(|h| h.entity_id == "char_linh_001"),
            "hybrid search must surface the seeded character, got: {hits:?}"
        );
    }

    #[test]
    fn sync_handles_id_change_and_prunes_deleted_files() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        let chars = root.join("lorebook/characters");
        fs::create_dir_all(&chars).unwrap();

        fs::write(
            chars.join("linh.md"),
            "---\nid: char_v1\ntitle: Linh\n---\nBody",
        )
        .unwrap();
        fs::write(
            chars.join("temp.md"),
            "---\nid: char_temp\ntitle: Temp\n---\nBody",
        )
        .unwrap();

        let s1 = sync_workspace_to_sqlite(root).unwrap();
        assert_eq!(s1.entities_indexed, 2);

        // The entity id changes and the second file disappears from disk.
        fs::write(
            chars.join("linh.md"),
            "---\nid: char_v2\ntitle: Linh\n---\nBody",
        )
        .unwrap();
        fs::remove_file(chars.join("temp.md")).unwrap();

        let s2 = sync_workspace_to_sqlite(root).unwrap();
        assert_eq!(s2.entities_indexed, 1);

        let db = root.join(".novelforge").join("index.sqlite");
        let conn = init_sqlite_db(&db).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM entities", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1, "orphaned entity rows must be pruned");
    }

    #[test]
    fn lore_attributes_carry_the_lore_profile_into_the_linter() {
        let raw = "---\nid: char_linh\ntype: character\ntitle: Lâm Vũ Linh\nappearance: Tóc ngắn ngang vai\npersonality: Lạnh lùng\nfaction: Aegis\nrole: Đặc vụ\n---\n\nBody";
        let parsed = parse_markdown_with_frontmatter(raw);
        let attributes = lore_attributes(&parsed.frontmatter);

        assert_eq!(
            attributes.get("appearance").map(|s| s.as_str()),
            Some("Tóc ngắn ngang vai")
        );
        assert_eq!(
            attributes.get("personality").map(|s| s.as_str()),
            Some("Lạnh lùng")
        );
        assert_eq!(attributes.get("faction").map(|s| s.as_str()), Some("Aegis"));
        assert_eq!(attributes.get("role").map(|s| s.as_str()), Some("Đặc vụ"));
    }
}

