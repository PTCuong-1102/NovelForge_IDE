import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { escapeHtml, stripAuthorNotes, markdownBlockToHtml } from '../publish/escape-html';
import { compileManuscript } from '../publish/compile-manuscript';
import { buildEpub } from '../publish/epub';
import { buildDocx } from '../publish/docx';

test('Publish Security & Escaping Tests', async (t) => {
  await t.test('1. escapeHtml sanitizes dangerous HTML characters', () => {
    const raw = '<script>alert("x")</script> & \' ';
    const clean = escapeHtml(raw);
    assert.strictEqual(clean, '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39; ');
    assert.ok(!clean.includes('<script>'));
  });

  await t.test('2. markdownBlockToHtml escapes tag injections within headings and paragraphs', () => {
    const maliciousParagraph = '<img src=x onerror=alert(1)>';
    const html = markdownBlockToHtml(maliciousParagraph);
    assert.ok(!html.includes('<img'));
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(html.startsWith('<p>'));
    assert.ok(html.endsWith('</p>'));

    const maliciousHeading = '# <script>evil()</script>';
    const h1 = markdownBlockToHtml(maliciousHeading);
    assert.ok(!h1.includes('<script>'));
    assert.ok(h1.includes('&lt;script&gt;evil()&lt;/script&gt;'));
    assert.ok(h1.startsWith('<h1>'));
  });

  await t.test('3. stripAuthorNotes eliminates private author note blocks', () => {
    const content = `> [!GHI_CHÚ_TÁC_GIẢ]
Cần thêm cảnh chiến đấu ở đây trước khi gửi cho biên tập.

Đoạn văn thật của chương một bắt đầu ở đây.`;

    const sanitized = stripAuthorNotes(content);
    assert.ok(!sanitized.includes('Cần thêm cảnh chiến đấu'));
    assert.ok(sanitized.includes('Đoạn văn thật của chương một bắt đầu ở đây.'));
  });

  await t.test('4. markdownBlockToHtml handles empty or divider inputs gracefully', () => {
    assert.strictEqual(markdownBlockToHtml(''), '<p></p>');
    assert.strictEqual(markdownBlockToHtml('   '), '<p></p>');
    assert.strictEqual(markdownBlockToHtml('---'), '<hr />');
  });

  await t.test('5. markdownBlockToHtml renders scene breaks, blockquotes and inline marks', () => {
    assert.strictEqual(markdownBlockToHtml('***'), '<hr />');
    assert.strictEqual(
      markdownBlockToHtml('> Lời trích dẫn cổ xưa'),
      '<blockquote>Lời trích dẫn cổ xưa</blockquote>'
    );
    assert.strictEqual(
      markdownBlockToHtml('Cô rút **súng lục** trong *đêm mưa*.'),
      '<p>Cô rút <strong>súng lục</strong> trong <em>đêm mưa</em>.</p>'
    );
  });

  await t.test('6. inline markup never lets a raw HTML tag through', () => {
    const html = markdownBlockToHtml('Cô rút **<script>alert(1)</script>** trong *đêm*.');
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(html.includes('<strong>'));
    assert.ok(html.includes('<em>'));
  });

  await t.test('7. buildEpub generates valid EPUB 3 zip archive', async () => {
    const sample = compileManuscript({
      projectName: 'Thiên Địa Khởi Nguyên <script>',
      chapters: [
        {
          id: 'c1',
          title: 'Hồi 1',
          order: 1,
          content: 'Nội dung hồi 1 có chút ma thuật & phiêu lưu.'
        }
      ]
    });

    const epubBlob = await buildEpub(sample);
    assert.ok(epubBlob.size > 0);
    assert.strictEqual(epubBlob.type, 'application/epub+zip');

    const arrayBuffer = await epubBlob.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Assert container and mimetype exist
    assert.ok(zip.file('mimetype'));
    assert.ok(zip.file('META-INF/container.xml'));
    assert.ok(zip.file('OEBPS/content.opf'));
    assert.ok(zip.file('OEBPS/nav.xhtml'));
    assert.ok(zip.file('OEBPS/toc.ncx'));
    assert.ok(zip.file('OEBPS/chapter-001.xhtml'));

    const mimetypeContent = await zip.file('mimetype')!.async('string');
    assert.strictEqual(mimetypeContent, 'application/epub+zip');

    const opf = await zip.file('OEBPS/content.opf')!.async('string');
    assert.ok(opf.includes('&lt;script&gt;'));
    assert.ok(!opf.includes('<script>'));
  });

  await t.test('8. buildDocx generates valid DOCX blob', async () => {
    const sample = compileManuscript({
      projectName: 'Huyết Cảng Tiền Truyện',
      chapters: [
        {
          id: 'c1',
          title: 'Chương Một',
          order: 1,
          content: 'Đoạn văn mở màn cho câu chuyện tại Huyết Cảng.\n\n---\n\nĐoạn văn thứ hai sau phân cách.'
        }
      ]
    });

    const docxBlob = await buildDocx(sample);
    assert.ok(docxBlob.size > 0);

    const arrayBuffer = await docxBlob.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Assert standard DOCX xml files
    assert.ok(zip.file('word/document.xml'));
    const docXml = await zip.file('word/document.xml')!.async('string');
    assert.ok(docXml.includes('HUYẾT CẢNG TIỀN TRUYỆN'));
    assert.ok(docXml.includes('Chương Một'));
    assert.ok(docXml.includes('Đoạn văn mở màn'));
  });

  await t.test('9. buildDocx keeps scene breaks, headings and inline marks', async () => {
    const marked = compileManuscript({
      projectName: 'Dấu Nhấn',
      chapters: [
        {
          id: 'c1',
          title: 'Chương Một',
          order: 1,
          content:
            'Cô rút **súng lục** trong *đêm mưa*.\n\n***\n\n## Cảnh 2\n\nĐoạn kết.'
        }
      ]
    });

    const blob = await buildDocx(marked);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const docXml = await zip.file('word/document.xml')!.async('string');

    assert.ok(docXml.includes('<w:b/>'), 'bold runs must be emitted');
    assert.ok(docXml.includes('<w:i/>'), 'italic runs must be emitted');
    assert.ok(docXml.includes('* * *'), 'scene breaks must be emitted');
    assert.ok(docXml.includes('Cảnh 2'), 'chapter headings must be emitted');
    assert.ok(docXml.includes('súng lục'), 'bold text must be emitted');
  });
});
