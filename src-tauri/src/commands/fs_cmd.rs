use crate::core_engine::parser::{
    parse_markdown_with_frontmatter, serialize_markdown_with_ordered_frontmatter, ParsedDocument,
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
    ordered_keys: Option<Vec<String>>,
    body: String,
) -> Result<(), String> {
    let safe_path = canonical_within(Path::new(&project_root), Path::new(&relative_path))
        .map_err(|e| format!("Security violation: {}", e))?;

    let serialized = serialize_markdown_with_ordered_frontmatter(
        &frontmatter,
        ordered_keys.as_deref().unwrap_or(&[]),
        &body,
    );
    if let Some(parent) = safe_path.parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }
    tokio::fs::write(&safe_path, serialized)
        .await
        .map_err(|e| format!("Failed to write {}: {}", safe_path.display(), e))
}

/// Renames a markdown file inside the project — used when a chapter changes
/// its technical id and the file name must follow.
#[tauri::command]
pub async fn rename_markdown_file(
    project_root: String,
    from_relative_path: String,
    to_relative_path: String,
) -> Result<(), String> {
    let root = Path::new(&project_root);
    let from = canonical_within(root, Path::new(&from_relative_path))
        .map_err(|e| format!("Security violation: {e}"))?;
    let to = canonical_within(root, Path::new(&to_relative_path))
        .map_err(|e| format!("Security violation: {e}"))?;

    if !from.exists() {
        return Err(format!("Source file not found: {from_relative_path}"));
    }
    if to.exists() {
        return Err(format!(
            "Target file already exists: {to_relative_path}"
        ));
    }
    if let Some(parent) = to.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::rename(&from, &to).map_err(|e| format!("Cannot rename file: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// End-to-end proof of the save path: a chapter written by the IDE must keep
    /// its headings, its scene breaks and the custom YAML keys in their order.
    #[tokio::test]
    async fn write_markdown_file_keeps_headings_and_custom_keys() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().to_string_lossy().to_string();
        let body = "# Chương 1: Mở đầu\n\nMưa rơi.\n\n***\n\n## Cảnh 2\n\nĐoạn kết.";

        let mut frontmatter = HashMap::new();
        frontmatter.insert("id".to_string(), serde_json::json!("ch_01"));
        frontmatter.insert("title".to_string(), serde_json::json!("Mở đầu"));
        frontmatter.insert("weather".to_string(), serde_json::json!("Mưa axit"));

        write_markdown_file(
            root,
            "manuscript/act-01/ch-01.md".to_string(),
            frontmatter,
            Some(vec![
                "id".to_string(),
                "title".to_string(),
                "weather".to_string(),
            ]),
            body.to_string(),
        )
        .await
        .unwrap();

        let written = std::fs::read_to_string(
            dir.path().join("manuscript/act-01/ch-01.md"),
        )
        .unwrap();

        assert!(
            written.starts_with("---\nid: ch_01\ntitle: Mở đầu\nweather: Mưa axit\n---\n"),
            "frontmatter order/keys changed:\n{written}"
        );
        assert!(written.contains("# Chương 1: Mở đầu"), "heading lost");
        assert!(written.contains("***"), "scene break lost");
        assert!(written.contains("## Cảnh 2"), "sub-heading lost");
    }

    #[tokio::test]
    async fn rename_markdown_file_moves_the_file_inside_the_project() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().to_string_lossy().to_string();
        std::fs::create_dir_all(dir.path().join("manuscript/act-01")).unwrap();
        std::fs::write(
            dir.path().join("manuscript/act-01/ch-01.md"),
            "nội dung",
        )
        .unwrap();

        rename_markdown_file(
            root,
            "manuscript/act-01/ch-01.md".to_string(),
            "manuscript/act-01/ch-77-khoi-dau.md".to_string(),
        )
        .await
        .unwrap();

        assert!(!dir.path().join("manuscript/act-01/ch-01.md").exists());
        assert_eq!(
            std::fs::read_to_string(dir.path().join("manuscript/act-01/ch-77-khoi-dau.md"))
                .unwrap(),
            "nội dung"
        );
    }

    #[tokio::test]
    async fn rename_markdown_file_rejects_paths_outside_the_project() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().to_string_lossy().to_string();
        std::fs::write(dir.path().join("ch-01.md"), "nội dung").unwrap();

        let err = rename_markdown_file(
            root,
            "ch-01.md".to_string(),
            "../escaped.md".to_string(),
        )
        .await
        .unwrap_err();
        assert!(err.contains("Security violation"), "got: {err}");
        assert!(!dir.path().parent().unwrap().join("escaped.md").exists());
    }

    #[tokio::test]
    async fn rename_markdown_file_refuses_to_overwrite_an_existing_file() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().to_string_lossy().to_string();
        std::fs::write(dir.path().join("ch-01.md"), "một").unwrap();
        std::fs::write(dir.path().join("ch-02.md"), "hai").unwrap();

        let err = rename_markdown_file(
            root,
            "ch-01.md".to_string(),
            "ch-02.md".to_string(),
        )
        .await
        .unwrap_err();
        assert!(err.contains("already exists"), "got: {err}");
        assert_eq!(
            std::fs::read_to_string(dir.path().join("ch-02.md")).unwrap(),
            "hai"
        );
    }
}
