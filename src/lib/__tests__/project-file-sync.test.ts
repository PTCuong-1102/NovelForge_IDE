import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { reconcileIdentifiers, diffDiskIdentifiers } from '../project-file-sync';

describe('External file rename reconciliation', () => {
  it('1. reports the new path of a file that moved on disk', () => {
    const result = reconcileIdentifiers(
      [{ id: 'ch_01', file_path: 'manuscript/act-01/ch-01-khoi-dau.md' }],
      [
        {
          relativePath: 'manuscript/act-02/ch-01-khoi-dau.md',
          id: 'ch_01',
          title: 'Mở đầu',
        },
      ]
    );

    assert.deepEqual(result.filePaths, {
      ch_01: 'manuscript/act-02/ch-01-khoi-dau.md',
    });
    assert.deepEqual(result.mismatches, []);
  });

  it('2. reports a chapter whose file name no longer matches its id', () => {
    const result = reconcileIdentifiers(
      [{ id: 'ch_01', file_path: 'manuscript/act-01/ch-01-khoi-dau.md' }],
      [
        {
          relativePath: 'manuscript/act-01/ch-99-khoi-dau.md',
          id: 'ch_01',
          title: 'Mở đầu',
        },
      ]
    );

    assert.deepEqual(result.mismatches, [
      {
        id: 'ch_01',
        relativePath: 'manuscript/act-01/ch-99-khoi-dau.md',
        idInFileName: 'ch_99',
      },
    ]);
  });

  it('3. restores a lorebook file whose name no longer follows the title', () => {
    const result = reconcileIdentifiers(
      [{ id: 'char_01', file_path: 'lorebook/characters/lam-vu-linh.md' }],
      [
        {
          relativePath: 'lorebook/characters/linh-ha.md',
          id: 'char_01',
          title: 'Lâm Vũ Linh',
        },
      ]
    );

    assert.deepEqual(result.renames, [
      {
        id: 'char_01',
        from: 'lorebook/characters/linh-ha.md',
        to: 'lorebook/characters/lam-vu-linh.md',
      },
    ]);
    assert.deepEqual(result.filePaths, {
      char_01: 'lorebook/characters/lam-vu-linh.md',
    });
    assert.deepEqual(result.mismatches, []);
  });

  it('4. keeps a lorebook file that already follows the title', () => {
    const result = reconcileIdentifiers(
      [{ id: 'char_01', file_path: 'lorebook/characters/lam-vu-linh.md' }],
      [
        {
          relativePath: 'lorebook/characters/lam-vu-linh.md',
          id: 'char_01',
          title: 'Lâm Vũ Linh',
        },
      ]
    );

    assert.deepEqual(result.renames, []);
    assert.deepEqual(result.filePaths, {});
  });

  it('5. keeps the state untouched when nothing moved', () => {
    const result = reconcileIdentifiers(
      [{ id: 'ch_01', file_path: 'manuscript/act-01/ch-01-khoi-dau.md' }],
      [
        {
          relativePath: 'manuscript/act-01/ch-01-khoi-dau.md',
          id: 'ch_01',
          title: 'Mở đầu',
        },
      ]
    );

    assert.deepEqual(result.filePaths, {});
    assert.deepEqual(result.mismatches, []);
  });

  it('6. detects newly added and externally deleted files on disk', () => {
    const diff = diffDiskIdentifiers(
      ['ch_01', 'ch_02', 'char_01'],
      [
        {
          relativePath: 'manuscript/act-01/ch-01-khoi-dau.md',
          id: 'ch_01',
          title: 'Mở đầu',
        },
        {
          relativePath: 'manuscript/act-01/ch-03-moi.md',
          id: 'ch_03',
          title: 'Chương Mới',
        },
      ]
    );

    assert.equal(diff.added.length, 1);
    assert.equal(diff.added[0].id, 'ch_03');
    assert.deepEqual(diff.removedIds.sort(), ['ch_02', 'char_01']);
  });

  it('7. accepts raw snake_case relative_path payloads from Rust IPC without crashing', () => {
    const rawRustPayload = [
      {
        relative_path: 'manuscript/act-02/ch-01-khoi-dau.md',
        id: 'ch_01',
        title: 'Mở đầu',
      } as unknown as { relativePath: string; id: string; title: string },
    ];
    const result = reconcileIdentifiers(
      [{ id: 'ch_01', file_path: 'manuscript/act-01/ch-01-khoi-dau.md' }],
      rawRustPayload
    );

    assert.deepEqual(result.filePaths, {
      ch_01: 'manuscript/act-02/ch-01-khoi-dau.md',
    });
  });
});
