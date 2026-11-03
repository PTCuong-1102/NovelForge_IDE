use pulldown_cmark::{Event, Options, Parser, Tag, TagEnd};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedDocument {
    pub frontmatter: HashMap<String, serde_json::Value>,
    pub raw_frontmatter: String,
    pub body: String,
    pub word_count: usize,
    pub headings: Vec<String>,
    pub paragraphs: Vec<String>,
}

/// Parses a Markdown document containing optional YAML frontmatter (`--- ... ---`)
/// and extracts structured metadata, paragraphs, headings, and word count.
pub fn parse_markdown_with_frontmatter(raw: &str) -> ParsedDocument {
    let mut frontmatter = HashMap::new();
    let mut raw_frontmatter = String::new();
    let mut body = raw.to_string();

    if let Some(stripped) = raw.strip_prefix("---\n") {
        if let Some(end_idx) = stripped.find("\n---\n") {
            raw_frontmatter = stripped[..end_idx].to_string();
            body = stripped[end_idx + 5..].to_string();
            if let Ok(parsed_yaml) =
                serde_yaml::from_str::<HashMap<String, serde_json::Value>>(&raw_frontmatter)
            {
                frontmatter = parsed_yaml;
            }
        }
    }

    let mut options = Options::empty();
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TABLES);

    let parser = Parser::new_ext(&body, options);
    let mut headings = Vec::new();
    let mut paragraphs = Vec::new();
    let mut current_heading = String::new();
    let mut current_paragraph = String::new();
    let mut in_heading = false;
    let mut in_paragraph = false;

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
            Event::Start(Tag::Paragraph) => {
                in_paragraph = true;
                current_paragraph.clear();
            }
            Event::End(TagEnd::Paragraph) => {
                in_paragraph = false;
                if !current_paragraph.trim().is_empty() {
                    paragraphs.push(current_paragraph.trim().to_string());
                }
            }
            Event::Text(text) | Event::Code(text) => {
                if in_heading {
                    current_heading.push_str(&text);
                }
                if in_paragraph {
                    current_paragraph.push_str(&text);
                }
            }
            Event::SoftBreak | Event::HardBreak => {
                if in_paragraph {
                    current_paragraph.push(' ');
                }
            }
            _ => {}
        }
    }

    let word_count = body
        .split_whitespace()
        .filter(|token| !token.chars().all(|c| c.is_ascii_punctuation()))
        .count();

    ParsedDocument {
        frontmatter,
        raw_frontmatter,
        body,
        word_count,
        headings,
        paragraphs,
    }
}

/// Serializes frontmatter and Markdown body back into a single lossless `.md` file string.
pub fn serialize_markdown_with_frontmatter(
    frontmatter: &HashMap<String, serde_json::Value>,
    body: &str,
) -> String {
    if frontmatter.is_empty() {
        return body.to_string();
    }
    let yaml_str = serde_yaml::to_string(frontmatter).unwrap_or_default();
    format!("---\n{}---\n{}", yaml_str, body)
}
