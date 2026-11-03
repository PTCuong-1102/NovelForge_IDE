use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentProcessStatus {
    pub agent_name: String, // "OpenCode" | "Cline" | "Antigravity" | "Ollama"
    pub connected: bool,
    pub pid: Option<u32>,
    pub active_task: Option<String>,
}

/// Manages subprocess CLI invocations for external agents (e.g. `opencode`, `ollama`).
pub fn check_cli_agent_availability(binary_name: &str) -> bool {
    Command::new("which")
        .arg(binary_name)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}
