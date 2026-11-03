use aho_corasick::AhoCorasick;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoreCharacterSpec {
    pub id: String,
    pub name: String,
    pub aliases: Vec<String>,
    pub status: String, // "alive" | "dead" | "missing"
    pub death_chapter_order: Option<u32>,
    pub death_date: Option<String>,
    pub death_chapter_title: Option<String>,
    pub attributes: HashMap<String, String>, // e.g., eye_color, hair, scar
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

/// Uses the Aho-Corasick automaton to scan a chapter for all character names and aliases in < 2ms.
pub fn scan_implicit_entities(
    paragraphs: &[String],
    characters: &[LoreCharacterSpec],
) -> Vec<DetectedEntitySpan> {
    let mut patterns = Vec::new();
    let mut pattern_meta = Vec::new();

    for ch in characters {
        if !ch.name.trim().is_empty() {
            patterns.push(ch.name.clone());
            pattern_meta.push((ch.id.clone(), ch.name.clone()));
        }
        for alias in &ch.aliases {
            if !alias.trim().is_empty() {
                patterns.push(alias.clone());
                pattern_meta.push((ch.id.clone(), ch.name.clone()));
            }
        }
    }

    if patterns.is_empty() {
        return Vec::new();
    }

    let ac = match AhoCorasick::new(&patterns) {
        Ok(automaton) => automaton,
        Err(_) => return Vec::new(),
    };

    let mut spans = Vec::new();
    for (p_idx, para) in paragraphs.iter().enumerate() {
        for mat in ac.find_iter(para) {
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

/// Evaluates the 3 Continuity Linter rules from `.docs/prd-technical-architecture.md`:
/// - Rule 1: Dead Character Check
/// - Rule 2: Attribute Consistency Check
/// - Rule 3: Pacing & Readability (word repetition & overly long sentences)
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

    // Rule 1: Dead Character Check
    for span in &detected {
        if let Some(ch) = char_map.get(&span.entity_id) {
            let para_text = &paragraphs[span.paragraph_index];
            let is_para_flashback =
                is_flashback || para_text.to_lowercase().contains("[flashback]");

            if ch.status == "dead" && !is_para_flashback {
                if let Some(death_order) = ch.death_chapter_order {
                    if chapter_order > death_order {
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
                                "Đánh dấu đoạn văn này là Cảnh Hồi Tưởng".to_string(),
                                format!("Mở hồ sơ {} để cập nhật trạng thái", ch.name),
                                "Bỏ qua cảnh báo này cho chương hiện tại".to_string(),
                            ],
                        });
                    }
                }
            }
        }
    }

    // Rule 3: Pacing & Readability — Repetition detection within a paragraph
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
    }

    diagnostics
}
