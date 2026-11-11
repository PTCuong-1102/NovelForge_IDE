import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsedToChapter,
  chapterToFrontmatter,
  parsedToEntity,
  entityToFrontmatter,
  extractRelationsFromEntities,
} from '../project-io';
import { stripAuthorNotes, markdownBlockToHtml } from '../publish/escape-html';
import { runContinuityLinterEngine } from '../tauri-bridge';

describe('Project IO Lossless Round-trip Tests', () => {
  it('1. preserves markdown headings, scene breaks, and custom frontmatter keys on chapter round-trip', () => {
    const rawDoc = {
      frontmatter: {
        id: 'ch_01',
        title: 'Bóng Ma Bên Bến Cảng',
        act_id: 'act_01',
        order: 1,
        pov: 'Lâm Vũ Linh',
        weather: 'Mưa axit',
      },
      frontmatter_keys_order: ['id', 'title', 'act_id', 'order', 'pov', 'weather'],
      body: '# Chương 1: Bóng Ma Bên Bến Cảng\n\nMưa rơi tầm tã.\n\n***\n\n## Phân cảnh 2\n\nĐoạn kết.',
      blocks: [
        { kind: 'heading' as const, level: 1, text: 'Chương 1: Bóng Ma Bên Bến Cảng' },
        { kind: 'paragraph' as const, text: 'Mưa rơi tầm tã.', is_flashback: false },
        { kind: 'scene_break' as const },
        { kind: 'heading' as const, level: 2, text: 'Phân cảnh 2' },
        { kind: 'paragraph' as const, text: 'Đoạn kết.', is_flashback: false },
      ],
    };

    const ch = parsedToChapter('manuscript/act-01/ch-01.md', rawDoc);
    assert.deepEqual(ch.paragraphs, [
      '# Chương 1: Bóng Ma Bên Bến Cảng',
      'Mưa rơi tầm tã.',
      '***',
      '## Phân cảnh 2',
      'Đoạn kết.',
    ]);

    const fm = chapterToFrontmatter(ch);
    assert.equal(fm.pov, 'Lâm Vũ Linh');
    assert.equal(fm.weather, 'Mưa axit');
    assert.deepEqual(ch.frontmatter_keys_order, [
      'id',
      'title',
      'act_id',
      'order',
      'pov',
      'weather',
    ]);
  });

  it('2. preserves custom frontmatter keys on entity round-trip', () => {
    const rawDoc = {
      frontmatter: {
        id: 'char_linh_001',
        type: 'character',
        title: 'Lâm Vũ Linh',
        weapon: 'Súng lục giảm thanh',
      },
      frontmatter_keys_order: ['id', 'type', 'title', 'weapon'],
      body: '# Tiểu sử\n\nĐặc vụ Aegis.',
    };
    const ent = parsedToEntity('lorebook/characters/linh.md', rawDoc);
    const fm = entityToFrontmatter(ent);
    assert.equal(fm.weapon, 'Súng lục giảm thanh');
    assert.deepEqual(ent.frontmatter_keys_order, ['id', 'type', 'title', 'weapon']);
  });

  it('3. keeps standard frontmatter fields out of extra_frontmatter', () => {
    const rawDoc = {
      frontmatter: {
        id: 'ch_01',
        title: 'Mở đầu',
        act_id: 'act_01',
        order: 3,
        status: 'editing',
        weather: 'Mưa axit',
      },
      frontmatter_keys_order: ['id', 'title', 'act_id', 'order', 'status', 'weather'],
      body: 'Mưa rơi.',
    };
    const ch = parsedToChapter('manuscript/act-01/ch-01.md', rawDoc);
    assert.deepEqual(Object.keys(ch.extra_frontmatter ?? {}), ['weather']);
    assert.equal(ch.extra_frontmatter?.weather, 'Mưa axit');
  });

  it('4. falls back to the `pov` key when `pov_character_name` is absent', () => {
    const rawDoc = {
      frontmatter: { id: 'ch_01', title: 'Mở đầu', pov: 'Lâm Vũ Linh' },
      frontmatter_keys_order: ['id', 'title', 'pov'],
      body: 'Mưa rơi.',
    };
    const ch = parsedToChapter('manuscript/act-01/ch-01.md', rawDoc);
    assert.equal(ch.pov_character_name, 'Lâm Vũ Linh');
  });

  it('5. keeps heading lines when the document has no block AST', () => {
    const rawDoc = {
      frontmatter: { id: 'ch_01', title: 'Mở đầu' },
      body: '# Chương 1: Mở đầu\n\nĐoạn một.\n\n***\n\n## Cảnh 2\n\nĐoạn hai.',
    };
    const ch = parsedToChapter('manuscript/act-01/ch-01.md', rawDoc);
    assert.deepEqual(ch.paragraphs, [
      '# Chương 1: Mở đầu',
      'Đoạn một.',
      '***',
      '## Cảnh 2',
      'Đoạn hai.',
    ]);
  });

  it('6. keeps the author note marker byte-identical so it stays strippable', () => {
    const rawDoc = {
      frontmatter: { id: 'ch_01', title: 'Mở đầu' },
      frontmatter_keys_order: ['id', 'title'],
      body: '> [!GHI_CHÚ_TÁC_GIẢ] Kiểm tra lại chi tiết ổ khóa.',
      blocks: [
        {
          kind: 'author_note' as const,
          text: 'Kiểm tra lại chi tiết ổ khóa.',
        },
      ],
    };

    const ch = parsedToChapter('manuscript/act-01/ch-01.md', rawDoc);
    assert.deepEqual(ch.paragraphs, [
      '> [!GHI_CHÚ_TÁC_GIẢ] Kiểm tra lại chi tiết ổ khóa.',
    ]);

    // The publisher must still recognise and drop the note.
    const published = stripAuthorNotes(ch.paragraphs.join('\n\n'));
    assert.ok(
      !published.includes('Kiểm tra lại chi tiết ổ khóa'),
      `author note leaked into the export: ${published}`
    );
  });

  it('7. extracts character relations from entity extra_frontmatter and preserves them on round-trip', () => {
    const rawDoc = {
      frontmatter: {
        id: 'char_linh_001',
        type: 'character',
        title: 'Lâm Vũ Linh',
        relations: [
          {
            id: 'rel-1',
            target_id: 'char_hao_002',
            relation_type: 'ally',
            label: 'Đồng đội cũ',
            min_chapter: 1,
            max_chapter: 12,
          },
        ],
      },
      body: 'Đặc vụ Aegis.',
    };

    const ent = parsedToEntity('lorebook/characters/lam-vu-linh.md', rawDoc);
    const relations = extractRelationsFromEntities([ent]);
    assert.equal(relations.length, 1);
    assert.equal(relations[0].source_id, 'char_linh_001');
    assert.equal(relations[0].target_id, 'char_hao_002');
    assert.equal(relations[0].relation_type, 'ally');
    assert.equal(relations[0].label, 'Đồng đội cũ');
    assert.equal(relations[0].min_chapter, 1);
    assert.equal(relations[0].max_chapter, 12);

    const fm = entityToFrontmatter(ent);
    assert.ok(Array.isArray(fm.relations));
  });

  it('8. markdownBlockToHtml renders paragraphs starting and ending with **bold** as <p> instead of .meta', () => {
    const boldStartEnd = markdownBlockToHtml('**Linh** nhìn về phía **Trần Hạo**');
    assert.equal(
      boldStartEnd,
      '<p><strong>Linh</strong> nhìn về phía <strong>Trần Hạo</strong></p>'
    );

    const multiItalic = markdownBlockToHtml('*Chạy đi!* cô hét lên rồi *lao vào mưa*');
    assert.equal(
      multiItalic,
      '<p><em>Chạy đi!</em> cô hét lên rồi <em>lao vào mưa</em></p>'
    );

    const singleMeta = markdownBlockToHtml('*Cảng Hải Phòng, đêm 12 tháng 10*');
    assert.equal(
      singleMeta,
      '<div class="meta">Cảng Hải Phòng, đêm 12 tháng 10</div>'
    );
  });

  it('9. runContinuityLinterEngine detects single-word repetition (Rule 3A) and long sentences (Rule 3B)', () => {
    const longSentence = Array.from({ length: 68 }, (_, i) => `từ${i}`).join(' ') + '.';
    const chapter = parsedToChapter('manuscript/act-01/ch-01.md', {
      frontmatter: { id: 'ch_01', title: 'Chương 1', order: 1 },
      body: `Bóng đêm buông xuống, bóng đêm bao trùm, bóng đêm nuốt chửng, bóng đêm lạnh giá.\n\n${longSentence}`,
    });

    const issues = runContinuityLinterEngine(chapter, [], []);
    assert.ok(
      issues.some((i) => i.rule_id === 'PACING_REPETITION' && i.matched_text === 'bóng'),
      'expected Rule 3A single-word repetition warning'
    );
    assert.ok(
      issues.some((i) => i.rule_id === 'SENTENCE_LENGTH' && i.paragraph_index === 1),
      'expected Rule 3B sentence length warning (> 65 words)'
    );
  });
});
