import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  parseMarkdownWithFrontmatter,
  serializeMarkdownWithFrontmatter,
  countVietnameseAndLatinWords,
  scanImplicitEntitiesInChapter,
  runContinuityLinterEngine,
  buildRefactorRenamePreview,
  ChapterDocument,
  LoreEntity,
} from '../tauri-bridge.js';

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
      tags: [],
      summary: '',
      body: '',
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
      summary: '',
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
      summary: '',
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
});
