import { escapeHtml, stripAuthorNotes as stripNotes, markdownBlockToHtml } from './escape-html';
import { countVietnameseAndLatinWords } from '../tauri-bridge';

export interface CompiledChapter {
  id: string;
  title: string;
  actTitle?: string;
  povCharacter?: string;
  storyDate?: string;
  locationTag?: string;
  html: string;
  rawText: string;
  wordCount: number;
}

export interface CompiledManuscript {
  title: string;
  author: string;
  date: string;
  chapters: CompiledChapter[];
  appendixHtml?: string;
  appendixText?: string;
  totalWords: number;
  fullHtml: string;
}

export interface ChapterInput {
  id: string;
  act_id?: string;
  title: string;
  paragraphs?: string[];
  content?: string;
  order: number;
  act_title?: string;
  pov_character_name?: string;
  story_date?: string;
  location_tag?: string;
}

export interface EntityInput {
  entity_type: string;
  title: string;
  aliases: string[];
  role?: string;
  summary?: string;
  personality?: string;
}

export interface CompileManuscriptOptions {
  chapters: ChapterInput[];
  projectName: string;
  authorName?: string;
  includeLoreGlossary?: boolean;
  stripAuthorNotes?: boolean;
  entities?: EntityInput[];
}

export function compileManuscript(options: CompileManuscriptOptions): CompiledManuscript {
  const {
    chapters,
    projectName,
    authorName = 'NovelForge Author',
    includeLoreGlossary = false,
    stripAuthorNotes = true,
    entities = []
  } = options;

  if (!chapters || chapters.length === 0) {
    throw new Error('EMPTY_MANUSCRIPT');
  }

  const sorted = [...chapters].sort(
    (a, b) => (a.act_id ?? '').localeCompare(b.act_id ?? '') || a.order - b.order
  );
  let totalWords = 0;
  const compiledChapters: CompiledChapter[] = [];

  for (const ch of sorted) {
    let rawBlocks: string[] = [];
    if (ch.paragraphs && ch.paragraphs.length > 0) {
      rawBlocks = ch.paragraphs;
    } else if (ch.content) {
      rawBlocks = ch.content.split(/\r?\n\r?\n/);
    }

    if (stripAuthorNotes) {
      rawBlocks = rawBlocks
        .map((b) => stripNotes(b))
        .filter((b) => b.trim().length > 0);
    }

    const chapterHtmlBlocks: string[] = [];
    const chapterRawBlocks: string[] = [];

    // Header metadata block
    let metaLine = '';
    const metaParts = [];
    if (ch.pov_character_name) metaParts.push(`Góc nhìn (POV): ${ch.pov_character_name}`);
    if (ch.story_date) metaParts.push(`Bối cảnh: ${ch.story_date}`);
    if (ch.location_tag) metaParts.push(`Địa điểm: ${ch.location_tag}`);
    if (metaParts.length > 0) {
      metaLine = metaParts.join(' | ');
      chapterHtmlBlocks.push(`<div class="meta">${escapeHtml(metaLine)}</div>`);
    }

    for (const block of rawBlocks) {
      chapterHtmlBlocks.push(markdownBlockToHtml(block));
      chapterRawBlocks.push(block);
    }

    const chapterRawText = chapterRawBlocks.join('\n\n');
    const words = countVietnameseAndLatinWords(chapterRawText);
    totalWords += words;

    compiledChapters.push({
      id: ch.id,
      title: ch.title,
      actTitle: ch.act_title,
      povCharacter: ch.pov_character_name,
      storyDate: ch.story_date,
      locationTag: ch.location_tag,
      html: chapterHtmlBlocks.join('\n'),
      rawText: chapterRawText,
      wordCount: words
    });
  }

  let appendixHtml: string | undefined;
  let appendixText: string | undefined;

  if (includeLoreGlossary && entities.length > 0) {
    const characters = entities.filter((e) => e.entity_type === 'character');
    const locations = entities.filter((e) => e.entity_type === 'location');

    let textAcc = '# PHỤ LỤC: THẾ GIỚI QUAN & HỒ SƠ NHÂN VẬT\n\n';
    let htmlAcc = '<h1>PHỤ LỤC: THẾ GIỚI QUAN & HỒ SƠ NHÂN VẬT</h1>';

    if (characters.length > 0) {
      textAcc += '### 1. Nhân Vật\n';
      htmlAcc += '<h2>1. Nhân Vật</h2><ul>';
      for (const char of characters) {
        const aliasStr = char.aliases?.length ? ` (${char.aliases.join(', ')})` : '';
        const roleDesc = char.role ? `${char.role} - ` : '';
        const desc = char.summary || char.personality || '';
        textAcc += `- **${char.title}**${aliasStr}: ${roleDesc}${desc}\n`;
        htmlAcc += `<li><strong>${escapeHtml(char.title)}</strong>${escapeHtml(aliasStr)}: ${escapeHtml(roleDesc)}${escapeHtml(desc)}</li>`;
      }
      htmlAcc += '</ul>';
      textAcc += '\n';
    }

    if (locations.length > 0) {
      textAcc += '### 2. Địa Danh & Bối Cảnh\n';
      htmlAcc += '<h2>2. Địa Danh & Bối Cảnh</h2><ul>';
      for (const loc of locations) {
        textAcc += `- **${loc.title}**: ${loc.summary || ''}\n`;
        htmlAcc += `<li><strong>${escapeHtml(loc.title)}</strong>: ${escapeHtml(loc.summary || '')}</li>`;
      }
      htmlAcc += '</ul>';
    }

    appendixHtml = htmlAcc;
    appendixText = textAcc;
  }

  // Build full monolithic HTML representation
  const dateStr = new Date().toLocaleDateString('vi-VN');
  let fullHtml = `<h1>${escapeHtml(projectName.toUpperCase())}</h1>\n`;
  fullHtml += `<div class="meta">Tác giả: ${escapeHtml(authorName)} | Tổng số từ: ${totalWords.toLocaleString('vi-VN')} | Ngày biên dịch: ${dateStr}</div>\n<hr />\n`;

  let currentAct = '';
  for (const ch of compiledChapters) {
    if (ch.actTitle && ch.actTitle !== currentAct) {
      currentAct = ch.actTitle;
      fullHtml += `<h1>${escapeHtml(currentAct.toUpperCase())}</h1>\n`;
    }
    fullHtml += `<h2>${escapeHtml(ch.title)}</h2>\n`;
    fullHtml += `${ch.html}\n<hr />\n`;
  }

  if (appendixHtml) {
    fullHtml += `${appendixHtml}\n`;
  }

  return {
    title: projectName,
    author: authorName,
    date: dateStr,
    chapters: compiledChapters,
    appendixHtml,
    appendixText,
    totalWords,
    fullHtml
  };
}
