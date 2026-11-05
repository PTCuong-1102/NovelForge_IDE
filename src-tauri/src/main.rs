// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;

fn main() {
    let args: Vec<String> = std::env::args().collect();

    // Embedded MCP stdio bridge: `novelforge-ide mcp [project_root]`
    // Used by external agents (Cline, Claude Desktop, OpenCode) as a stdio MCP server.
    if args.get(1).map(String::as_str) == Some("mcp") {
        let root = args
            .get(2)
            .map(PathBuf::from)
            .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));
        novelforge_ide_lib::ai_bridge::mcp_stdio::run_stdio(&root);
        return;
    }

    novelforge_ide_lib::run()
}
