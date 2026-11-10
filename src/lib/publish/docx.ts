import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import type { CompiledManuscript } from './compile-manuscript';

/**
 * Splits Markdown inline marks (`**bold**`, `*italic*`) into DOCX text runs.
 */
function inlineRuns(text: string, italics = false): TextRun[] {
  const runs: TextRun[] = [];
  const base = { font: 'Times New Roman', size: 24 };
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*\n]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun({ ...base, text: text.slice(lastIndex, match.index), italics }));
    }
    const token = match[0];
    if (token.startsWith('**')) {
      runs.push(new TextRun({ ...base, text: token.slice(2, -2), bold: true, italics }));
    } else {
      runs.push(new TextRun({ ...base, text: token.slice(1, -1), italics: true }));
    }
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    runs.push(new TextRun({ ...base, text: text.slice(lastIndex), italics }));
  }
  return runs;
}

export async function buildDocx(compiled: CompiledManuscript): Promise<Blob> {
  const sections: Paragraph[] = [];

  // Title / Cover
  sections.push(
    new Paragraph({
      text: compiled.title.toUpperCase(),
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { before: 2400, after: 400 }
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Tác giả: ${compiled.author}`,
          italics: true,
          size: 24
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Tổng số từ: ${compiled.totalWords.toLocaleString('vi-VN')} từ  |  Ngày: ${compiled.date}`,
          italics: true,
          size: 20,
          color: '666666'
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 1200 }
    })
  );

  // Chapters
  for (const ch of compiled.chapters) {
    sections.push(
      new Paragraph({
        text: ch.title,
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        spacing: { before: 400, after: 200 }
      })
    );

    if (ch.povCharacter || ch.storyDate || ch.locationTag) {
      const meta = [
        ch.povCharacter ? `POV: ${ch.povCharacter}` : null,
        ch.storyDate ? `Bối cảnh: ${ch.storyDate}` : null,
        ch.locationTag ? `Địa điểm: ${ch.locationTag}` : null
      ]
        .filter(Boolean)
        .join(' | ');

      sections.push(
        new Paragraph({
          children: [new TextRun({ text: meta, italics: true, size: 20, color: '666666' })],
          spacing: { after: 400 }
        })
      );
    }

    const rawParagraphs = ch.rawText.split(/\r?\n\r?\n/);
    for (const para of rawParagraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;
      if (trimmed === '---' || trimmed === '***' || trimmed === '* * *') {
        sections.push(
          new Paragraph({
            text: '* * *',
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 }
          })
        );
        continue;
      }
      if (trimmed.startsWith('### ')) {
        sections.push(
          new Paragraph({
            text: trimmed.slice(4).trim(),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 }
          })
        );
        continue;
      }
      if (trimmed.startsWith('## ')) {
        sections.push(
          new Paragraph({
            text: trimmed.slice(3).trim(),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 }
          })
        );
        continue;
      }
      if (trimmed.startsWith('# ')) {
        sections.push(
          new Paragraph({
            text: trimmed.slice(2).trim(),
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 240, after: 120 }
          })
        );
        continue;
      }
      if (trimmed.startsWith('> ')) {
        sections.push(
          new Paragraph({
            children: inlineRuns(trimmed.slice(2).trim(), true),
            indent: { left: 720 },
            spacing: { line: 360, before: 120, after: 120 }
          })
        );
        continue;
      }
      sections.push(
        new Paragraph({
          children: inlineRuns(trimmed),
          indent: { firstLine: 720 }, // 0.5 inch indent standard
          spacing: { line: 360, before: 120, after: 120 } // 1.5 line spacing
        })
      );
    }
  }

  // Appendix
  if (compiled.appendixText) {
    sections.push(
      new Paragraph({
        text: 'PHỤ LỤC: THẾ GIỚI QUAN & HỒ SƠ NHÂN VẬT',
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        spacing: { before: 400, after: 300 }
      })
    );

    const appendixLines = compiled.appendixText.split(/\r?\n/);
    for (const line of appendixLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('# ')) continue;
      if (trimmed.startsWith('### ')) {
        sections.push(
          new Paragraph({
            text: trimmed.replace(/^###\s*/, ''),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 }
          })
        );
      } else {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmed,
                font: 'Times New Roman',
                size: 22
              })
            ],
            spacing: { before: 60, after: 60 }
          })
        );
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440
            }
          }
        },
        children: sections
      }
    ]
  });

  return await Packer.toBlob(doc);
}
