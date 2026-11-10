use pulldown_cmark::{Event, Options, Parser, Tag, TagEnd};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum MarkdownBlock {
    Heading { level: u8, text: String },
    Paragraph { text: String, is_flashback: bool },
    SceneBreak,
    AuthorNote { text: String },
    BlockQuote { text: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedDocument {
    pub frontmatter: HashMap<String, serde_json::Value>,
    pub frontmatter_keys_order: Vec<String>,
    pub raw_frontmatter: String,
    pub body: String,
    pub word_count: usize,
    pub char_count: usize,
    pub headings: Vec<String>,
    pub paragraphs: Vec<String>,
    pub blocks: Vec<MarkdownBlock>,
}

/// Counts words accurately across Vietnamese (multi-syllable space-separated tokens) and Latin scripts.
pub fn count_vietnamese_and_latin_words(text: &str) -> usize {
    text.split_whitespace()
        .map(|token| {
            token.trim_matches(|c: char| {
                c.is_ascii_punctuation() || matches!(c, '“' | '”' | '‘' | '’' | '—' | '–' | '…')
            })
        })
        .filter(|cleaned| !cleaned.is_empty() && cleaned.chars().any(|c| c.is_alphanumeric()))
        .count()
}

/// Splits raw file content into optional YAML frontmatter (`--- ... ---`) and Markdown body.
fn split_frontmatter_and_body(raw: &str) -> (Option<String>, String) {
    let normalized = raw.replace("\r\n", "\n");
    if let Some(stripped) = normalized.strip_prefix("---\n") {
        if let Some(end_idx) = stripped.find("\n---\n") {
            let yaml_part = stripped[..end_idx].to_string();
            let rest = stripped[end_idx + 5..].to_string();
            return (Some(yaml_part), rest);
        } else if let Some(end_idx) = stripped.strip_suffix("\n---") {
            return (Some(end_idx.to_string()), String::new());
        }
    }
    (None, normalized)
}

/// Extracts top-level YAML keys in their original declaration order for lossless serialization.
fn extract_yaml_key_order(raw_yaml: &str) -> Vec<String> {
    let mut keys = Vec::new();
    for line in raw_yaml.lines() {
        let trimmed = line.trim_end();
        if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with(' ') || trimmed.starts_with('\t') || trimmed.starts_with('-') {
            continue;
        }
        if let Some((key, _)) = trimmed.split_once(':') {
            let k = key.trim().to_string();
            if !k.is_empty() && !keys.contains(&k) {
                keys.push(k);
            }
        }
    }
    keys
}

/// Removes one matching pair of surrounding quotes from a raw YAML scalar.
fn strip_surrounding_quotes(value: &str) -> &str {
    let bytes = value.as_bytes();
    if bytes.len() >= 2 {
        let first = bytes[0];
        let last = bytes[bytes.len() - 1];
        if (first == b'"' && last == b'"') || (first == b'\'' && last == b'\'') {
            return &value[1..value.len() - 1];
        }
    }
    value
}

/// Converts a raw YAML scalar into a JSON value without full YAML support.
fn lenient_yaml_value(raw_value: &str) -> serde_json::Value {
    let value = strip_surrounding_quotes(raw_value.trim());
    if value.is_empty() {
        return serde_json::Value::String(String::new());
    }
    if let Ok(number) = value.parse::<i64>() {
        return serde_json::Value::Number(number.into());
    }
    if let Ok(number) = value.parse::<f64>() {
        if let Some(number) = serde_json::Number::from_f64(number) {
            return serde_json::Value::Number(number);
        }
    }
    match value {
        "true" => return serde_json::Value::Bool(true),
        "false" => return serde_json::Value::Bool(false),
        _ => {}
    }
    serde_json::Value::String(value.to_string())
}

/// Recovers simple top-level `key: value` pairs when the YAML frontmatter fails to parse,
/// so a light syntax error never wipes the whole metadata block.
fn parse_lenient_yaml(raw_yaml: &str) -> HashMap<String, serde_json::Value> {
    let mut map = HashMap::new();
    for line in raw_yaml.lines() {
        let trimmed = line.trim_end();
        if trimmed.is_empty()
            || trimmed.starts_with('#')
            || trimmed.starts_with(' ')
            || trimmed.starts_with('\t')
            || trimmed.starts_with('-')
        {
            continue;
        }
        let Some((key, raw_value)) = trimmed.split_once(':') else {
            continue;
        };
        let key = key.trim();
        if key.is_empty() {
            continue;
        }
        map.insert(key.to_string(), lenient_yaml_value(raw_value));
    }
    map
}

/// Parses a Markdown document containing optional YAML frontmatter (`--- ... ---`)
/// and extracts structured metadata, lossless block AST, paragraphs, headings, and word count.
pub fn parse_markdown_with_frontmatter(raw: &str) -> ParsedDocument {
    let (yaml_opt, body_raw) = split_frontmatter_and_body(raw);
    let mut frontmatter = HashMap::new();
    let mut frontmatter_keys_order = Vec::new();
    let mut raw_frontmatter = String::new();

    if let Some(yaml_str) = yaml_opt {
        raw_frontmatter = yaml_str.clone();
        frontmatter_keys_order = extract_yaml_key_order(&yaml_str);
        match serde_yaml::from_str::<HashMap<String, serde_json::Value>>(&yaml_str) {
            Ok(parsed_yaml) => frontmatter = parsed_yaml,
            Err(_) => frontmatter = parse_lenient_yaml(&yaml_str),
        }
    }

    let body = body_raw.trim_start_matches('\n').to_string();

    // Parse block-level paragraphs preserving custom literary blocks (`***`, `> [!GHI_CHÚ_TÁC_GIẢ]`, `[Hồi tưởng]`)
    let mut paragraphs = Vec::new();
    let mut blocks = Vec::new();
    let mut headings = Vec::new();

    for raw_block in body.split("\n\n") {
        let trimmed = raw_block.trim();
        if trimmed.is_empty() {
            continue;
        }

        if trimmed == "***" || trimmed == "* * *" || trimmed == "---" {
            paragraphs.push("***".to_string());
            blocks.push(MarkdownBlock::SceneBreak);
            continue;
        }

        if let Some(note_rest) = trimmed.strip_prefix("> [!GHI_CHÚ_TÁC_GIẢ]") {
            let clean_note = note_rest.trim().to_string();
            paragraphs.push(format!("> [!GHI_CHÚ_TÁC_GIẢ] {}", clean_note));
            blocks.push(MarkdownBlock::AuthorNote { text: clean_note });
            continue;
        }

        if let Some(heading_text) = trimmed.strip_prefix('#') {
            let hashes = trimmed.chars().take_while(|&c| c == '#').count() as u8;
            let clean_heading = heading_text.trim_start_matches('#').trim().to_string();
            if !clean_heading.is_empty() {
                headings.push(clean_heading.clone());
                blocks.push(MarkdownBlock::Heading {
                    level: hashes.clamp(1, 6),
                    text: clean_heading,
                });
                continue;
            }
        }

        if let Some(quote_rest) = trimmed.strip_prefix("> ") {
            let clean_quote = quote_rest.trim().to_string();
            paragraphs.push(trimmed.to_string());
            blocks.push(MarkdownBlock::BlockQuote { text: clean_quote });
            continue;
        }

        let is_flashback = trimmed.to_lowercase().starts_with("[hồi tưởng]")
            || trimmed.to_lowercase().starts_with("[flashback]");
        paragraphs.push(trimmed.to_string());
        blocks.push(MarkdownBlock::Paragraph {
            text: trimmed.to_string(),
            is_flashback,
        });
    }

    // Fallback AST heading extraction via pulldown-cmark if inline headings exist
    if headings.is_empty() {
        let mut options = Options::empty();
        options.insert(Options::ENABLE_STRIKETHROUGH);
        options.insert(Options::ENABLE_TABLES);
        let parser = Parser::new_ext(&body, options);
        let mut in_heading = false;
        let mut current_heading = String::new();

        for event in parser {
            match event {
                Event::Start(Tag::Heading { .. }) => {
                    in_heading = true;
                    current_heading.clear();
                }
                Event::End(TagEnd::Heading(_)) => {
                    in_heading = false;
                    if !current_heading.trim().is_empty() {
                        headings.push(current_heading.trim().to_string());
                    }
                }
                Event::Text(t) | Event::Code(t) if in_heading => {
                    current_heading.push_str(&t);
                }
                _ => {}
            }
        }
    }

    let word_count = count_vietnamese_and_latin_words(&body);
    let char_count = body.chars().count();

    ParsedDocument {
        frontmatter,
        frontmatter_keys_order,
        raw_frontmatter,
        body,
        word_count,
        char_count,
        headings,
        paragraphs,
        blocks,
    }
}

/// Serializes frontmatter and Markdown body back into a single lossless `.md` file string.
/// Preserves key ordering when `ordered_keys` is provided, otherwise sorts keys deterministically.
pub fn serialize_markdown_with_ordered_frontmatter(
    frontmatter: &HashMap<String, serde_json::Value>,
    ordered_keys: &[String],
    body: &str,
) -> String {
    let trimmed_body = body.trim_matches('\n');
    if frontmatter.is_empty() {
        return if trimmed_body.is_empty() {
            String::new()
        } else {
            format!("{}\n", trimmed_body)
        };
    }

    let mut ordered_keys_vec: Vec<&String> = Vec::new();
    for k in ordered_keys {
        if frontmatter.contains_key(k) && !ordered_keys_vec.contains(&k) {
            ordered_keys_vec.push(k);
        }
    }
    let mut remaining_keys: Vec<&String> = frontmatter
        .keys()
        .filter(|k| !ordered_keys_vec.contains(k))
        .collect();
    remaining_keys.sort();
    ordered_keys_vec.extend(remaining_keys);

    let mut yaml_lines = Vec::new();
    for key in ordered_keys_vec {
        if let Some(val) = frontmatter.get(key) {
            let mut single_map = serde_yaml::Mapping::new();
            single_map.insert(
                serde_yaml::Value::String(key.clone()),
                serde_json::from_value(val.clone()).unwrap_or(serde_yaml::Value::Null),
            );
            if let Ok(serialized_entry) = serde_yaml::to_string(&single_map) {
                let cleaned = serialized_entry
                    .trim_start_matches("---\n")
                    .trim_end_matches('\n')
                    .to_string();
                if !cleaned.is_empty() {
                    yaml_lines.push(cleaned);
                }
            }
        }
    }

    let yaml_block = yaml_lines.join("\n");
    if trimmed_body.is_empty() {
        format!("---\n{}\n---\n", yaml_block)
    } else {
        format!("---\n{}\n---\n\n{}\n", yaml_block, trimmed_body)
    }
}

/// Converts a slice of `MarkdownBlock` nodes back into canonical Markdown body text.
pub fn blocks_to_markdown(blocks: &[MarkdownBlock]) -> String {
    blocks
        .iter()
        .map(|block| match block {
            MarkdownBlock::Heading { level, text } => {
                let prefix = "#".repeat((*level as usize).clamp(1, 6));
                format!("{} {}", prefix, text.trim())
            }
            MarkdownBlock::SceneBreak => "***".to_string(),
            MarkdownBlock::AuthorNote { text } => {
                format!("> [!GHI_CHÚ_TÁC_GIẢ] {}", text.trim())
            }
            MarkdownBlock::BlockQuote { text } => format!("> {}", text.trim()),
            MarkdownBlock::Paragraph { text, .. } => text.trim().to_string(),
        })
        .collect::<Vec<_>>()
        .join("\n\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lossless_frontmatter_and_blocks_roundtrip() {
        let sample = "---\nid: ch_01\ntitle: Bóng Ma Bên Bến Cảng\npov: Lâm Vũ Linh\n---\n\n# Chương 1: Bóng Ma Bên Bến Cảng\n\nMưa axit rơi tầm tã xuống Bến Cảng Đông.\n\n***\n\n> [!GHI_CHÚ_TÁC_GIẢ] Kiểm tra lại chi tiết ổ khóa Thần Nông.\n\n[Hồi tưởng] Lâm Vũ Linh nhớ lại lời dặn của Chỉ huy Khánh.\n";
        let parsed = parse_markdown_with_frontmatter(sample);
        assert_eq!(parsed.frontmatter_keys_order, vec!["id", "title", "pov"]);
        assert_eq!(parsed.headings, vec!["Chương 1: Bóng Ma Bên Bến Cảng"]);
        assert_eq!(parsed.blocks.len(), 5);
        assert_eq!(parsed.blocks[2], MarkdownBlock::SceneBreak);

        let rebuilt_body = blocks_to_markdown(&parsed.blocks);
        let reserialized = serialize_markdown_with_ordered_frontmatter(
            &parsed.frontmatter,
            &parsed.frontmatter_keys_order,
            &rebuilt_body,
        );
        let reparsed = parse_markdown_with_frontmatter(&reserialized);
        assert_eq!(reparsed.frontmatter_keys_order, parsed.frontmatter_keys_order);
        assert_eq!(reparsed.blocks, parsed.blocks);
        assert_eq!(reparsed.word_count, parsed.word_count);
    }

    #[test]
    fn test_invalid_yaml_frontmatter_keeps_keys_and_order() {
        let sample = "---\nid: ch_01\ntitle: \"Bóng\norder: 1\n---\n\nNội dung.";
        let parsed = parse_markdown_with_frontmatter(sample);
        assert_eq!(parsed.frontmatter_keys_order, vec!["id", "title", "order"]);
        assert_eq!(
            parsed.frontmatter.get("id").and_then(|v| v.as_str()),
            Some("ch_01")
        );
        assert_eq!(
            parsed.frontmatter.get("order").and_then(|v| v.as_i64()),
            Some(1)
        );
    }

    #[test]
    fn test_headings_and_custom_keys_survive_save_roundtrip() {
        let sample = "---\nid: ch_01\ntitle: Mở đầu\nweather: \"Mưa axit\"\n---\n\n# Chương 1: Mở đầu\n\nMưa rơi.\n\n***\n\n## Cảnh 2\n\nĐoạn hai.";
        let parsed = parse_markdown_with_frontmatter(sample);
        assert_eq!(parsed.frontmatter_keys_order, vec!["id", "title", "weather"]);

        let body = blocks_to_markdown(&parsed.blocks);
        assert!(body.contains("# Chương 1: Mở đầu"));
        assert!(body.contains("## Cảnh 2"));
        assert!(body.contains("***"));

        let reserialized = serialize_markdown_with_ordered_frontmatter(
            &parsed.frontmatter,
            &parsed.frontmatter_keys_order,
            &body,
        );
        let reparsed = parse_markdown_with_frontmatter(&reserialized);
        assert_eq!(reparsed.frontmatter_keys_order, parsed.frontmatter_keys_order);
        assert_eq!(reparsed.blocks, parsed.blocks);
        assert_eq!(
            reparsed.frontmatter.get("weather").and_then(|v| v.as_str()),
            Some("Mưa axit")
        );
    }
}
