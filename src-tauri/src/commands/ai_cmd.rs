use crate::ai_bridge::mcp_server::{list_novelforge_mcp_tools, McpToolCallResult, McpToolSpec};
use crate::ai_bridge::rag_engine::{hybrid_search_lore_sqlite, RagSearchResult};
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
