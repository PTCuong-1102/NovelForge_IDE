import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsedToChapter,
  chapterToFrontmatter,
  parsedToEntity,
  entityToFrontmatter,
} from '../project-io';

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
});
