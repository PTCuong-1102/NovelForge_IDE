import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseMarkdownWithFrontmatter,
  serializeMarkdownWithFrontmatter,
  countVietnameseAndLatinWords,
  scanImplicitEntitiesInChapter,
  runContinuityLinterEngine,
  buildRefactorRenamePreview,
  generateDeterministicEmbedding768,
  cosineSimilarity,
  hybridSearchLoreRag,
  ChapterDocument,
  LoreEntity,
} from '../tauri-bridge.js';
import {
  paragraphsToTipTapDoc,
  tipTapDocToParagraphs,
  serializeChapterToLosslessMarkdown,
  parseLosslessMarkdownToChapter,
} from '../../components/editor/extensions/lossless-markdown.js';
import { buildContextualGhostSuggestion } from '../../components/editor/extensions/ghost-text.js';

describe('NovelForge Core Literature Engine Tests', () => {
  const sampleMarkdown = `---
id: "char_linh_001"
title: "Lâm Vũ Linh"
status: "alive"
---

# Tiểu sử nhân vật

Lâm Vũ Linh là cựu đặc vụ giải mã tín hiệu.
`;

  it('1. Parses Markdown with YAML Frontmatter correctly', () => {
    const parsed = parseMarkdownWithFrontmatter(sampleMarkdown);
    assert.strictEqual(parsed.frontmatter.id, 'char_linh_001');
    assert.strictEqual(parsed.frontmatter.title, 'Lâm Vũ Linh');
    assert.strictEqual(parsed.frontmatter.status, 'alive');
    assert.strictEqual(parsed.paragraphs.length, 2);
    assert(parsed.wordCount > 5);
  });

  it('2. Serializes Markdown and Frontmatter losslessly', () => {
    const parsed = parseMarkdownWithFrontmatter(sampleMarkdown);
    const serialized = serializeMarkdownWithFrontmatter(
      parsed.frontmatter,
      parsed.paragraphs
    );
    assert(serialized.includes('char_linh_001'));
    assert(serialized.includes('Lâm Vũ Linh'));
  });

  it('3. Counts Vietnamese and Latin words accurately', () => {
    const text = 'Mưa như trút nước xuống Bến Cảng Đông.';
    const count = countVietnameseAndLatinWords(text);
    assert.strictEqual(count, 8);
  });

  const mockEntities: LoreEntity[] = [
    {
      id: 'char_linh_001',
      entity_type: 'character',
      title: 'Lâm Vũ Linh',
      aliases: ['Tiểu Linh', 'Đặc vụ số 7'],
      file_path: 'lorebook/characters/linh.md',
      status: 'alive',
      tags: ['hacker', 'nhân vật chính'],
      summary: 'Cựu đặc vụ giải mã tín hiệu của Cục An ninh Mạng, sở hữu cổ tay cơ khí.',
      body: 'Lâm Vũ Linh có mái tóc ngắn ngang vai và thiết bị giải mã lượng tử.',
      updated_at: '',
    },
    {
      id: 'char_hao_002',
      entity_type: 'character',
      title: 'Trần Hạo',
      aliases: ['Hạo Đen'],
      file_path: 'lorebook/characters/hao.md',
      status: 'dead',
      death_chapter_order: 5,
      death_chapter_title: 'Chương 5: Huyết Chiến',
      death_date: '12/10/2026',
      tags: [],
      summary: 'Đặc vụ tiền trạm hy sinh tại Chương 5.',
      body: '',
      updated_at: '',
    },
    {
      id: 'loc_cang_dong',
      entity_type: 'location',
      title: 'Bến Cảng Đông',
      aliases: ['Cảng Đông'],
      file_path: 'lorebook/locations/cang-dong.md',
      status: 'active',
      tags: [],
      summary: 'Khu cảng công nghiệp bỏ hoang ngập mưa axit.',
      body: '',
      updated_at: '',
    },
    {
      id: 'item_than_nong',
      entity_type: 'item',
      title: 'Ổ Khóa Lượng Tử Thần Nông',
      aliases: ['Lõi Thần Nông'],
      file_path: 'lorebook/items/than-nong.md',
      status: 'active',
      tags: [],
      summary: 'Thiết bị mã hóa tối mật.',
      body: '',
      updated_at: '',
    },
  ];

  const mockChapter8: ChapterDocument = {
    id: 'ch_08',
    act_id: 'act_01',
    act_title: 'Hồi 1',
    order: 8,
    title: 'Chương 8: Đêm Mưa Tại Bến Cảng',
    file_path: 'manuscript/act-01/ch-08.md',
    status: 'editing',
    pov_character_id: 'char_linh_001',
    pov_character_name: 'Lâm Vũ Linh',
    story_date: '15/10/2026',
    story_year: 2026,
    location_id: 'loc_cang_dong',
    location_tag: '#Bến_Cảng_Đông',
    target_words: 4000,
    is_flashback: false,
    paragraphs: [
      'Gió lạnh lẽo thổi qua bến cảng lạnh lẽo giữa đêm lạnh lẽo.',
      'Lâm Vũ Linh rút súng khi thấy Trần Hạo bước ra từ bóng tối.',
      '***',
      '> [!GHI_CHÚ_TÁC_GIẢ] Kiểm tra lại chi tiết **Lõi Thần Nông** và *tín hiệu ngầm*.',
    ],
    updated_at: '',
  };

  it('4. Scans implicit entity mentions without manual @ prefix', () => {
    const mentions = scanImplicitEntitiesInChapter(mockChapter8, mockEntities);
    assert(mentions.some((m) => m.canonical_name === 'Lâm Vũ Linh'));
    assert(mentions.some((m) => m.canonical_name === 'Trần Hạo'));
  });

  it('5. Continuity Linter detects Rule 1 (Dead Character Plot Hole)', () => {
    const issues = runContinuityLinterEngine(mockChapter8, mockEntities);
    const deadCharIssue = issues.find((i) => i.rule_id === 'DEAD_CHARACTER');
    assert(deadCharIssue !== undefined, 'Should detect dead character Trần Hạo');
    assert.strictEqual(deadCharIssue?.severity, 'error');
    assert(deadCharIssue?.message.includes('Chương 5'));
  });

  it('6. Continuity Linter detects Rule 3 (Pacing repetition of phrase)', () => {
    const issues = runContinuityLinterEngine(mockChapter8, mockEntities);
    const repIssue = issues.find((i) => i.rule_id === 'PACING_REPETITION');
    assert(repIssue !== undefined, 'Should detect repeated word "lạnh lẽo"');
    assert.strictEqual(repIssue?.severity, 'warning');
  });

  it('7. Safe Literary Refactoring generates cross-chapter sentence previews', () => {
    const previews = buildRefactorRenamePreview(
      [mockChapter8],
      'Lâm Vũ Linh',
      'Lâm Hạ Vy',
      [{ from: 'Tiểu Linh', to: 'Tiểu Vy' }]
    );
    assert.strictEqual(previews.length, 1);
    assert.strictEqual(previews[0].matched_token, 'Lâm Vũ Linh');
    assert(previews[0].preview_sentence.includes('Lâm Hạ Vy'));
  });

  it('8. Lossless Bi-Directional TipTap / ProseMirror <-> Markdown Serialization', () => {
    const doc = paragraphsToTipTapDoc(mockChapter8.paragraphs);
    assert.strictEqual(doc.type, 'doc');
    assert.strictEqual(doc.content?.length, 4);

    const roundTripParagraphs = tipTapDocToParagraphs(doc);
    assert.deepStrictEqual(roundTripParagraphs, mockChapter8.paragraphs);

    const fullMd = serializeChapterToLosslessMarkdown(mockChapter8);
    const reparsed = parseLosslessMarkdownToChapter(fullMd);
    assert.deepStrictEqual(reparsed.paragraphs, mockChapter8.paragraphs);
    assert.strictEqual(reparsed.frontmatter.id, 'ch_08');
    assert.strictEqual(reparsed.frontmatterKeysOrder[0], 'id');
  });

  it('9. SQLite-vec 768-d Vector Embedding & Hybrid Lorebook RAG Search', () => {
    const vecA = generateDeterministicEmbedding768('Lâm Vũ Linh cổ tay cơ khí giải mã');
    const vecB = generateDeterministicEmbedding768('Lâm Vũ Linh thiết bị giải mã cơ khí');
    const vecC = generateDeterministicEmbedding768('Bến cảng công nghiệp mưa axit');

    assert.strictEqual(vecA.length, 768);
    const simAB = cosineSimilarity(vecA, vecB);
    const simAC = cosineSimilarity(vecA, vecC);
    assert(simAB > simAC, 'Related character query should have higher cosine similarity');

    const ragResults = hybridSearchLoreRag(
      'Lâm Vũ Linh giải mã tín hiệu',
      mockEntities,
      'character'
    );
    assert(ragResults.length > 0);
    assert.strictEqual(ragResults[0].entity_id, 'char_linh_001');
  });

  it('10. AI Ghost Text generates context-aware Lorebook-grounded continuations', () => {
    const paraWithItem = 'Tiểu Linh mở hộp chứa Ổ Khóa Lượng Tử Thần Nông.';
    const ghost0 = buildContextualGhostSuggestion(
      paraWithItem,
      mockChapter8,
      mockEntities,
      0
    );
    const ghost1 = buildContextualGhostSuggestion(
      paraWithItem,
      mockChapter8,
      mockEntities,
      1
    );
    assert(ghost0.includes('Ổ Khóa Lượng Tử Thần Nông'));
    assert(ghost1.includes('Ổ Khóa Lượng Tử Thần Nông'));
    assert.notStrictEqual(ghost0, ghost1, 'Cycling variantIndex should return distinct suggestion');
  });

  it('11. Real manuscript files round-trip through the parser losslessly', () => {
    const manuscriptDir = path.join(process.cwd(), 'manuscript', 'act-01');
    const files = fs
      .readdirSync(manuscriptDir)
      .filter((f) => f.endsWith('.md'));
    assert(files.length > 0, 'expected at least one manuscript chapter');

    for (const file of files) {
      const raw = fs.readFileSync(path.join(manuscriptDir, file), 'utf8');
      const parsed = parseMarkdownWithFrontmatter(raw);

      // Frontmatter must carry the chapter identity declared in the repo data.
      assert(parsed.frontmatter.id, `missing id in ${file}`);
      assert(parsed.frontmatter.title, `missing title in ${file}`);

      // Body must contain readable Vietnamese prose.
      const words = countVietnameseAndLatinWords(parsed.body);
      assert(words > 20, `suspiciously low word count (${words}) in ${file}`);

      // Round-trip: serialize (paragraphs) then parse again — content must survive.
      const reparsed = parseMarkdownWithFrontmatter(
        serializeMarkdownWithFrontmatter(
          parsed.frontmatter as Record<string, unknown>,
          parsed.paragraphs
        )
      );
      assert.deepStrictEqual(
        reparsed.frontmatter,
        parsed.frontmatter,
        `frontmatter drifted for ${file}`
      );
      assert.deepStrictEqual(
        reparsed.paragraphs.map((p) => p.trim()),
        parsed.paragraphs.map((p) => p.trim()),
        `paragraphs drifted for ${file}`
      );
    }
  });
});
