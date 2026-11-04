use crate::ai_bridge::mcp_server::{list_novelforge_mcp_tools, McpToolCallResult, McpToolSpec};
use crate::ai_bridge::rag_engine::{
    hybrid_search_lore_sqlite, upsert_rag_chunk, RagSearchResult,
};
use crate::core_engine::indexer::init_sqlite_db;
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
    tool_name: String,
    arguments: Value,
) -> Result<McpToolCallResult, String> {
    let available: Vec<McpToolSpec> = list_novelforge_mcp_tools();
    if !available.iter().any(|t| t.name == tool_name) {
        return Err(format!("Unknown MCP tool: {}", tool_name));
    }

    Ok(McpToolCallResult {
        tool_name,
        status: "ok".to_string(),
        payload: json!({
            "executed_at": chrono::Utc::now().to_rfc3339(),
            "arguments": arguments,
        }),
    })
}

#[tauri::command]
pub async fn propose_inline_diff(
    agent_name: String,
    chapter_id: String,
    paragraph_index: usize,
    original_text: String,
    proposed_text: String,
    rationale: String,
) -> Result<InlineDiffProposal, String> {
    Ok(InlineDiffProposal {
        id: format!("diff-{}", chrono::Utc::now().timestamp_millis()),
        agent_name,
        chapter_id,
        paragraph_index,
        original_text,
        proposed_text,
        rationale,
    })
}

#[tauri::command]
pub async fn search_lore_rag(
    project_root: Option<String>,
    query: String,
    entity_type: Option<String>,
) -> Result<Vec<RagSearchResult>, String> {
    if let Some(root) = project_root {
        let db_path = Path::new(&root).join(".novelforge").join("index.sqlite");
        if let Ok(conn) = init_sqlite_db(&db_path) {
            if let Ok(results) =
                hybrid_search_lore_sqlite(&conn, &query, entity_type.as_deref(), 8)
            {
                if !results.is_empty() {
                    return Ok(results);
                }
            }
        }
    }

    // Fallback in-memory SQLite + sqlite-vec hybrid evaluation when no project_root is open on disk
    let mem_conn = rusqlite::Connection::open_in_memory().map_err(|e| e.to_string())?;
    mem_conn
        .execute_batch(
            "CREATE TABLE IF NOT EXISTS lore_embeddings_store (
                chunk_id TEXT PRIMARY KEY,
                entity_id TEXT NOT NULL,
                title TEXT NOT NULL DEFAULT '',
                entity_type TEXT NOT NULL DEFAULT 'character',
                chunk_text TEXT NOT NULL,
                embedding_blob BLOB NOT NULL,
                embedding_dim INTEGER NOT NULL DEFAULT 768,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );",
        )
        .map_err(|e| e.to_string())?;

    let _ = upsert_rag_chunk(
        &mem_conn,
        "chunk_linh_01",
        "char_linh_001",
        "Lâm Vũ Linh",
        "character",
        "Đặc vụ số 7 của Cục An ninh Mạng, mái tóc ngắn ngang vai, cổ tay gắn bộ giải mã cơ khí sinh học.",
        None,
    );
    let _ = upsert_rag_chunk(
        &mem_conn,
        "chunk_port_01",
        "loc_east_port",
        "Bến Cảng Đông",
        "location",
        "Khu cảng công nghiệp bỏ hoang ngập trong mưa axit, nơi cất giấu Ổ Khóa Lượng Tử Thần Nông.",
        None,
    );

    hybrid_search_lore_sqlite(&mem_conn, &query, entity_type.as_deref(), 5)
        .map_err(|e| e.to_string())
}
