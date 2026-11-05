import test from 'node:test';
import assert from 'node:assert/strict';
import { compileManuscript } from '../publish/compile-manuscript';

test('Compile Manuscript Pipeline Tests', async (t) => {
  await t.test('1. Compiles chapters into structured output and escapes content', () => {
    const result = compileManuscript({
      projectName: 'Dự Án Thử Nghiệm <script>alert(1)</script>',
      chapters: [
        {
          id: 'ch-01',
          title: 'Chương 1: Mở Đầu',
          order: 1,
          paragraphs: [
            '> [!GHI_CHÚ_TÁC_GIẢ]\nCần sửa đoạn này sau.',
            'Mặt trời lặn dần sau rặng núi phía tây.',
            '<img src=x onerror=attack()>'
          ]
        }
      ],
      stripAuthorNotes: true
    });

    assert.strictEqual(result.chapters.length, 1);
    assert.strictEqual(result.chapters[0].title, 'Chương 1: Mở Đầu');
    // Ensure author notes stripped
    assert.ok(!result.chapters[0].html.includes('Cần sửa đoạn này'));
    // Ensure HTML was escaped
    assert.ok(!result.chapters[0].html.includes('<img src=x'));
    assert.ok(result.chapters[0].html.includes('&lt;img src=x onerror=attack()&gt;'));
    assert.ok(result.fullHtml.toLowerCase().includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(result.totalWords > 0);
  });

  await t.test('2. Throws EMPTY_MANUSCRIPT when given 0 chapters (R5 guard)', () => {
    assert.throws(
      () => {
        compileManuscript({
          projectName: 'Rỗng',
          chapters: []
        });
      },
      {
        message: 'EMPTY_MANUSCRIPT'
      }
    );
  });

  await t.test('3. Includes lorebook appendix when requested', () => {
    const result = compileManuscript({
      projectName: 'Huyết Cảng',
      chapters: [
        {
          id: 'ch-01',
          title: 'Khởi đầu',
          order: 1,
          content: 'Nội dung ngắn gọn.'
        }
      ],
      includeLoreGlossary: true,
      entities: [
        {
          entity_type: 'character',
          title: 'Linh',
          aliases: ['Linh Ka'],
          role: 'Nữ hiệp',
          summary: 'Kiếm sĩ vùng duyên hải'
        },
        {
          entity_type: 'location',
          title: 'Hải Phòng',
          aliases: [],
          summary: 'Cảng thị sầm uất'
        }
      ]
    });

    assert.ok(result.appendixHtml);
    assert.ok(result.appendixHtml.includes('Linh'));
    assert.ok(result.appendixHtml.includes('Hải Phòng'));
  });
});
