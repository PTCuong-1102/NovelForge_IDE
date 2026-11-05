import JSZip from 'jszip';
import type { CompiledManuscript } from './compile-manuscript';
import { escapeHtml } from './escape-html';

export async function buildEpub(compiled: CompiledManuscript): Promise<Blob> {
  const zip = new JSZip();

  // 1. mimetype MUST be the very first file and uncompressed (STORE)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // 2. META-INF/container.xml
  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  zip.file('META-INF/container.xml', containerXml);

  // 3. CSS stylesheet
  const css = `
body {
  font-family: 'Literata', 'Georgia', serif;
  margin: 5%;
  line-height: 1.8;
  color: #1a1a1a;
  background-color: #ffffff;
}
h1, h2, h3 {
  font-family: 'Inter', sans-serif;
  font-weight: bold;
  text-align: center;
  margin-top: 1.5em;
  margin-bottom: 0.8em;
}
p {
  text-indent: 1.5em;
  margin-bottom: 0.8em;
  text-align: justify;
}
.meta {
  text-align: center;
  font-style: italic;
  color: #666666;
  font-size: 0.9em;
  margin-bottom: 2em;
}
hr {
  border: 0;
  border-top: 1px dashed #cccccc;
  margin: 2em 0;
}
`;
  zip.file('OEBPS/style.css', css);

  const manifestItems: string[] = [
    `<item id="css" href="style.css" media-type="text/css"/>`,
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`
  ];

  const spineItems: string[] = [];
  const navListItems: string[] = [];
  const ncxNavPoints: string[] = [];

  // Title / Cover page
  const titleXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="vi" lang="vi">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(compiled.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
  <h1>${escapeHtml(compiled.title)}</h1>
  <div class="meta">
    <p>Tác giả: ${escapeHtml(compiled.author)}</p>
    <p>Tổng số từ: ${compiled.totalWords.toLocaleString('vi-VN')} từ</p>
    <p>Ngày biên dịch: ${escapeHtml(compiled.date)}</p>
  </div>
</body>
</html>`;
  zip.file('OEBPS/title.xhtml', titleXhtml);
  manifestItems.push(`<item id="title-page" href="title.xhtml" media-type="application/xhtml+xml"/>`);
  spineItems.push(`<itemref idref="title-page"/>`);
  navListItems.push(`<li><a href="title.xhtml">Trang Bìa</a></li>`);
  ncxNavPoints.push(`
    <navPoint id="np-title" playOrder="1">
      <navLabel><text>Trang Bìa</text></navLabel>
      <content src="title.xhtml"/>
    </navPoint>`);

  // Chapters
  let orderIndex = 2;
  for (let i = 0; i < compiled.chapters.length; i++) {
    const ch = compiled.chapters[i];
    const filename = `chapter-${String(i + 1).padStart(3, '0')}.xhtml`;
    const itemId = `ch-${i + 1}`;

    const chapterXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="vi" lang="vi">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(ch.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
  <h2>${escapeHtml(ch.title)}</h2>
  ${ch.html}
</body>
</html>`;

    zip.file(`OEBPS/${filename}`, chapterXhtml);
    manifestItems.push(`<item id="${itemId}" href="${filename}" media-type="application/xhtml+xml"/>`);
    spineItems.push(`<itemref idref="${itemId}"/>`);
    navListItems.push(`<li><a href="${filename}">${escapeHtml(ch.title)}</a></li>`);
    ncxNavPoints.push(`
    <navPoint id="np-${orderIndex}" playOrder="${orderIndex}">
      <navLabel><text>${escapeHtml(ch.title)}</text></navLabel>
      <content src="${filename}"/>
    </navPoint>`);
    orderIndex++;
  }

  // Appendix if present
  if (compiled.appendixHtml) {
    const appendixFilename = 'appendix.xhtml';
    const appendixXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="vi" lang="vi">
<head>
  <meta charset="utf-8" />
  <title>Phụ Lục</title>
  <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
  ${compiled.appendixHtml}
</body>
</html>`;

    zip.file(`OEBPS/${appendixFilename}`, appendixXhtml);
    manifestItems.push(`<item id="appendix" href="${appendixFilename}" media-type="application/xhtml+xml"/>`);
    spineItems.push(`<itemref idref="appendix"/>`);
    navListItems.push(`<li><a href="${appendixFilename}">Phụ Lục</a></li>`);
    ncxNavPoints.push(`
    <navPoint id="np-${orderIndex}" playOrder="${orderIndex}">
      <navLabel><text>Phụ Lục</text></navLabel>
      <content src="${appendixFilename}"/>
    </navPoint>`);
  }

  // Navigation document (nav.xhtml - EPUB 3 requirement)
  const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="vi" lang="vi">
<head>
  <meta charset="utf-8" />
  <title>Mục Lục</title>
  <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Mục Lục</h1>
    <ol>
      ${navListItems.join('\n      ')}
    </ol>
  </nav>
</body>
</html>`;
  zip.file('OEBPS/nav.xhtml', navXhtml);

  // NCX (for backwards compatibility EPUB 2 readers)
  const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:novelforge-${Date.now()}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${escapeHtml(compiled.title)}</text>
  </docTitle>
  <navMap>
    ${ncxNavPoints.join('')}
  </navMap>
</ncx>`;
  zip.file('OEBPS/toc.ncx', tocNcx);

  // Package file (OEBPS/content.opf)
  const bookId = `urn:uuid:novelforge-${Date.now()}`;
  const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">${bookId}</dc:identifier>
    <dc:title>${escapeHtml(compiled.title)}</dc:title>
    <dc:language>vi</dc:language>
    <dc:creator>${escapeHtml(compiled.author)}</dc:creator>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    ${manifestItems.join('\n    ')}
  </manifest>
  <spine toc="ncx">
    ${spineItems.join('\n    ')}
  </spine>
</package>`;
  zip.file('OEBPS/content.opf', contentOpf);

  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE'
  });
}
