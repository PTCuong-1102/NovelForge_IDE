import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  chapterFileNameForId,
  chapterIdFromFileName,
  titleSlug,
} from '../chapter-file-name';

describe('Chapter id <-> file name sync rules', () => {
  it('1. reads the technical id out of a chapter file name', () => {
    assert.equal(chapterIdFromFileName('ch-01-khoi-dau.md'), 'ch_01');
    assert.equal(chapterIdFromFileName('ch-05-nha-kho-so-4.md'), 'ch_05');
    assert.equal(chapterIdFromFileName('ch_08.md'), 'ch_08');
    assert.equal(
      chapterIdFromFileName('khoi-dau.md'),
      null,
      'a file name without an id segment carries no id'
    );
  });

  it('2. builds the file name of a new id and keeps the title slug', () => {
    assert.equal(
      chapterFileNameForId('ch_01', 'ch_77', 'Mở đầu', 'ch-01-khoi-dau.md'),
      'ch-77-khoi-dau.md'
    );
    assert.equal(
      chapterFileNameForId('ch_08', 'ch_09', 'Đêm mưa', 'ch-08-dem-mua-ben-cang.md'),
      'ch-09-dem-mua-ben-cang.md'
    );
    assert.equal(
      chapterFileNameForId('ch_01', 'ch_02', 'Biên cơ', 'ch-01.md'),
      'ch-02-bien-co.md',
      'a file name that is only the id gains the title slug'
    );
    assert.equal(
      chapterFileNameForId('ch_01', 'ch_02', 'Biên cơ', 'khoi-dau.md'),
      'ch-02-khoi-dau.md',
      'a file name without an id segment gains one'
    );
  });

  it('3. falls back to the title slug when the file name has no slug', () => {
    assert.equal(
      chapterFileNameForId('ch_01', 'ch_77', 'Mở đầu', 'ch-01.md'),
      'ch-77-mo-dau.md'
    );
  });

  it('4. builds a file name safe slug', () => {
    assert.equal(titleSlug('Mở đầu'), 'mo-dau');
    assert.equal(titleSlug('Bến Cảng Đông'), 'ben-cang-dong');
    assert.equal(titleSlug('Chương 1: Bóng Ma'), 'chuong-1-bong-ma');
  });
});
