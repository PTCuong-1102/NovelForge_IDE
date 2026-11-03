use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoreEntityRecord {
    pub id: String,
    pub entity_type: String,
    pub title: String,
    pub aliases: Vec<String>,
    pub file_path: String,
    pub metadata: serde_json::Value,
    pub content_hash: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityMentionRecord {
    pub id: i64,
    pub source_chapter_id: String,
    pub target_entity_id: String,
    pub paragraph_index: usize,
    pub char_offset: usize,
    pub context_snippet: String,
}

/// Initializes the embedded SQLite database at `.novelforge/index.sqlite`
/// matching the exact schema defined in `.docs/prd-technical-architecture.md` (Section 4).
pub fn init_sqlite_db(db_path: &Path) -> Result<Connection> {
    if let Some(parent) = db_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let conn = Connection::open(db_path)?;

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS entities (
            id TEXT PRIMARY KEY,
            entity_type TEXT NOT NULL,
            title TEXT NOT NULL,
            aliases JSON,
            file_path TEXT UNIQUE NOT NULL,
            metadata JSON,
            content_hash TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS entity_mentions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_chapter_id TEXT NOT NULL,
            target_entity_id TEXT NOT NULL,
            paragraph_index INTEGER NOT NULL,
            char_offset INTEGER NOT NULL,
            context_snippet TEXT,
            FOREIGN KEY(source_chapter_id) REFERENCES entities(id),
            FOREIGN KEY(target_entity_id) REFERENCES entities(id)
        );

        CREATE TABLE IF NOT EXISTS lore_embeddings_fallback (
            chunk_id TEXT PRIMARY KEY,
            entity_id TEXT NOT NULL,
            chunk_text TEXT NOT NULL,
            embedding_json TEXT NOT NULL
        );
        ",
    )?;

    Ok(conn)
}

pub fn compute_content_hash(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub fn upsert_entity_record(conn: &Connection, record: &LoreEntityRecord) -> Result<()> {
    let aliases_json = serde_json::to_string(&record.aliases).unwrap_or_else(|_| "[]".to_string());
    let metadata_json =
        serde_json::to_string(&record.metadata).unwrap_or_else(|_| "{}".to_string());

    conn.execute(
        "INSERT INTO entities (id, entity_type, title, aliases, file_path, metadata, content_hash, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET
            entity_type = excluded.entity_type,
            title = excluded.title,
            aliases = excluded.aliases,
            file_path = excluded.file_path,
            metadata = excluded.metadata,
            content_hash = excluded.content_hash,
            updated_at = CURRENT_TIMESTAMP",
        params![
            record.id,
            record.entity_type,
            record.title,
            aliases_json,
            record.file_path,
            metadata_json,
            record.content_hash,
        ],
    )?;
    Ok(())
}
