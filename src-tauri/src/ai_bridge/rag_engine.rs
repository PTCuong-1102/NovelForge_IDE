use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RagSearchResult {
    pub chunk_id: String,
    pub entity_id: String,
    pub title: String,
    pub entity_type: String,
    pub snippet: String,
    pub score: f32,
}

/// Computes cosine similarity between two 768-d or arbitrary-length embedding vectors
/// combined with BM25 lexical boost for Hybrid Search (`novel_search_lore`).
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm_a == 0.0 || norm_b == 0.0 {
        0.0
    } else {
        dot / (norm_a * norm_b)
    }
}
