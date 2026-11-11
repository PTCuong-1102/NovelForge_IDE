import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { reconcileIdentifiers } from '../project-file-sync';

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

  it('3. ignores lorebook files, whose name follows the title', () => {
    const result = reconcileIdentifiers(
      [{ id: 'char_01', file_path: 'lorebook/characters/lam-vu-linh.md' }],
      [
        {
          relativePath: 'lorebook/characters/linh-ha.md',
          id: 'char_01',
          title: 'Linh Hà',
        },
      ]
    );

    assert.deepEqual(result.filePaths, {
      char_01: 'lorebook/characters/linh-ha.md',
    });
    assert.deepEqual(result.mismatches, []);
  });

  it('4. keeps the state untouched when nothing moved', () => {
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
});
