use serde::{Deserialize, Serialize};
use similar::{ChangeTag, TextDiff};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffHunkChunk {
    pub tag: String, // "equal" | "insert" | "delete"
    pub content: String,
}

/// Uses the `similar` crate to compute line-by-line or word-by-word prose diffs
/// for Inline Diff review and Side-by-Side Snapshot comparison.
#[tauri::command]
pub fn compute_prose_diff(old_text: String, new_text: String) -> Vec<DiffHunkChunk> {
    let diff = TextDiff::from_lines(&old_text, &new_text);
    let mut chunks = Vec::new();

    for change in diff.iter_all_changes() {
        let tag = match change.tag() {
            ChangeTag::Delete => "delete",
            ChangeTag::Insert => "insert",
            ChangeTag::Equal => "equal",
        };
        chunks.push(DiffHunkChunk {
            tag: tag.to_string(),
            content: change.to_string(),
        });
    }

    chunks
}
