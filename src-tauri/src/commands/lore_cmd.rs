use crate::core_engine::indexer::{init_sqlite_db, upsert_entity_record, LoreEntityRecord};
use crate::core_engine::refactor::{preview_entity_rename, RefactorPreviewItem};
use std::path::Path;

#[tauri::command]
pub async fn list_entities(project_root: String) -> Result<Vec<LoreEntityRecord>, String> {
    let db_path = Path::new(&project_root)
        .join(".novelforge")
        .join("index.sqlite");
    let conn = init_sqlite_db(&db_path).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, entity_type, title, aliases, file_path, metadata, content_hash, updated_at FROM entities ORDER BY title ASC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let aliases_str: String = row.get(3)?;
            let metadata_str: String = row.get(5)?;
            Ok(LoreEntityRecord {
                id: row.get(0)?,
                entity_type: row.get(1)?,
                title: row.get(2)?,
                aliases: serde_json::from_str(&aliases_str).unwrap_or_default(),
                file_path: row.get(4)?,
                metadata: serde_json::from_str(&metadata_str).unwrap_or(serde_json::Value::Null),
                content_hash: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for r in rows.flatten() {
        result.push(r);
    }
    Ok(result)
}

#[tauri::command]
pub async fn upsert_entity(project_root: String, record: LoreEntityRecord) -> Result<(), String> {
    let db_path = Path::new(&project_root)
        .join(".novelforge")
        .join("index.sqlite");
    let conn = init_sqlite_db(&db_path).map_err(|e| e.to_string())?;
    upsert_entity_record(&conn, &record).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn find_entity_usages(
    chapters: Vec<(String, String, Vec<String>)>,
    entity_name: String,
    aliases: Vec<String>,
) -> Result<Vec<RefactorPreviewItem>, String> {
    let alias_pairs: Vec<(String, String)> =
        aliases.into_iter().map(|a| (a.clone(), a)).collect();
    Ok(preview_entity_rename(
        &chapters,
        &entity_name,
        &entity_name,
        &alias_pairs,
    ))
}

#[tauri::command]
pub async fn refactor_rename_entity(
    chapters: Vec<(String, String, Vec<String>)>,
    old_name: String,
    new_name: String,
    alias_pairs: Vec<(String, String)>,
) -> Result<Vec<RefactorPreviewItem>, String> {
    Ok(preview_entity_rename(
        &chapters,
        &old_name,
        &new_name,
        &alias_pairs,
    ))
}
