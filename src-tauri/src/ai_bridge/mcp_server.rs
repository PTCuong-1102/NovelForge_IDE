use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpToolSpec {
    pub name: String,
    pub description: String,
    pub input_schema: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpToolCallResult {
    pub tool_name: String,
    pub status: String,
    pub payload: Value,
}

/// Returns the list of MCP Tools exposed by the embedded NovelForge MCP Server
/// to external agents (Cline, Antigravity, OpenCode, Claude Desktop) as specified in PRD 3.3.1.
pub fn list_novelforge_mcp_tools() -> Vec<McpToolSpec> {
    vec![
        McpToolSpec {
            name: "novel_search_lore".to_string(),
            description:
                "Search character, location, and item profiles using Hybrid Search (BM25 + Vector)"
                    .to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string" },
                    "entity_type": { "type": "string", "enum": ["character", "location", "item", "all"] }
                },
                "required": ["query"]
            }),
        },
        McpToolSpec {
            name: "novel_get_chapter_context".to_string(),
            description:
                "Retrieve current chapter content along with preceding and succeeding chapter summaries"
                    .to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "chapter_id": { "type": "string" },
                    "window_size": { "type": "integer", "default": 1 }
                },
                "required": ["chapter_id"]
            }),
        },
        McpToolSpec {
            name: "novel_check_continuity".to_string(),
            description:
                "Run the NovelForge Continuity Linter on a draft passage to detect plot holes"
                    .to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "draft_text": { "type": "string" },
                    "chapter_id": { "type": "string" }
                },
                "required": ["draft_text", "chapter_id"]
            }),
        },
        McpToolSpec {
            name: "novel_propose_edit".to_string(),
            description:
                "Push an inline diff edit proposal directly into the NovelForge TipTap Editor"
                    .to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "file_path": { "type": "string" },
                    "start_line": { "type": "integer" },
                    "end_line": { "type": "integer" },
                    "new_content": { "type": "string" },
                    "rationale": { "type": "string" }
                },
                "required": ["file_path", "start_line", "end_line", "new_content", "rationale"]
            }),
        },
    ]
}
