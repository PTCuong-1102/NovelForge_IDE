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
/// matching the schema defined in `.docs/prd-technical-architecture.md` (Section 4),
/// including `entities`, `entity_mentions`, and `sqlite-vec` 768-dim vector storage.
pub fn init_sqlite_db(db_path: &Path) -> Result<Connection> {
    if let Some(parent) = db_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let conn = Connection::open(db_path)?;

    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

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

        CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type);

        CREATE TABLE IF NOT EXISTS entity_mentions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_chapter_id TEXT NOT NULL,
            target_entity_id TEXT NOT NULL,
            paragraph_index INTEGER NOT NULL,
            char_offset INTEGER NOT NULL,
            context_snippet TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_mentions_target ON entity_mentions(target_entity_id);
        CREATE INDEX IF NOT EXISTS idx_mentions_chapter ON entity_mentions(source_chapter_id);

        CREATE TABLE IF NOT EXISTS lore_embeddings_store (
            chunk_id TEXT PRIMARY KEY,
            entity_id TEXT NOT NULL,
            title TEXT NOT NULL DEFAULT '',
            entity_type TEXT NOT NULL DEFAULT 'character',
            chunk_text TEXT NOT NULL,
            embedding_blob BLOB NOT NULL,
            embedding_dim INTEGER NOT NULL DEFAULT 768,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_embeddings_entity_type ON lore_embeddings_store(entity_type);
        ",
    )?;

    // Attempt to initialize native `sqlite-vec` virtual table if `vec0` module is loaded in runtime
    let _ = conn.execute_batch(
        "CREATE VIRTUAL TABLE IF NOT EXISTS lore_embeddings USING vec0(
            chunk_id TEXT PRIMARY KEY,
            entity_id TEXT,
            embedding FLOAT[768]
        );",
    );

    Ok(conn)
}

/// Checks whether the `sqlite-vec` `vec0` virtual table is active on this connection.
pub fn is_sqlite_vec_virtual_table_active(conn: &Connection) -> bool {
    conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='lore_embeddings'")
        .and_then(|mut s| s.exists([]))
        .unwrap_or(false)
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

/// Replaces all recorded entity mentions for a specific chapter (`source_chapter_id`)
/// and inserts the newly scanned mentions in a single transaction.
pub fn replace_chapter_entity_mentions(
    conn: &Connection,
    source_chapter_id: &str,
    mentions: &[EntityMentionRecord],
) -> Result<()> {
    conn.execute(
        "DELETE FROM entity_mentions WHERE source_chapter_id = ?1",
        params![source_chapter_id],
    )?;

    let mut stmt = conn.prepare(
        "INSERT INTO entity_mentions (source_chapter_id, target_entity_id, paragraph_index, char_offset, context_snippet)
         VALUES (?1, ?2, ?3, ?4, ?5)",
    )?;

    for m in mentions {
        stmt.execute(params![
            source_chapter_id,
            m.target_entity_id,
            m.paragraph_index as i64,
            m.char_offset as i64,
            m.context_snippet,
        ])?;
    }

    Ok(())
}

/// Queries all occurrences of a target entity across the manuscript (`entity_mentions`).
pub fn query_entity_mentions(
    conn: &Connection,
    target_entity_id: &str,
) -> Result<Vec<EntityMentionRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, source_chapter_id, target_entity_id, paragraph_index, char_offset, COALESCE(context_snippet, '')
         FROM entity_mentions
         WHERE target_entity_id = ?1
         ORDER BY source_chapter_id ASC, paragraph_index ASC, char_offset ASC",
    )?;

    let rows = stmt.query_map(params![target_entity_id], |row| {
        Ok(EntityMentionRecord {
            id: row.get(0)?,
            source_chapter_id: row.get(1)?,
            target_entity_id: row.get(2)?,
            paragraph_index: row.get::<_, i64>(3)? as usize,
            char_offset: row.get::<_, i64>(4)? as usize,
            context_snippet: row.get(5)?,
        })
    })?;

    let mut out = Vec::new();
    for r in rows.flatten() {
        out.push(r);
    }
    Ok(out)
}
