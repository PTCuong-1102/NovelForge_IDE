use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefactorPreviewItem {
    pub chapter_id: String,
    pub chapter_title: String,
    pub paragraph_index: usize,
    pub original_sentence: String,
    pub preview_sentence: String,
    pub matched_token: String,
    pub replacement_token: String,
}

/// Generates a project-wide preview of renaming a character/entity and its aliases.
pub fn preview_entity_rename(
    chapters: &[(String, String, Vec<String>)], // (chapter_id, chapter_title, paragraphs)
    old_name: &str,
    new_name: &str,
    alias_Pairs: &[(String, String)],
) -> Vec<RefactorPreviewItem> {
    let mut items = Vec::new();
    let mut replacements = vec![(old_name.to_string(), new_name.to_string())];
    for (old_a, new_a) in alias_Pairs {
        if !old_a.is_empty() && !new_a.is_empty() {
            replacements.push((old_a.clone(), new_a.clone()));
        }
    }

    for (ch_id, ch_title, paragraphs) in chapters {
        for (p_idx, para) in paragraphs.iter().enumerate() {
            for (from_token, to_token) in &replacements {
                if para.contains(from_token) {
                    let preview = para.replace(from_token, to_token);
                    items.push(RefactorPreviewItem {
                        chapter_id: ch_id.clone(),
                        chapter_title: ch_title.clone(),
                        paragraph_index: p_idx,
                        original_sentence: para.clone(),
                        preview_sentence: preview,
                        matched_token: from_token.clone(),
                        replacement_token: to_token.clone(),
                    });
                }
            }
        }
    }

    items
}
