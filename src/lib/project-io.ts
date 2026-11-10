import type { ChapterDocument, LoreEntity, EntityType } from './tauri-bridge';
import { isTauri, invokeSafe } from './ipc';

export interface FileTreeNode {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileTreeNode[];
}

export interface ParsedBlock {
  kind: 'heading' | 'paragraph' | 'scene_break' | 'author_note' | 'block_quote';
  level?: number;
  text?: string;
  is_flashback?: boolean;
}

export interface ParsedDocument {
  frontmatter: Record<string, unknown>;
  frontmatter_keys_order?: string[];
  raw_frontmatter?: string;
  body: string;
  paragraphs?: string[];
  blocks?: ParsedBlock[];
}

export interface ProjectLoadResult {
  projectName: string;
  chapters: ChapterDocument[];
  entities: LoreEntity[];
}

const str = (v: unknown, fallback = ''): string =>
  typeof v === 'string' ? v : v == null ? fallback : String(v);
const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const bool = (v: unknown, fallback = false): boolean =>
  typeof v === 'boolean' ? v : v == null ? fallback : v === 'true';
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : typeof v === 'string' ? [v] : [];

/** YAML frontmatter keys owned by the chapter schema; anything else is preserved verbatim. */
const CHAPTER_FRONTMATTER_KEYS = new Set([
  'id',
  'act_id',
  'act_title',
  'order',
  'title',
  'status',
  'pov_character_id',
  'pov_character_name',
  'story_date',
  'story_year',
  'location_id',
  'location_tag',
  'target_words',
  'is_flashback',
]);

/** YAML frontmatter keys owned by the entity schema; anything else is preserved verbatim. */
const ENTITY_FRONTMATTER_KEYS = new Set([
  'id',
  'type',
  'title',
  'aliases',
  'status',
  'tags',
  'birth_year',
  'age_at_story',
  'faction',
  'role',
  'appearance',
  'personality',
  'death_chapter_order',
  'death_chapter_title',
  'death_date',
]);

/** Collects the frontmatter keys that the standard schema does not own. */
function pickExtraFrontmatter(
  frontmatter: Record<string, unknown>,
  standardKeys: Set<string>
): Record<string, unknown> {
  const extras: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(frontmatter)) {
    if (!standardKeys.has(key)) extras[key] = value;
  }
  return extras;
}

export function relativeToProject(rootPath: string, absolutePath: string): string {
  const root = rootPath.replace(/\\/g, '/').replace(/\/+$/, '');
  const abs = absolutePath.replace(/\\/g, '/');
  if (abs.toLowerCase().startsWith(root.toLowerCase() + '/')) {
    return abs.slice(root.length + 1);
  }
  return abs; // already relative or outside — Rust canonical_within validates on write
}

function flattenMdFiles(nodes: FileTreeNode[], acc: FileTreeNode[] = []): FileTreeNode[] {
  for (const n of nodes) {
    if (n.is_dir) flattenMdFiles(n.children, acc);
    else if (n.name.toLowerCase().endsWith('.md')) acc.push(n);
  }
  return acc;
}

/** Rebuilds a canonical Markdown block line from the Rust block AST. */
function blockToMarkdown(block: ParsedBlock): string {
  const text = (block.text ?? '').trim();
  switch (block.kind) {
    case 'heading': {
      const level = Math.min(6, Math.max(1, block.level ?? 1));
      return `${'#'.repeat(level)} ${text}`;
    }
    case 'scene_break':
      return '***';
    case 'author_note':
      return `> [!GHI_CHÚ_TÁC GIẢ] ${text}`;
    case 'block_quote':
      return `> ${text}`;
    default:
      return text;
  }
}

/** Paragraphs for editing: prefer the block AST (keeps headings), else split body on blank lines. */
function bodyToParagraphs(doc: ParsedDocument): string[] {
  if (Array.isArray(doc.blocks) && doc.blocks.length > 0) {
    return doc.blocks.map(blockToMarkdown).filter(Boolean);
  }
  return doc.body
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function entityTypeFromPath(relPath: string, fmType: string): EntityType {
  if (fmType === 'character' || fmType === 'location' || fmType === 'item') return fmType;
  if (relPath.includes('/characters/')) return 'character';
  if (relPath.includes('/locations/')) return 'location';
  if (relPath.includes('/items/')) return 'item';
  return 'item';
}

function statusFromFm(v: unknown): LoreEntity['status'] {
  const s = str(v);
  return ['alive', 'dead', 'missing', 'active', 'destroyed'].includes(s)
    ? (s as LoreEntity['status'])
    : undefined;
}

function chapterStatus(v: unknown): ChapterDocument['status'] {
  const s = str(v);
  return s === 'completed' || s === 'editing' ? s : 'draft';
}

export function parsedToChapter(relPath: string, doc: ParsedDocument): ChapterDocument {
  const fm = doc.frontmatter ?? {};
  const now = new Date().toISOString();
  return {
    id: str(fm.id, relPath),
    act_id: str(fm.act_id, 'act_01'),
    act_title: str(fm.act_title, ''),
    order: num(fm.order, 999),
    title: str(fm.title, relPath.split('/').pop() ?? relPath),
    file_path: relPath,
    status: chapterStatus(fm.status),
    pov_character_id: str(fm.pov_character_id),
    pov_character_name: str(fm.pov_character_name, str(fm.pov)),
    story_date: str(fm.story_date),
    story_year: num(fm.story_year, new Date().getFullYear()),
    location_id: str(fm.location_id),
    location_tag: str(fm.location_tag),
    target_words: num(fm.target_words, 1000),
    is_flashback: bool(fm.is_flashback),
    paragraphs: bodyToParagraphs(doc),
    extra_frontmatter: pickExtraFrontmatter(fm, CHAPTER_FRONTMATTER_KEYS),
    frontmatter_keys_order: doc.frontmatter_keys_order,
    updated_at: now,
  };
}

export function chapterToFrontmatter(c: ChapterDocument): Record<string, unknown> {
  return {
    ...(c.extra_frontmatter ?? {}),
    id: c.id,
    act_id: c.act_id,
    act_title: c.act_title,
    order: c.order,
    title: c.title,
    status: c.status,
    pov_character_id: c.pov_character_id,
    pov_character_name: c.pov_character_name,
    story_date: c.story_date,
    story_year: c.story_year,
    location_id: c.location_id,
    location_tag: c.location_tag,
    target_words: c.target_words,
    is_flashback: c.is_flashback,
  };
}

export function parsedToEntity(relPath: string, doc: ParsedDocument): LoreEntity {
  const fm = doc.frontmatter ?? {};
  const now = new Date().toISOString();
  const body = doc.body.trim();
  const fmType = str(fm.type);
  return {
    id: str(fm.id, relPath),
    entity_type: entityTypeFromPath(relPath, fmType),
    title: str(fm.title, str(fm.name, relPath.split('/').pop() ?? relPath)),
    aliases: strArr(fm.aliases),
    file_path: relPath,
    status: statusFromFm(fm.status),
    birth_year: fm.birth_year == null ? undefined : num(fm.birth_year),
    age_at_story: fm.age_at_story == null ? undefined : num(fm.age_at_story),
    faction: fm.faction == null ? undefined : str(fm.faction),
    role: fm.role == null ? undefined : str(fm.role),
    appearance: fm.appearance == null ? undefined : str(fm.appearance),
    personality: fm.personality == null ? undefined : str(fm.personality),
    death_chapter_order:
      fm.death_chapter_order == null ? undefined : num(fm.death_chapter_order),
    death_chapter_title:
      fm.death_chapter_title == null ? undefined : str(fm.death_chapter_title),
    death_date: fm.death_date == null ? undefined : str(fm.death_date),
    tags: strArr(fm.tags),
    summary:
      body.split('\n').find((l) => l.trim() && !l.trim().startsWith('#'))?.trim() ?? '',
    body,
    extra_frontmatter: pickExtraFrontmatter(fm, ENTITY_FRONTMATTER_KEYS),
    frontmatter_keys_order: doc.frontmatter_keys_order,
    updated_at: now,
  };
}

export function entityToFrontmatter(e: LoreEntity): Record<string, unknown> {
  const fm: Record<string, unknown> = {
    ...(e.extra_frontmatter ?? {}),
    id: e.id,
    type: e.entity_type,
    title: e.title,
    aliases: e.aliases,
    status: e.status,
    tags: e.tags,
  };
  if (e.birth_year !== undefined) fm.birth_year = e.birth_year;
  if (e.age_at_story !== undefined) fm.age_at_story = e.age_at_story;
  if (e.faction) fm.faction = e.faction;
  if (e.role) fm.role = e.role;
  if (e.appearance) fm.appearance = e.appearance;
  if (e.personality) fm.personality = e.personality;
  if (e.death_chapter_order !== undefined) fm.death_chapter_order = e.death_chapter_order;
  if (e.death_chapter_title) fm.death_chapter_title = e.death_chapter_title;
  if (e.death_date) fm.death_date = e.death_date;
  return fm;
}

export function basename(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
}

export async function loadProject(
  projectRoot: string
): Promise<{ ok: true; data: ProjectLoadResult } | { ok: false; error: string }> {
  if (!isTauri()) return { ok: false, error: 'NOT_IN_TAURI' };

  const init = await invokeSafe('init_project_workspace', { projectRoot });
  if (!init.ok) return { ok: false, error: init.error };

  const sync = await invokeSafe('sync_project_sqlite', { projectRoot });
  if (!sync.ok) {
    // Non-fatal: index can be rebuilt on next launch; keep loading files.
    console.warn('[NovelForge] sqlite sync failed:', sync.error);
  }

  const tree = await invokeSafe<FileTreeNode[]>('read_project_tree', { projectRoot });
  if (!tree.ok) return { ok: false, error: tree.error };

  const mdFiles = flattenMdFiles(tree.data);
  const chapters: ChapterDocument[] = [];
  const entities: LoreEntity[] = [];

  for (const node of mdFiles) {
    const relPath = relativeToProject(projectRoot, node.path);
    const lower = relPath.toLowerCase().replace(/\\/g, '/');
    const isChapter = lower.startsWith('manuscript/') || lower.includes('/manuscript/');
    const isLore = lower.startsWith('lorebook/') || lower.includes('/lorebook/');
    if (!isChapter && !isLore) continue;

    const read = await invokeSafe<ParsedDocument>('read_markdown_file', {
      projectRoot,
      relativePath: relPath,
    });
    if (!read.ok) {
      console.warn('[NovelForge] skip unreadable file:', relPath, read.error);
      continue;
    }
    if (isChapter) chapters.push(parsedToChapter(relPath, read.data));
    else entities.push(parsedToEntity(relPath, read.data));
  }

  chapters.sort((a, b) => a.act_id.localeCompare(b.act_id) || a.order - b.order);

  return {
    ok: true,
    data: { projectName: basename(projectRoot), chapters, entities },
  };
}

export async function saveChapterToDisk(
  projectRoot: string,
  chapter: ChapterDocument
): Promise<{ ok: boolean; error?: string }> {
  const res = await invokeSafe('write_markdown_file', {
    projectRoot,
    relativePath: chapter.file_path,
    frontmatter: chapterToFrontmatter(chapter),
    orderedKeys: chapter.frontmatter_keys_order ?? null,
    body: chapter.paragraphs.join('\n\n'),
  });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

export async function saveEntityToDisk(
  projectRoot: string,
  entity: LoreEntity
): Promise<{ ok: boolean; error?: string }> {
  const res = await invokeSafe('write_markdown_file', {
    projectRoot,
    relativePath: entity.file_path,
    frontmatter: entityToFrontmatter(entity),
    orderedKeys: entity.frontmatter_keys_order ?? null,
    body: entity.body,
  });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}
