import type { JSONContent } from '@tiptap/react';
import {
  ChapterDocument,
  countVietnameseAndLatinWords,
  parseMarkdownWithFrontmatter,
} from '@/lib/tauri-bridge';

export interface LosslessMarkdownDocument {
  frontmatter: Record<string, unknown>;
  frontmatterKeysOrder: string[];
  paragraphs: string[];
  rawMarkdown: string;
  wordCount: number;
}

/**
 * Parses inline Markdown marks (`**bold**`, `*italic*`, `~~strike~~`, `` `code` ``)
 * into ProseMirror text nodes with marks, preserving 100% of text content.
 */
export function parseInlineMarkdownToNodes(text: string): JSONContent[] {
  if (!text) return [];

  const nodes: JSONContent[] = [];
  // Match **bold**, *italic*, ~~strike~~, or `code`
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*\n]+\*|~~[^~]+~~|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({
        type: 'text',
        text: text.slice(lastIndex, match.index),
      });
    }

    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      nodes.push({
        type: 'text',
        text: token.slice(2, -2),
        marks: [{ type: 'bold' }],
      });
    } else if (token.startsWith('~~') && token.endsWith('~~') && token.length > 4) {
      nodes.push({
        type: 'text',
        text: token.slice(2, -2),
        marks: [{ type: 'strike' }],
      });
    } else if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
      nodes.push({
        type: 'text',
        text: token.slice(1, -1),
        marks: [{ type: 'code' }],
      });
    } else if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
      nodes.push({
        type: 'text',
        text: token.slice(1, -1),
        marks: [{ type: 'italic' }],
      });
    } else {
      nodes.push({
        type: 'text',
        text: token,
      });
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push({
      type: 'text',
      text: text.slice(lastIndex),
    });
  }

  return nodes;
}

/**
 * Serializes ProseMirror inline text nodes with marks back into lossless Markdown syntax.
 */
export function serializeInlineNodesToMarkdown(content?: JSONContent[]): string {
  if (!content || content.length === 0) return '';

  return content
    .map((node) => {
      if (node.type === 'hardBreak') return '\n';
      if (node.type !== 'text' || typeof node.text !== 'string') {
        if (node.content) return serializeInlineNodesToMarkdown(node.content);
        return '';
      }

      let segment = node.text;
      const marks = node.marks || [];
      for (const mark of marks) {
        if (mark.type === 'code') {
          segment = `\`${segment}\``;
        } else if (mark.type === 'bold') {
          segment = `**${segment}**`;
        } else if (mark.type === 'italic') {
          segment = `*${segment}*`;
        } else if (mark.type === 'strike') {
          segment = `~~${segment}~~`;
        }
      }
      return segment;
    })
    .join('');
}

/**
 * Converts an array of canonical Markdown paragraph blocks into a ProseMirror/TipTap `doc` JSON tree.
 */
export function paragraphsToTipTapDoc(paragraphs: string[]): JSONContent {
  if (!paragraphs || paragraphs.length === 0) {
    return {
      type: 'doc',
      content: [{ type: 'paragraph', content: [] }],
    };
  }

  const blockNodes: JSONContent[] = paragraphs.map((rawPara) => {
    const trimmed = rawPara.trim();

    if (trimmed === '***' || trimmed === '* * *') {
      return {
        type: 'paragraph',
        content: [{ type: 'text', text: '***' }],
      };
    }

    if (trimmed.startsWith('#')) {
      const match = /^(#{1,6})\s+(.*)$/.exec(trimmed);
      if (match) {
        const level = Math.min(6, Math.max(1, match[1].length));
        return {
          type: 'heading',
          attrs: { level },
          content: parseInlineMarkdownToNodes(match[2]),
        };
      }
    }

    const inlineNodes = parseInlineMarkdownToNodes(rawPara);
    return {
      type: 'paragraph',
      content: inlineNodes.length > 0 ? inlineNodes : [],
    };
  });

  return {
    type: 'doc',
    content: blockNodes,
  };
}

/**
 * Converts a ProseMirror/TipTap `doc` JSON tree back into canonical Markdown paragraph strings losslessly.
 */
export function tipTapDocToParagraphs(doc: JSONContent): string[] {
  if (!doc || !Array.isArray(doc.content)) {
    return [];
  }

  const paragraphs: string[] = [];

  for (const node of doc.content) {
    if (node.type === 'horizontalRule') {
      paragraphs.push('***');
      continue;
    }

    if (node.type === 'heading') {
      const level = Number(node.attrs?.level || 2);
      const prefix = '#'.repeat(Math.min(6, Math.max(1, level)));
      const headingText = serializeInlineNodesToMarkdown(node.content);
      paragraphs.push(`${prefix} ${headingText}`.trim());
      continue;
    }

    if (node.type === 'blockquote' && Array.isArray(node.content)) {
      const inner = tipTapDocToParagraphs({ type: 'doc', content: node.content });
      for (const line of inner) {
        paragraphs.push(line.startsWith('>') ? line : `> ${line}`);
      }
      continue;
    }

    if (node.type === 'paragraph') {
      const text = serializeInlineNodesToMarkdown(node.content);
      paragraphs.push(text);
    }
  }

  return paragraphs;
}

/**
 * Serializes a `ChapterDocument` into a canonical, lossless Markdown + YAML Frontmatter `.md` string.
 */
export function serializeChapterToLosslessMarkdown(chapter: ChapterDocument): string {
  const orderedLines: string[] = [
    `id: "${chapter.id}"`,
    `title: "${chapter.title.replace(/"/g, '\\"')}"`,
    `act_id: "${chapter.act_id}"`,
    `order: ${chapter.order}`,
    `status: "${chapter.status}"`,
    `pov: "${chapter.pov_character_name.replace(/"/g, '\\"')}"`,
    `pov_character_id: "${chapter.pov_character_id}"`,
    `story_date: "${chapter.story_date.replace(/"/g, '\\"')}"`,
    `location_id: "${chapter.location_id}"`,
    `location_tag: "${chapter.location_tag.replace(/"/g, '\\"')}"`,
    `target_words: ${chapter.target_words}`,
    `is_flashback: ${chapter.is_flashback ? 'true' : 'false'}`,
  ];

  const body = chapter.paragraphs.join('\n\n');
  return `---\n${orderedLines.join('\n')}\n---\n\n${body}\n`;
}

/**
 * Parses a raw Markdown + YAML Frontmatter string back into structured chapter metadata + paragraphs
 * without losing custom blocks (`***`, `> [!GHI_CHÚ_TÁC_GIẢ]`, `[Hồi tưởng]`, inline marks).
 */
export function parseLosslessMarkdownToChapter(rawMarkdown: string): LosslessMarkdownDocument {
  const normalized = rawMarkdown.replace(/\r\n/g, '\n');
  const keysOrder: string[] = [];

  if (normalized.startsWith('---\n')) {
    const endIdx = normalized.indexOf('\n---\n', 4);
    if (endIdx !== -1) {
      const yamlBlock = normalized.slice(4, endIdx);
      for (const line of yamlBlock.split('\n')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0 && !line.startsWith(' ') && !line.startsWith('#')) {
          const k = line.slice(0, colonIdx).trim();
          if (k && !keysOrder.includes(k)) keysOrder.push(k);
        }
      }
    }
  }

  const parsed = parseMarkdownWithFrontmatter(normalized);
  return {
    frontmatter: parsed.frontmatter,
    frontmatterKeysOrder: keysOrder,
    paragraphs: parsed.paragraphs,
    rawMarkdown: normalized,
    wordCount: countVietnameseAndLatinWords(parsed.body),
  };
}

