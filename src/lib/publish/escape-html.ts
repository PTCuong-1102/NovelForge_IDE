/**
 * HTML Sanitization and Block Transformation for Publishing & Print
 */

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function stripAuthorNotes(markdown: string): string {
  return markdown
    .replace(
      />\s*\[!(?:GHI_CHÚ_TÁC_GIẢ|GHI_CHU_TAC_GIA|AUTHOR_NOTE)\][\s\S]*?(?=(?:\r?\n\r?\n|$))/gi,
      ''
    )
    .trim();
}

export function markdownBlockToHtml(block: string): string {
  const trimmed = block.trim();
  if (!trimmed) {
    return '<p></p>';
  }
  if (trimmed === '---') {
    return '<hr />';
  }
  if (trimmed.startsWith('# ')) {
    return `<h1>${escapeHtml(trimmed.slice(2).trim())}</h1>`;
  }
  if (trimmed.startsWith('## ')) {
    return `<h2>${escapeHtml(trimmed.slice(3).trim())}</h2>`;
  }
  if (trimmed.startsWith('### ')) {
    return `<h3>${escapeHtml(trimmed.slice(4).trim())}</h3>`;
  }
  if (trimmed.startsWith('*') && trimmed.endsWith('*') && trimmed.length > 2) {
    return `<div class="meta">${escapeHtml(trimmed.slice(1, -1))}</div>`;
  }
  return `<p>${escapeHtml(trimmed)}</p>`;
}
