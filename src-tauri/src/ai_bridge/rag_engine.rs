use crate::core_engine::indexer::is_sqlite_vec_virtual_table_active;
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub const EMBEDDING_DIM: usize = 768;

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

/// Encodes a `&[f32]` vector into little-endian bytes compatible with `sqlite-vec` `FLOAT[768]`.
pub fn encode_f32_vec_le(vec: &[f32]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(vec.len() * 4);
    for &val in vec {
        bytes.extend_from_slice(&val.to_le_bytes());
    }
    bytes
}

/// Decodes a little-endian `BLOB` from SQLite (`sqlite-vec` format) back into `Vec<f32>`.
pub fn decode_f32_vec_le(bytes: &[u8]) -> Vec<f32> {
    bytes
        .as_chunks::<4>()
        .0
        .iter()
        .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
        .collect()
}

/// Generates a deterministic, L2-normalized 768-dimensional embedding vector (`FLOAT[768]`)
/// from Vietnamese and Latin prose using multi-hash feature projection (word unigrams, word bigrams,
/// and character trigrams). Used for instant local RAG indexing when offline or before external Ollama sync.
pub fn generate_deterministic_embedding_768(text: &str) -> Vec<f32> {
    let mut vec = vec![0.0f32; EMBEDDING_DIM];
    let normalized = text.to_lowercase();
    let words: Vec<&str> = normalized
        .split_whitespace()
        .map(|w| w.trim_matches(|c: char| c.is_ascii_punctuation()))
        .filter(|w| !w.is_empty())
        .collect();

    if words.is_empty() {
        return vec;
    }

    // 1. Project word unigrams with higher weight
    for word in &words {
        project_feature(&mut vec, word.as_bytes(), 1.6);
    }

    // 2. Project word bigrams (captures Vietnamese compound nouns like "lâm vũ linh", "bến cảng")
    for pair in words.windows(2) {
        let bigram = format!("{}_{}", pair[0], pair[1]);
        project_feature(&mut vec, bigram.as_bytes(), 2.2);
    }

    // 3. Project character trigrams for morphological / fuzzy resilience
    let chars: Vec<char> = normalized.chars().collect();
    for tri in chars.windows(3) {
        let s: String = tri.iter().collect();
        project_feature(&mut vec, s.as_bytes(), 0.5);
    }

    // L2 normalize to unit sphere
    let norm: f32 = vec.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm > 0.0 {
        for v in &mut vec {
            *v /= norm;
        }
    }

    vec
}

fn project_feature(vec: &mut [f32], token_bytes: &[u8], weight: f32) {
    let mut hasher = Sha256::new();
    hasher.update(token_bytes);
    let digest = hasher.finalize();

    // Project onto 4 coordinates per feature using signed random projection
    for slot in 0..4 {
        let base = slot * 4;
        let raw_idx = u16::from_le_bytes([digest[base], digest[base + 1]]) as usize;
        let sign = if digest[base + 2] & 1 == 0 { 1.0 } else { -1.0 };
        let coord = raw_idx % EMBEDDING_DIM;
        vec[coord] += sign * weight;
    }
}

/// Computes a normalized BM25-style lexical relevance score in `[0.0, 1.0]`.
pub fn compute_bm25_lexical_score(query: &str, title: &str, text: &str) -> f32 {
    let q_lower = query.to_lowercase();
    let q_terms: Vec<&str> = q_lower
        .split_whitespace()
        .map(|w| w.trim_matches(|c: char| c.is_ascii_punctuation()))
        .filter(|w| !w.is_empty())
        .collect();

    if q_terms.is_empty() {
        return 0.0;
    }

    let title_lower = title.to_lowercase();
    let text_lower = text.to_lowercase();

    let mut matched_terms = 0.0f32;
    for &term in &q_terms {
        let in_title = title_lower.contains(term);
        let occurrences = text_lower.matches(term).count() as f32;
        if in_title || occurrences > 0.0 {
            let tf_score = (occurrences * 2.2) / (occurrences + 1.2);
            let title_boost = if in_title { 1.5 } else { 0.0 };
            matched_terms += (tf_score + title_boost).min(2.0);
        }
    }

    let exact_phrase_boost = if text_lower.contains(&q_lower) || title_lower.contains(&q_lower) {
        0.25
    } else {
        0.0
    };

    ((matched_terms / (q_terms.len() as f32 * 1.5)) + exact_phrase_boost).clamp(0.0, 1.0)
}

/// Upserts a text chunk and its 768-dim embedding into SQLite (`lore_embeddings_store` + `sqlite-vec` `lore_embeddings`).
pub fn upsert_rag_chunk(
    conn: &Connection,
    chunk_id: &str,
    entity_id: &str,
    title: &str,
    entity_type: &str,
    chunk_text: &str,
    custom_embedding: Option<Vec<f32>>,
) -> Result<()> {
    let embedding = custom_embedding.unwrap_or_else(|| generate_deterministic_embedding_768(
        &format!("{} {}", title, chunk_text),
    ));
    let blob = encode_f32_vec_le(&embedding);

    conn.execute(
        "INSERT INTO lore_embeddings_store (chunk_id, entity_id, title, entity_type, chunk_text, embedding_blob, embedding_dim, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, CURRENT_TIMESTAMP)
         ON CONFLICT(chunk_id) DO UPDATE SET
            entity_id = excluded.entity_id,
            title = excluded.title,
            entity_type = excluded.entity_type,
            chunk_text = excluded.chunk_text,
            embedding_blob = excluded.embedding_blob,
            embedding_dim = excluded.embedding_dim,
            updated_at = CURRENT_TIMESTAMP",
        params![
            chunk_id,
            entity_id,
            title,
            entity_type,
            chunk_text,
            blob,
            embedding.len() as i64,
        ],
    )?;

    if is_sqlite_vec_virtual_table_active(conn) {
        let _ = conn.execute(
            "INSERT OR REPLACE INTO lore_embeddings (chunk_id, entity_id, embedding) VALUES (?1, ?2, ?3)",
            params![chunk_id, entity_id, blob],
        );
    }

    Ok(())
}

/// Performs Hybrid Search (`BM25` + `sqlite-vec` 768-dim cosine similarity) across indexed Lorebook & Manuscript chunks.
pub fn hybrid_search_lore_sqlite(
    conn: &Connection,
    query: &str,
    entity_type_filter: Option<&str>,
    top_k: usize,
) -> Result<Vec<RagSearchResult>> {
    let query_vec = generate_deterministic_embedding_768(query);

    let mut stmt = conn.prepare(
        "SELECT chunk_id, entity_id, title, entity_type, chunk_text, embedding_blob
         FROM lore_embeddings_store",
    )?;

    let rows = stmt.query_map([], |row| {
        let chunk_id: String = row.get(0)?;
        let entity_id: String = row.get(1)?;
        let title: String = row.get(2)?;
        let entity_type: String = row.get(3)?;
        let chunk_text: String = row.get(4)?;
        let blob: Vec<u8> = row.get(5)?;
        Ok((chunk_id, entity_id, title, entity_type, chunk_text, blob))
    })?;

    let mut scored = Vec::new();
    for r in rows.flatten() {
        let (chunk_id, entity_id, title, entity_type, chunk_text, blob) = r;
        if let Some(filter_type) = entity_type_filter {
            if filter_type != "all" && !filter_type.is_empty() && entity_type != filter_type {
                continue;
            }
        }

        let stored_vec = decode_f32_vec_le(&blob);
        let vec_sim = cosine_similarity(&query_vec, &stored_vec).max(0.0);
        let bm25_sim = compute_bm25_lexical_score(query, &title, &chunk_text);

        // Hybrid score fusion: 55% semantic vector similarity + 45% BM25 lexical relevance
        let combined_score = (0.55 * vec_sim + 0.45 * bm25_sim).clamp(0.0, 0.99);
        if combined_score > 0.01 {
            scored.push(RagSearchResult {
                chunk_id,
                entity_id,
                title,
                entity_type,
                snippet: chunk_text,
                score: (combined_score * 100.0).round() / 100.0,
            });
        }
    }

    scored.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    scored.truncate(top_k.max(1));

    Ok(scored)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core_engine::indexer::init_sqlite_db;

    #[test]
    fn test_sqlite_vec_hybrid_rag_search() {
        let temp_path = std::env::temp_dir().join("novelforge_rag_test.sqlite");
        let _ = std::fs::remove_file(&temp_path);
        let conn = init_sqlite_db(&temp_path).expect("init sqlite");

        upsert_rag_chunk(
            &conn,
            "chunk_linh_01",
            "char_linh_001",
            "Lâm Vũ Linh",
            "character",
            "Đặc vụ số 7 của Cục An ninh Mạng, sở hữu cổ tay cơ khí sinh học và mái tóc ngắn ngang vai.",
            None,
        )
        .unwrap();

        upsert_rag_chunk(
            &conn,
            "chunk_port_01",
            "loc_east_port",
            "Bến Cảng Đông",
            "location",
            "Khu cảng công nghiệp bỏ hoang ngập mưa axit ở rìa phía đông thành phố.",
            None,
        )
        .unwrap();

        let results =
            hybrid_search_lore_sqlite(&conn, "Lâm Vũ Linh cổ tay cơ khí", Some("character"), 5)
                .unwrap();
        assert!(!results.is_empty());
        assert_eq!(results[0].entity_id, "char_linh_001");
        let _ = std::fs::remove_file(&temp_path);
    }
}
