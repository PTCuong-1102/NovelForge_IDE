/**
 * Naming rules that keep a chapter's technical id and its file name in sync.
 *
 * Chapter files follow `<id with _ replaced by ->-<title slug>.md`, so
 * `manuscript/act-01/ch-01-khoi-dau.md` holds the chapter `ch_01`.
 *
 * Lorebook files follow the title slug instead (`lorebook/characters/lam-vu-linh.md`
 * holds `char_linh_001`), so their id never appears in the file name and a
 * rename of the id must leave the file alone.
 */

/** Matches the leading id segment of a chapter file name (`ch-01-khoi-dau`). */
const ID_SEGMENT = /^([a-z][a-z0-9]*[-_]\d+)/i;

/**
 * The technical id encoded in a chapter file name, or `null` when the file name
 * carries no id (`khoi-dau.md`).
 */
export function chapterIdFromFileName(fileName: string): string | null {
  const base = fileName.replace(/\.md$/i, '');
  const match = ID_SEGMENT.exec(base);
  if (!match) return null;
  return match[1].replace(/-/g, '_');
}

/** A file-name safe slug of a title. */
export function titleSlug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * The chapter file name for a new id, keeping the title slug of the current
 * file: `ch_01` → `ch_77` turns `ch-01-khoi-dau.md` into `ch-77-khoi-dau.md`.
 */
export function chapterFileNameForId(
  oldId: string,
  newId: string,
  title: string,
  currentFileName: string
): string {
  const base = currentFileName.replace(/\.md$/i, '');
  const oldPrefix = oldId.replace(/_/g, '-');

  let slug = '';
  if (base.startsWith(`${oldPrefix}-`)) {
    slug = base.slice(oldPrefix.length + 1);
  } else if (base !== oldPrefix) {
    slug = titleSlug(base);
  }
  if (!slug) slug = titleSlug(title);

  return `${newId.replace(/_/g, '-')}-${slug}.md`;
}
