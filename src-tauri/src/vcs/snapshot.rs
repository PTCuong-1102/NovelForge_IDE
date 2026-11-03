use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorySnapshot {
    pub id: String,
    pub branch_name: String, // "main" or What-If Timeline branch
    pub label: String,
    pub timestamp: String,
    pub word_count_delta: i32,
    pub total_words: usize,
}

#[tauri::command]
pub fn create_snapshot(branch_name: String, label: String, total_words: usize) -> StorySnapshot {
    StorySnapshot {
        id: format!("snap-{}", chrono::Utc::now().timestamp_millis()),
        branch_name,
        label,
        timestamp: chrono::Utc::now().to_rfc3339(),
        word_count_delta: 0,
        total_words,
    }
}

#[tauri::command]
pub fn list_snapshots() -> Vec<StorySnapshot> {
    vec![StorySnapshot {
        id: "snap-init".to_string(),
        branch_name: "main".to_string(),
        label: "Khởi tạo bản thảo Hồi 1".to_string(),
        timestamp: "2026-11-03T20:00:00Z".to_string(),
        word_count_delta: 3420,
        total_words: 3420,
    }]
}
