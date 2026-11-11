use crate::core_engine::linter::is_valid_word_boundary;
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
    alias_pairs: &[(String, String)],
) -> Vec<RefactorPreviewItem> {
    let mut items = Vec::new();
    let mut replacements = vec![(old_name.to_string(), new_name.to_string())];
    for (old_a, new_a) in alias_pairs {
        if !old_a.is_empty() && !new_a.is_empty() {
            replacements.push((old_a.clone(), new_a.clone()));
        }
    }

    for (ch_id, ch_title, paragraphs) in chapters {
        for (p_idx, para) in paragraphs.iter().enumerate() {
            for (from_token, to_token) in &replacements {
                if let Some(preview) = replace_whole_word(para, from_token, to_token) {
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

/// Replaces every standalone occurrence of `from` with `to`.
///
/// A token that is glued to another word character (letter, digit, underscore)
/// is left untouched, so renaming "An" never rewrites "Anh" or "an toàn".
/// Returns `None` when the text holds no standalone occurrence.
pub fn replace_whole_word(text: &str, from: &str, to: &str) -> Option<String> {
    if from.trim().is_empty() {
        return None;
    }

    let mut result = String::with_capacity(text.len());
    let mut cursor = 0usize;
    let mut replaced = false;

    while let Some(offset) = text[cursor..].find(from) {
        let start = cursor + offset;
        let end = start + from.len();
        if is_valid_word_boundary(text, start, end) {
            result.push_str(&text[cursor..start]);
            result.push_str(to);
            cursor = end;
            replaced = true;
        } else {
            // The token is glued to another word: skip it, but advance by whole
            // characters so a multi-byte character is never cut in half.
            let step = text[start..].chars().next().map_or(1, char::len_utf8);
            result.push_str(&text[cursor..start + step]);
            cursor = start + step;
        }
    }
    result.push_str(&text[cursor..]);

    if replaced {
        Some(result)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replace_whole_word_skips_glued_and_differently_cased_tokens() {
        assert_eq!(
            replace_whole_word(
                "An bước đi trong đêm an toàn cùng Công an.",
                "An",
                "Bình"
            ),
            Some("Bình bước đi trong đêm an toàn cùng Công an.".to_string())
        );
        assert_eq!(replace_whole_word("Anh bước đi.", "An", "Bình"), None);
        assert_eq!(replace_whole_word("bất kỳ câu nào", "", "Bình"), None);
    }

    #[test]
    fn replace_whole_word_never_splits_a_multi_byte_character() {
        // "Ân1" — the token is glued to a digit, so it must be skipped, but the
        // scan may only advance by whole characters.
        assert_eq!(replace_whole_word("Ân1 rõ", "Ân", "An"), None);
        assert_eq!(
            replace_whole_word("Lâm Vũ Linh", "Lâm", "Bình"),
            Some("Bình Vũ Linh".to_string())
        );
        assert_eq!(replace_whole_word("Đông Ân", "Đông", "Tây"), Some("Tây Ân".to_string()));
    }

    #[test]
    fn preview_only_reports_whole_word_matches() {
        let chapters = vec![(
            "ch_01".to_string(),
            "Chương 1".to_string(),
            vec!["An bước đi trong đêm an toàn.".to_string()],
        )];
        let items = preview_entity_rename(&chapters, "An", "Bình", &[]);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].preview_sentence, "Bình bước đi trong đêm an toàn.");
    }
}
