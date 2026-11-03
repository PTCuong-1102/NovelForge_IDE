use crate::ai_bridge::mcp_server::{list_novelforge_mcp_tools, McpToolCallResult, McpToolSpec};
use crate::ai_bridge::rag_engine::RagSearchResult;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

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
    query: String,
    _entity_type: Option<String>,
) -> Result<Vec<RagSearchResult>, String> {
    Ok(vec![RagSearchResult {
        chunk_id: "chunk_linh_01".to_string(),
        entity_id: "char_linh_001".to_string(),
        title: "Lâm Vũ Linh".to_string(),
        entity_type: "character".to_string(),
        snippet: format!("Kết quả Hybrid Search (BM25 + sqlite-vec) cho truy vấn: {}", query),
        score: 0.94,
    }])
}
