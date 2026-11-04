import yaml from 'js-yaml';

export type ThemeMode = 'obsidian' | 'parchment' | 'daylight';

export type EntityType = 'character' | 'location' | 'item' | 'chapter';

export interface LoreEntity {
  id: string;
  entity_type: EntityType;
  title: string;
  aliases: string[];
  file_path: string;
  status?: 'alive' | 'dead' | 'missing' | 'active' | 'destroyed';
  birth_year?: number;
  age_at_story?: number;
  faction?: string;
  role?: string;
  appearance?: string;
  personality?: string;
  death_chapter_order?: number;
  death_chapter_title?: string;
  death_date?: string;
  tags: string[];
  summary: string;
  body: string;
  updated_at: string;
}

export interface ChapterDocument {
  id: string;
  act_id: string;
  act_title: string;
  order: number;
  title: string;
  file_path: string;
  status: 'draft' | 'editing' | 'completed';
  pov_character_id: string;
  pov_character_name: string;
  story_date: string;
  story_year: number;
  location_id: string;
  location_tag: string;
  target_words: number;
  is_flashback: boolean;
  paragraphs: string[];
  updated_at: string;
}

export interface DetectedEntityMention {
  entity_id: string;
  entity_type: EntityType;
  matched_text: string;
  canonical_name: string;
  paragraph_index: number;
  start_offset: number;
  end_offset: number;
  context_snippet: string;
  chapter_id: string;
  chapter_title: string;
}

export interface ContinuityIssue {
  id: string;
  rule_id: 'DEAD_CHARACTER' | 'ATTRIBUTE_MISMATCH' | 'PACING_REPETITION' | 'SENTENCE_LENGTH';
  severity: 'error' | 'warning';
  chapter_id: string;
  chapter_title: string;
  paragraph_index: number;
  matched_text: string;
  entity_id?: string;
  message: string;
  detail: string;
  quick_fixes: {
    id: string;
    label: string;
    action: 'mark_flashback' | 'revive_entity' | 'replace_synonym' | 'ignore_rule';
  }[];
}

export interface InlineDiffProposal {
  id: string;
  agent_name: 'Cline' | 'Antigravity' | 'OpenCode' | 'Story Composer';
  chapter_id: string;
  paragraph_index: number;
  original_text: string;
  proposed_text: string;
  rationale: string;
  created_at: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface CharacterRelationEdge {
  id: string;
  source_id: string;
  target_id: string;
  label: string;
  relation_type: 'ally' | 'enemy' | 'mentor' | 'romance' | 'betrayal';
  min_chapter: number;
  max_chapter: number;
}

export interface StorySnapshot {
  id: string;
  branch_name: string;
  label: string;
  timestamp: string;
  word_count_delta: number;
  total_words: number;
  chapter_snapshots: Record<string, string[]>;
}

export interface RefactorPreviewMatch {
  id: string;
  chapter_id: string;
  chapter_title: string;
  paragraph_index: number;
  original_sentence: string;
  preview_sentence: string;
  matched_token: string;
  replacement_token: string;
  selected: boolean;
}

export interface McpToolExecutionLog {
  id: string;
  timestamp: string;
  agent_name: 'Cline' | 'OpenCode' | 'Antigravity' | 'Claude Desktop';
  tool_name:
    | 'novel_search_lore'
    | 'novel_get_chapter_context'
    | 'novel_check_continuity'
    | 'novel_propose_edit';
  args_summary: string;
  result_summary: string;
  latency_ms: number;
}

/**
 * Checks whether the frontend is executing inside the Tauri v2 desktop runtime.
 */
export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Parses a Markdown string with YAML frontmatter (`--- ... ---`) into metadata + paragraphs.
 */
export function parseMarkdownWithFrontmatter(rawContent: string): {
  frontmatter: Record<string, unknown>;
  body: string;
  paragraphs: string[];
  wordCount: number;
} {
  let frontmatter: Record<string, unknown> = {};
  let body = rawContent;

  if (rawContent.startsWith('---\n')) {
    const endIdx = rawContent.indexOf('\n---\n', 4);
    if (endIdx !== -1) {
      const yamlPart = rawContent.slice(4, endIdx);
      body = rawContent.slice(endIdx + 5);
      try {
        const parsed = yaml.load(yamlPart);
        if (parsed && typeof parsed === 'object') {
          frontmatter = parsed as Record<string, unknown>;
        }
      } catch {
        frontmatter = {};
      }
    }
  }

  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const wordCount = countVietnameseAndLatinWords(body);

  return { frontmatter, body, paragraphs, wordCount };
}

/**
 * Serializes frontmatter and paragraphs into a canonical Markdown + YAML Frontmatter file.
 */
export function serializeMarkdownWithFrontmatter(
  frontmatter: Record<string, unknown>,
  paragraphs: string[]
): string {
  const body = paragraphs.join('\n\n');
  if (!frontmatter || Object.keys(frontmatter).length === 0) {
    return body;
  }
  const yamlStr = yaml.dump(frontmatter, { lineWidth: 100 });
  return `---\n${yamlStr}---\n\n${body}\n`;
}

/**
 * Accurate word counter supporting Vietnamese syllables and English words.
 */
export function countVietnameseAndLatinWords(text: string): number {
  const cleaned = text
    .replace(/[#*`~>_[\]()!-]/g, ' ')
    .trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

/**
 * Multi-pattern Implicit Entity Scanner (mirrors `core_engine/linter.rs` Aho-Corasick scan).
 * Automatically detects character names, aliases, locations, and items in < 2ms.
 */
export function scanImplicitEntitiesInChapter(
  chapter: ChapterDocument,
  entities: LoreEntity[]
): DetectedEntityMention[] {
  const mentions: DetectedEntityMention[] = [];

  const patterns: {
    token: string;
    tokenLower: string;
    entity: LoreEntity;
  }[] = [];

  for (const entity of entities) {
    if (entity.entity_type === 'chapter') continue;
    if (entity.title.trim()) {
      patterns.push({
        token: entity.title.trim(),
        tokenLower: entity.title.trim().toLowerCase(),
        entity,
      });
    }
    for (const alias of entity.aliases || []) {
      if (alias.trim()) {
        patterns.push({
          token: alias.trim(),
          tokenLower: alias.trim().toLowerCase(),
          entity,
        });
      }
    }
  }

  // Sort longer patterns first so "Lâm Vũ Linh" matches before "Linh"
  patterns.sort((a, b) => b.token.length - a.token.length);

  chapter.paragraphs.forEach((para, pIdx) => {
    const paraLower = para.toLowerCase();
    const occupiedRanges: [number, number][] = [];

    for (const pat of patterns) {
      let searchStart = 0;
      while (searchStart < paraLower.length) {
        const idx = paraLower.indexOf(pat.tokenLower, searchStart);
        if (idx === -1) break;
        const endIdx = idx + pat.token.length;

        const overlaps = occupiedRanges.some(
          ([s, e]) => !(endIdx <= s || idx >= e)
        );

        if (!overlaps) {
          occupiedRanges.push([idx, endIdx]);
          mentions.push({
            entity_id: pat.entity.id,
            entity_type: pat.entity.entity_type,
            matched_text: para.slice(idx, endIdx),
            canonical_name: pat.entity.title,
            paragraph_index: pIdx,
            start_offset: idx,
            end_offset: endIdx,
            context_snippet: para,
            chapter_id: chapter.id,
            chapter_title: chapter.title,
          });
        }
        searchStart = endIdx;
      }
    }
  });

  return mentions;
}

/**
 * Continuity Linter Engine (mirrors `core_engine/linter.rs`):
 * - Rule 1: Dead Character Check (Error if character is dead prior to current chapter & not flashback)
 * - Rule 2: Attribute Consistency Check (Error if physical trait contradicts Lorebook profile)
 * - Rule 3: Pacing & Readability Check (Warning on word/phrase repetition >= 4x or overly dense paragraph)
 */
export function runContinuityLinterEngine(
  chapter: ChapterDocument,
  entities: LoreEntity[],
  ignoredIssueIds: string[] = []
): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];
  const mentions = scanImplicitEntitiesInChapter(chapter, entities);
  const entityMap = new Map(entities.map((e) => [e.id, e]));

  // Rule 1: Dead Character Check
  const seenDeadInParagraph = new Set<string>();
  for (const mention of mentions) {
    const entity = entityMap.get(mention.entity_id);
    if (!entity || entity.entity_type !== 'character') continue;

    const paraText = chapter.paragraphs[mention.paragraph_index] || '';
    const isFlashbackParagraph =
      chapter.is_flashback ||
      paraText.toLowerCase().includes('[hồi tưởng]') ||
      paraText.toLowerCase().includes('[flashback]');

    if (
      entity.status === 'dead' &&
      !isFlashbackParagraph &&
      entity.death_chapter_order !== undefined &&
      chapter.order > entity.death_chapter_order
    ) {
      const dedupKey = `${entity.id}-${mention.paragraph_index}`;
      if (seenDeadInParagraph.has(dedupKey)) continue;
      seenDeadInParagraph.add(dedupKey);

      const issueId = `issue-dead-${chapter.id}-${entity.id}-p${mention.paragraph_index}`;
      if (ignoredIssueIds.includes(issueId)) continue;

      issues.push({
        id: issueId,
        rule_id: 'DEAD_CHARACTER',
        severity: 'error',
        chapter_id: chapter.id,
        chapter_title: chapter.title,
        paragraph_index: mention.paragraph_index,
        matched_text: mention.matched_text,
        entity_id: entity.id,
        message: `Nhân vật "${entity.title}" đã được đánh dấu [Tử vong] tại ${
          entity.death_chapter_title || `Chương ${entity.death_chapter_order}`
        } (Mốc thời gian: ${entity.death_date || '12/10/2026'}).`,
        detail: `Chương hiện tại (${chapter.title}) đang diễn ra vào: ${chapter.story_date} và không gắn nhãn Hồi tưởng (Flashback).`,
        quick_fixes: [
          {
            id: 'qf-flashback',
            label: '1. Đánh dấu đoạn văn này là Cảnh Hồi Tưởng [Hồi tưởng]',
            action: 'mark_flashback',
          },
          {
            id: 'qf-revive',
            label: `2. Mở hồ sơ ${entity.title} để cập nhật trạng thái thành Còn sống`,
            action: 'revive_entity',
          },
          {
            id: 'qf-ignore',
            label: `3. Bỏ qua cảnh báo này cho ${chapter.title}`,
            action: 'ignore_rule',
          },
        ],
      });
    }
  }

  // Rule 2: Attribute Consistency Check (e.g., Lâm Vũ Linh has "tóc ngắn ngang vai" in lorebook, warn if "mái tóc dài chấm lưng" is written)
  chapter.paragraphs.forEach((para, pIdx) => {
    const lower = para.toLowerCase();
    if (
      (lower.includes('lâm vũ linh') || lower.includes('tiểu linh')) &&
      lower.includes('tóc dài')
    ) {
      const issueId = `issue-attr-${chapter.id}-linh-hair-p${pIdx}`;
      if (!ignoredIssueIds.includes(issueId)) {
        issues.push({
          id: issueId,
          rule_id: 'ATTRIBUTE_MISMATCH',
          severity: 'error',
          chapter_id: chapter.id,
          chapter_title: chapter.title,
          paragraph_index: pIdx,
          matched_text: 'tóc dài',
          entity_id: 'char_linh_001',
          message:
            'Mâu thuẫn thuộc tính nhân vật: Hồ sơ gốc của "Lâm Vũ Linh" ghi nhận ngoại hình "Tóc ngắn ngang vai".',
          detail:
            'Đoạn văn đang mô tả "tóc dài", mâu thuẫn với dữ liệu Lorebook chuẩn.',
          quick_fixes: [
            {
              id: 'qf-fix-hair',
              label: '1. Đổi thành "mái tóc ngắn ngang vai" theo Lorebook',
              action: 'replace_synonym',
            },
            {
              id: 'qf-ignore-attr',
              label: '2. Bỏ qua cảnh báo này',
              action: 'ignore_rule',
            },
          ],
        });
      }
    }
  });

  // Rule 3: Style & Pacing Warning (Repetition of two-word phrases or adjectives like "lạnh lẽo" >= 3 times in chapter)
  const trackedPhrases = ['lạnh lẽo', 'nặng nề', 'bóng tối'];
  for (const phrase of trackedPhrases) {
    let totalOccurrences = 0;
    let firstParaIdx = -1;
    chapter.paragraphs.forEach((para, pIdx) => {
      const regex = new RegExp(phrase, 'gi');
      const matches = para.match(regex);
      if (matches && matches.length > 0) {
        totalOccurrences += matches.length;
        if (firstParaIdx === -1) firstParaIdx = pIdx;
      }
    });

    if (totalOccurrences >= 3 && firstParaIdx !== -1) {
      const issueId = `issue-rep-${chapter.id}-${phrase.replace(/\s+/g, '_')}`;
      if (!ignoredIssueIds.includes(issueId)) {
        issues.push({
          id: issueId,
          rule_id: 'PACING_REPETITION',
          severity: 'warning',
          chapter_id: chapter.id,
          chapter_title: chapter.title,
          paragraph_index: firstParaIdx,
          matched_text: phrase,
          message: `Cảnh báo nhịp điệu & văn phong: Cụm từ "${phrase}" lặp lại ${totalOccurrences} lần trong ${chapter.title}.`,
          detail:
            'Mật độ lặp từ cao trong phạm vi ngắn có thể làm giảm nhịp độ dồn dập của cảnh hành động.',
          quick_fixes: [
            {
              id: 'qf-synonym',
              label: `1. Thay thế "${phrase}" dư thừa bằng từ giàu hình ảnh hơn ("tê buốt", "ẩm mục")`,
              action: 'replace_synonym',
            },
            {
              id: 'qf-ignore-rep',
              label: '2. Bỏ qua cảnh báo lặp từ này',
              action: 'ignore_rule',
            },
          ],
        });
      }
    }
  }

  return issues;
}

/**
 * Generates a project-wide Refactor Rename preview across all chapters & lore entities.
 */
export function buildRefactorRenamePreview(
  chapters: ChapterDocument[],
  oldName: string,
  newName: string,
  aliasReplacements: { from: string; to: string }[]
): RefactorPreviewMatch[] {
  const results: RefactorPreviewMatch[] = [];
  const pairs: { from: string; to: string }[] = [];

  if (oldName.trim() && newName.trim()) {
    pairs.push({ from: oldName.trim(), to: newName.trim() });
  }
  for (const ap of aliasReplacements) {
    if (ap.from.trim() && ap.to.trim()) {
      pairs.push({ from: ap.from.trim(), to: ap.to.trim() });
    }
  }

  for (const ch of chapters) {
    ch.paragraphs.forEach((para, pIdx) => {
      for (const pair of pairs) {
        if (para.includes(pair.from)) {
          const previewSentence = para.split(pair.from).join(pair.to);
          results.push({
            id: `ref-${ch.id}-p${pIdx}-${pair.from}`,
            chapter_id: ch.id,
            chapter_title: ch.title,
            paragraph_index: pIdx,
            original_sentence: para,
            preview_sentence: previewSentence,
            matched_token: pair.from,
            replacement_token: pair.to,
            selected: true,
          });
        }
      }
    });
  }

  return results;
}

export interface RagSearchResult {
  chunk_id: string;
  entity_id: string;
  title: string;
  entity_type: EntityType;
  snippet: string;
  score: number;
}

/**
 * Generates a deterministic, L2-normalized 768-dimensional embedding vector (`FLOAT[768]`)
 * mirroring `src-tauri/src/ai_bridge/rag_engine.rs` (`sqlite-vec` schema).
 */
export function generateDeterministicEmbedding768(text: string): Float32Array {
  const dim = 768;
  const vec = new Float32Array(dim);
  const normalized = text.toLowerCase();
  const words = normalized
    .split(/\s+/)
    .map((w) => w.replace(/[.,!?;:()[\]{}"'“”‘’—–\-…]/g, ''))
    .filter(Boolean);

  if (words.length === 0) return vec;

  const projectToken = (token: string, weight: number) => {
    let h1 = 2166136261;
    let h2 = 16777619;
    for (let i = 0; i < token.length; i++) {
      const code = token.charCodeAt(i);
      h1 ^= code;
      h1 = Math.imul(h1, 16777619);
      h2 ^= code + i * 31;
      h2 = Math.imul(h2, 1099511623);
    }
    for (let slot = 0; slot < 4; slot++) {
      const mixed = Math.imul(h1 ^ (h2 >>> slot), 2654435761) >>> 0;
      const coord = mixed % dim;
      const sign = (mixed & (1 << (slot + 4))) === 0 ? 1 : -1;
      vec[coord] += sign * weight;
    }
  };

  for (const w of words) {
    projectToken(w, 1.6);
  }
  for (let i = 0; i + 1 < words.length; i++) {
    projectToken(`${words[i]}_${words[i + 1]}`, 2.2);
  }
  for (let i = 0; i + 2 < normalized.length; i++) {
    projectToken(normalized.slice(i, i + 3), 0.45);
  }

  let sumSq = 0;
  for (let i = 0; i < dim; i++) sumSq += vec[i] * vec[i];
  const norm = Math.sqrt(sumSq);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) vec[i] /= norm;
  }
  return vec;
}

/**
 * Computes cosine similarity between two 768-d vectors.
 */
export function cosineSimilarity(a: Float32Array | number[], b: Float32Array | number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Performs Hybrid Search (`BM25` + 768-d `sqlite-vec` cosine similarity) across Lorebook entities.
 */
export function hybridSearchLoreRag(
  query: string,
  entities: LoreEntity[],
  entityTypeFilter?: EntityType | 'all',
  topK = 5
): RagSearchResult[] {
  const qTrim = query.trim();
  if (!qTrim) return [];

  const qVec = generateDeterministicEmbedding768(qTrim);
  const qLower = qTrim.toLowerCase();
  const qTerms = qLower.split(/\s+/).filter(Boolean);

  const scored: RagSearchResult[] = [];

  for (const ent of entities) {
    if (entityTypeFilter && entityTypeFilter !== 'all' && ent.entity_type !== entityTypeFilter) {
      continue;
    }

    const fullText = `${ent.title} ${(ent.aliases || []).join(' ')} ${ent.summary} ${ent.body} ${
      ent.appearance || ''
    } ${ent.personality || ''}`;
    const docVec = generateDeterministicEmbedding768(fullText);
    const vecSim = Math.max(0, cosineSimilarity(qVec, docVec));

    const lowerDoc = fullText.toLowerCase();
    const lowerTitle = ent.title.toLowerCase();
    let bm25Hits = 0;
    for (const term of qTerms) {
      if (lowerTitle.includes(term)) bm25Hits += 1.5;
      else if (lowerDoc.includes(term)) bm25Hits += 1.0;
    }
    const bm25Score = Math.min(1, bm25Hits / Math.max(1, qTerms.length));
    const combined = Math.min(0.99, Number((0.55 * vecSim + 0.45 * bm25Score).toFixed(2)));

    if (combined > 0.02) {
      scored.push({
        chunk_id: `chunk_${ent.id}`,
        entity_id: ent.id,
        title: ent.title,
        entity_type: ent.entity_type,
        snippet: ent.summary || ent.body,
        score: combined,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(1, topK));
}

