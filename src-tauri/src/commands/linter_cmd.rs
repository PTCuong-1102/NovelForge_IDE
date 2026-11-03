use crate::core_engine::linter::{
    check_chapter_continuity, scan_implicit_entities, ContinuityDiagnostic, DetectedEntitySpan,
    LoreCharacterSpec,
};

#[tauri::command]
pub async fn run_continuity_linter(
    chapter_order: u32,
    is_flashback: bool,
    chapter_date: String,
    paragraphs: Vec<String>,
    characters: Vec<LoreCharacterSpec>,
) -> Result<Vec<ContinuityDiagnostic>, String> {
    Ok(check_chapter_continuity(
        chapter_order,
        is_flashback,
        &chapter_date,
        &paragraphs,
        &characters,
    ))
}

#[tauri::command]
pub async fn detect_implicit_entities(
    paragraphs: Vec<String>,
    characters: Vec<LoreCharacterSpec>,
) -> Result<Vec<DetectedEntitySpan>, String> {
    Ok(scan_implicit_entities(&paragraphs, &characters))
}
