use aho_corasick::{AhoCorasickBuilder, MatchKind};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoreCharacterSpec {
    pub id: String,
    pub name: String,
    pub aliases: Vec<String>,
    pub status: String, // "alive" | "dead" | "missing"
    pub death_chapter_order: Option<u32>,
    pub death_date: Option<String>,
    pub death_chapter_title: Option<String>,
    pub attributes: HashMap<String, String>, // e.g., hair, eye_color, appearance, scar
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedEntitySpan {
    pub entity_id: String,
    pub matched_text: String,
    pub canonical_name: String,
    pub start_offset: usize,
    pub end_offset: usize,
    pub paragraph_index: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContinuityDiagnostic {
    pub id: String,
    pub rule_id: String, // "DEAD_CHARACTER" | "ATTRIBUTE_MISMATCH" | "PACING_REPETITION" | "SENTENCE_LENGTH"
    pub severity: String, // "error" | "warning"
    pub message: String,
    pub matched_text: String,
    pub entity_id: Option<String>,
    pub paragraph_index: usize,
    pub quick_fixes: Vec<String>,
}

/// Checks whether a byte range `[start..end]` in `text` falls on clean token boundaries.
fn is_valid_word_boundary(text: &str, start: usize, end: usize) -> bool {
    let before_ok = if start == 0 {
        true
    } else {
        text[..start]
            .chars()
            .next_back()
            .map(|c| !c.is_alphanumeric())
            .unwrap_or(true)
    };

    let after_ok = if end >= text.len() {
        true
    } else {
        text[end..]
            .chars()
            .next()
            .map(|c| !c.is_alphanumeric())
            .unwrap_or(true)
    };

    before_ok && after_ok
}

/// Uses the Aho-Corasick automaton (`LeftmostLongest`) to scan a chapter for all character/entity names
/// and aliases in < 2ms with clean word boundary validation.
pub fn scan_implicit_entities(
    paragraphs: &[String],
    characters: &[LoreCharacterSpec],
) -> Vec<DetectedEntitySpan> {
    let mut candidate_tuples: Vec<(String, String, String)> = Vec::new();

    for ch in characters {
        let name_trimmed = ch.name.trim();
        if !name_trimmed.is_empty() {
            candidate_tuples.push((
                name_trimmed.to_string(),
                ch.id.clone(),
                ch.name.clone(),
            ));
        }
        for alias in &ch.aliases {
            let alias_trimmed = alias.trim();
            if !alias_trimmed.is_empty() {
                candidate_tuples.push((
                    alias_trimmed.to_string(),
                    ch.id.clone(),
                    ch.name.clone(),
                ));
            }
        }
    }

    if candidate_tuples.is_empty() {
        return Vec::new();
    }

    // Sort longest patterns first so LeftmostLongest prioritizes full names over short aliases
    candidate_tuples.sort_by(|a, b| b.0.len().cmp(&a.0.len()));

    let patterns: Vec<String> = candidate_tuples.iter().map(|t| t.0.clone()).collect();
    let pattern_meta: Vec<(String, String)> = candidate_tuples
        .into_iter()
        .map(|(_, id, canon)| (id, canon))
        .collect();

    let ac = match AhoCorasickBuilder::new()
        .match_kind(MatchKind::LeftmostLongest)
        .ascii_case_insensitive(true)
        .build(&patterns)
    {
        Ok(automaton) => automaton,
        Err(_) => return Vec::new(),
    };

    let mut spans = Vec::new();
    for (p_idx, para) in paragraphs.iter().enumerate() {
        for mat in ac.find_iter(para) {
            if !is_valid_word_boundary(para, mat.start(), mat.end()) {
                continue;
            }
            let (ref entity_id, ref canonical_name) = pattern_meta[mat.pattern().as_usize()];
            spans.push(DetectedEntitySpan {
                entity_id: entity_id.clone(),
                matched_text: para[mat.start()..mat.end()].to_string(),
                canonical_name: canonical_name.clone(),
                start_offset: mat.start(),
                end_offset: mat.end(),
                paragraph_index: p_idx,
            });
        }
    }

    spans
}

/// Evaluates the Continuity Linter rules from `.docs/prd-technical-architecture.md` (Section 3.2.2):
/// - Rule 1 (`DEAD_CHARACTER`): Error if a deceased character acts after their death chapter without a flashback tag.
/// - Rule 2 (`ATTRIBUTE_MISMATCH`): Error if physical description contradicts canonical Lorebook attributes.
/// - Rule 3 (`PACING_REPETITION` & `SENTENCE_LENGTH`): Warning on word/phrase repetition or overly dense sentences.
pub fn check_chapter_continuity(
    chapter_order: u32,
    is_flashback: bool,
    chapter_date: &str,
    paragraphs: &[String],
    characters: &[LoreCharacterSpec],
) -> Vec<ContinuityDiagnostic> {
    let mut diagnostics = Vec::new();
    let detected = scan_implicit_entities(paragraphs, characters);
    let char_map: HashMap<String, &LoreCharacterSpec> =
        characters.iter().map(|c| (c.id.clone(), c)).collect();

    // Rule 1: Dead Character Check (deduplicated per character + paragraph)
    let mut seen_dead_in_para: HashSet<(String, usize)> = HashSet::new();
    for span in &detected {
        if let Some(ch) = char_map.get(&span.entity_id) {
            let para_text = &paragraphs[span.paragraph_index];
            let lower_para = para_text.to_lowercase();
            let is_para_flashback = is_flashback
                || lower_para.contains("[flashback]")
                || lower_para.contains("[hồi tưởng]");

            if ch.status == "dead" && !is_para_flashback {
                if let Some(death_order) = ch.death_chapter_order {
                    if chapter_order > death_order
                        && seen_dead_in_para.insert((ch.id.clone(), span.paragraph_index))
                    {
                        let death_chapter_label = ch
                            .death_chapter_title
                            .clone()
                            .unwrap_or_else(|| format!("Chương {}", death_order));
                        let death_date_label = ch
                            .death_date
                            .clone()
                            .unwrap_or_else(|| "Không rõ".to_string());

                        diagnostics.push(ContinuityDiagnostic {
                            id: format!("diag-dead-{}-{}", ch.id, span.paragraph_index),
                            rule_id: "DEAD_CHARACTER".to_string(),
                            severity: "error".to_string(),
                            message: format!(
                                "Nhân vật \"{}\" đã được đánh dấu [Tử vong] tại {} (Mốc thời gian: {}). Chương hiện tại đang diễn ra vào: {}.",
                                ch.name, death_chapter_label, death_date_label, chapter_date
                            ),
                            matched_text: span.matched_text.clone(),
                            entity_id: Some(ch.id.clone()),
                            paragraph_index: span.paragraph_index,
                            quick_fixes: vec![
                                "Đánh dấu đoạn văn này là Cảnh Hồi Tưởng [Hồi tưởng]".to_string(),
                                format!("Mở hồ sơ {} để cập nhật trạng thái", ch.name),
                                "Bỏ qua cảnh báo này cho chương hiện tại".to_string(),
                            ],
                        });
                    }
                }
            }
        }
    }

    // Rule 2: Attribute Consistency Check (compare paragraph descriptions with character attributes)
    let conflict_pairs: &[(&str, &str, &str)] = &[
        ("tóc ngắn", "tóc dài", "mái tóc ngắn ngang vai"),
        ("tóc dài", "tóc ngắn", "mái tóc dài"),
        ("mắt nâu", "mắt xanh", "đôi mắt nâu"),
        ("mắt đen", "mắt xanh", "đôi mắt đen"),
        ("cụt tay trái", "vung tay trái", "cánh tay phải"),
    ];

    for (p_idx, para) in paragraphs.iter().enumerate() {
        let lower_para = para.to_lowercase();
        let entities_in_para: Vec<&DetectedEntitySpan> = detected
            .iter()
            .filter(|s| s.paragraph_index == p_idx)
            .collect();

        for span in entities_in_para {
            if let Some(ch) = char_map.get(&span.entity_id) {
                let combined_attrs = ch
                    .attributes
                    .values()
                    .cloned()
                    .collect::<Vec<_>>()
                    .join(" ")
                    .to_lowercase();

                for &(canonical_trait, conflicting_phrase, suggested_fix) in conflict_pairs {
                    if combined_attrs.contains(canonical_trait)
                        && lower_para.contains(conflicting_phrase)
                    {
                        let diag_id = format!(
                            "diag-attr-{}-{}-{}",
                            ch.id,
                            p_idx,
                            conflicting_phrase.replace(' ', "_")
                        );
                        if !diagnostics.iter().any(|d| d.id == diag_id) {
                            diagnostics.push(ContinuityDiagnostic {
                                id: diag_id,
                                rule_id: "ATTRIBUTE_MISMATCH".to_string(),
                                severity: "error".to_string(),
                                message: format!(
                                    "Mâu thuẫn thuộc tính nhân vật: Hồ sơ của \"{}\" ghi nhận \"{}\", nhưng đoạn văn đang mô tả \"{}\".",
                                    ch.name, canonical_trait, conflicting_phrase
                                ),
                                matched_text: conflicting_phrase.to_string(),
                                entity_id: Some(ch.id.clone()),
                                paragraph_index: p_idx,
                                quick_fixes: vec![
                                    format!("Đổi thành \"{}\" theo Lorebook", suggested_fix),
                                    "Bỏ qua cảnh báo mâu thuẫn thuộc tính".to_string(),
                                ],
                            });
                        }
                    }
                }
            }
        }
    }

    // Rule 3A: Pacing & Readability — Repetition detection within a paragraph (>= 4x)
    for (p_idx, para) in paragraphs.iter().enumerate() {
        let words: Vec<String> = para
            .split_whitespace()
            .map(|w| {
                w.trim_matches(|c: char| c.is_ascii_punctuation())
                    .to_lowercase()
            })
            .filter(|w| w.chars().count() >= 4)
            .collect();

        let mut counts: HashMap<String, usize> = HashMap::new();
        for w in &words {
            *counts.entry(w.clone()).or_insert(0) += 1;
        }

        for (word, count) in counts {
            if count >= 4 {
                diagnostics.push(ContinuityDiagnostic {
                    id: format!("diag-rep-{}-{}", p_idx, word),
                    rule_id: "PACING_REPETITION".to_string(),
                    severity: "warning".to_string(),
                    message: format!(
                        "Cảnh báo nhịp điệu: Từ \"{}\" lặp lại {} lần trong cùng một đoạn văn.",
                        word, count
                    ),
                    matched_text: word.clone(),
                    entity_id: None,
                    paragraph_index: p_idx,
                    quick_fixes: vec![
                        "Gợi ý từ đồng nghĩa bằng AI Composer".to_string(),
                        "Bỏ qua cảnh báo văn phong".to_string(),
                    ],
                });
            }
        }

        // Rule 3B: Sentence Length Check (> 65 words in a single sentence)
        for sentence in para.split(['.', '!', '?', '…']) {
            let word_len = sentence.split_whitespace().count();
            if word_len > 65 {
                let preview_snippet: String = sentence
                    .split_whitespace()
                    .take(6)
                    .collect::<Vec<_>>()
                    .join(" ");
                diagnostics.push(ContinuityDiagnostic {
                    id: format!("diag-sentence-len-{}", p_idx),
                    rule_id: "SENTENCE_LENGTH".to_string(),
                    severity: "warning".to_string(),
                    message: format!(
                        "Câu văn quá dài ({} từ): Có thể làm giảm nhịp độ đọc. Nên tách thành 2 câu ngắn gọn hơn.",
                        word_len
                    ),
                    matched_text: preview_snippet,
                    entity_id: None,
                    paragraph_index: p_idx,
                    quick_fixes: vec![
                        "Nhờ AI Composer ngắt nhịp câu văn".to_string(),
                        "Bỏ qua cảnh báo độ dài câu".to_string(),
                    ],
                });
                break;
            }
        }
    }

    // Rule 3C: Chapter-wide cliché/atmospheric phrase repetition (>= 3 times across chapter)
    let tracked_phrases = ["lạnh lẽo", "nặng nề", "bóng tối"];
    for phrase in tracked_phrases {
        let mut total_occurrences = 0usize;
        let mut first_para_idx = None;

        for (p_idx, para) in paragraphs.iter().enumerate() {
            let lower = para.to_lowercase();
            let count = lower.matches(phrase).count();
            if count > 0 {
                total_occurrences += count;
                if first_para_idx.is_none() {
                    first_para_idx = Some(p_idx);
                }
            }
        }

        if total_occurrences >= 3 {
            if let Some(p_idx) = first_para_idx {
                diagnostics.push(ContinuityDiagnostic {
                    id: format!("diag-phrase-rep-{}", phrase.replace(' ', "_")),
                    rule_id: "PACING_REPETITION".to_string(),
                    severity: "warning".to_string(),
                    message: format!(
                        "Cảnh báo văn phong: Cụm từ \"{}\" lặp lại {} lần trong toàn chương.",
                        phrase, total_occurrences
                    ),
                    matched_text: phrase.to_string(),
                    entity_id: None,
                    paragraph_index: p_idx,
                    quick_fixes: vec![
                        format!("Thay thế \"{}\" bằng từ giàu hình ảnh hơn", phrase),
                        "Bỏ qua cảnh báo lặp từ này".to_string(),
                    ],
                });
            }
        }
    }

    diagnostics
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_linter_dead_character_and_attribute_mismatch() {
        let mut linh_attrs = HashMap::new();
        linh_attrs.insert("appearance".to_string(), "Tóc ngắn ngang vai, áo khoác đen".to_string());

        let characters = vec![
            LoreCharacterSpec {
                id: "char_khanh".to_string(),
                name: "Vũ Đình Khánh".to_string(),
                aliases: vec!["Chỉ huy Khánh".to_string()],
                status: "dead".to_string(),
                death_chapter_order: Some(1),
                death_date: Some("12/10/2026".to_string()),
                death_chapter_title: Some("Chương 1".to_string()),
                attributes: HashMap::new(),
            },
            LoreCharacterSpec {
                id: "char_linh".to_string(),
                name: "Lâm Vũ Linh".to_string(),
                aliases: vec!["Tiểu Linh".to_string()],
                status: "alive".to_string(),
                death_chapter_order: None,
                death_date: None,
                death_chapter_title: None,
                attributes: linh_attrs,
            },
        ];

        let paragraphs = vec![
            "Chỉ huy Khánh bước ra từ màn mưa lạnh lẽo.".to_string(),
            "Tiểu Linh vuốt mái tóc dài ướt sũng trong gió lạnh lẽo, ánh mắt hướng về bóng tối lạnh lẽo.".to_string(),
        ];

        let issues = check_chapter_continuity(2, false, "14/10/2026", &paragraphs, &characters);
        assert!(issues.iter().any(|i| i.rule_id == "DEAD_CHARACTER"));
        assert!(issues.iter().any(|i| i.rule_id == "ATTRIBUTE_MISMATCH"));
        assert!(issues.iter().any(|i| i.rule_id == "PACING_REPETITION"));
    }
}
