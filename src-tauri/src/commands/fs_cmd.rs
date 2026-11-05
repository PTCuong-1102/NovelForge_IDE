use crate::core_engine::parser::{
    parse_markdown_with_frontmatter, serialize_markdown_with_frontmatter, ParsedDocument,
};
use crate::core_engine::paths::canonical_within;
use crate::core_engine::storage::{
    ensure_project_workspace, sync_workspace_to_sqlite, ProjectWorkspaceLayout,
    WorkspaceSyncSummary,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTreeNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Vec<FileTreeNode>,
}

fn scan_dir_recursive(dir_path: &Path, count: &mut usize) -> Result<Vec<FileTreeNode>, String> {
    if *count > 5000 {
        return Err("PROJECT_TOO_LARGE".to_string());
    }

    let mut entries = Vec::new();
    if let Ok(read_dir) = std::fs::read_dir(dir_path) {
        for entry in read_dir.flatten() {
            *count += 1;
            if *count > 5000 {
                return Err("PROJECT_TOO_LARGE".to_string());
            }

            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            // Skip hidden folders and common heavy build folders
            if name.starts_with('.') && name != ".novelforge" {
                continue;
            }
            if name == "node_modules" || name == "target" || name == "dist" || name == "out" {
                continue;
            }

            let is_dir = path.is_dir();
            let children = if is_dir {
                scan_dir_recursive(&path, count)?
            } else {
                Vec::new()
            };

            entries.push(FileTreeNode {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir,
                children,
            });
        }
    }
    entries.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name)));
    Ok(entries)
}

#[tauri::command]
pub async fn init_project_workspace(
    project_root: String,
) -> Result<ProjectWorkspaceLayout, String> {
    ensure_project_workspace(Path::new(&project_root))
}

#[tauri::command]
pub async fn sync_project_sqlite(project_root: String) -> Result<WorkspaceSyncSummary, String> {
    sync_workspace_to_sqlite(Path::new(&project_root))
}

#[tauri::command]
pub async fn read_project_tree(project_root: String) -> Result<Vec<FileTreeNode>, String> {
    let root = Path::new(&project_root);
    if !root.exists() {
        return Err(format!("Project directory does not exist: {}", project_root));
    }
    let mut file_count = 0;
    scan_dir_recursive(root, &mut file_count)
}

#[tauri::command]
pub async fn read_markdown_file(
    project_root: String,
    relative_path: String,
) -> Result<ParsedDocument, String> {
    let safe_path = canonical_within(Path::new(&project_root), Path::new(&relative_path))
        .map_err(|e| format!("Security violation: {}", e))?;

    let raw = tokio::fs::read_to_string(&safe_path)
        .await
        .map_err(|e| format!("Failed to read {}: {}", safe_path.display(), e))?;
    Ok(parse_markdown_with_frontmatter(&raw))
}

#[tauri::command]
pub async fn write_markdown_file(
    project_root: String,
    relative_path: String,
    frontmatter: HashMap<String, serde_json::Value>,
    body: String,
) -> Result<(), String> {
    let safe_path = canonical_within(Path::new(&project_root), Path::new(&relative_path))
        .map_err(|e| format!("Security violation: {}", e))?;

    let serialized = serialize_markdown_with_frontmatter(&frontmatter, &body);
    if let Some(parent) = safe_path.parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }
    tokio::fs::write(&safe_path, serialized)
        .await
        .map_err(|e| format!("Failed to write {}: {}", safe_path.display(), e))
}
