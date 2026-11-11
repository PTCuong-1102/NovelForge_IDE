pub mod ai_bridge;
pub mod commands;
pub mod core_engine;
pub mod vcs;

use commands::{ai_cmd, fs_cmd, linter_cmd, lore_cmd, watch_cmd};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(watch_cmd::ProjectWatcher::default())
        .invoke_handler(tauri::generate_handler![
            fs_cmd::init_project_workspace,
            fs_cmd::sync_project_sqlite,
            fs_cmd::read_project_tree,
            fs_cmd::read_markdown_file,
            fs_cmd::write_markdown_file,
            fs_cmd::rename_markdown_file,
            fs_cmd::scan_project_identifiers,
            watch_cmd::start_project_watcher,
            watch_cmd::stop_project_watcher,
            lore_cmd::list_entities,
            lore_cmd::upsert_entity,
            lore_cmd::find_entity_usages,
            lore_cmd::refactor_rename_entity,
            linter_cmd::run_continuity_linter,
            linter_cmd::detect_implicit_entities,
            ai_cmd::mcp_execute_tool,
            ai_cmd::propose_inline_diff,
            ai_cmd::list_edit_proposals,
            ai_cmd::dismiss_edit_proposal,
            ai_cmd::search_lore_rag,
            vcs::snapshot::create_snapshot,
            vcs::snapshot::list_snapshots,
            vcs::snapshot::restore_snapshot,
            vcs::diff_engine::compute_prose_diff,
        ])
        .build(tauri::generate_context!());

    match app {
        Ok(app) => app.run(|_, _| {}),
        Err(e) => {
            eprintln!("Failed to initialize NovelForge IDE tauri application: {e}");
            std::process::exit(1);
        }
    }
}
