import { chapterIdFromFileName, titleSlug } from './chapter-file-name';

export interface DiskFileIdentifier {
  relativePath: string;
  relative_path?: string;
  id: string;
  title: string;
}

function normalizeRelativePath(file: DiskFileIdentifier): string {
  return (file.relativePath ?? file.relative_path ?? '').replace(/\\/g, '/');
}

export interface IdentifierReconciliation {
  /** The new relative path of every id whose file moved on disk. */
  filePaths: Record<string, string>;
  /** Lorebook files whose name no longer follows the title slug. */
  renames: Array<{ id: string; from: string; to: string }>;
  /** Chapter files whose name no longer matches the id they declare. */
  mismatches: Array<{
    id: string;
    relativePath: string;
    idInFileName: string | null;
  }>;
}

/**
 * Compares the identifiers held in memory with the ones read from the disk.
 *
 * A chapter file name carries its id, so a rename done outside the application
 * is reported instead of being reverted — the id would be lost. A lorebook file
 * name only follows the title slug, so it can be restored without losing
 * anything.
 */
export function reconcileIdentifiers(
  current: Array<{ id: string; file_path: string }>,
  disk: DiskFileIdentifier[]
): IdentifierReconciliation {
  const byId = new Map(disk.map((file) => [file.id, file]));
  const filePaths: Record<string, string> = {};
  const renames: IdentifierReconciliation['renames'] = [];
  const mismatches: IdentifierReconciliation['mismatches'] = [];

  for (const item of current) {
    const found = byId.get(item.id);
    if (!found) continue;

    const relPath = normalizeRelativePath(found);
    const diskName = relPath.split('/').pop() ?? '';

    if (relPath.startsWith('manuscript/')) {
      // The disk path wins; a file name carrying another id is reported.
      if (relPath !== item.file_path) {
        filePaths[item.id] = relPath;
      }
      const idInFileName = chapterIdFromFileName(diskName);
      if (idInFileName && idInFileName !== item.id) {
        mismatches.push({
          id: item.id,
          relativePath: relPath,
          idInFileName,
        });
      }
      continue;
    }

    // A lorebook file name follows the title slug: restore it when it drifted.
    const expectedName = `${titleSlug(found.title)}.md`;
    if (found.title && diskName !== expectedName) {
      const directory = relPath.slice(
        0,
        relPath.length - diskName.length
      );
      const to = `${directory}${expectedName}`;
      renames.push({ id: item.id, from: relPath, to });
      filePaths[item.id] = to;
    } else if (relPath !== item.file_path) {
      filePaths[item.id] = relPath;
    }
  }

  return { filePaths, renames, mismatches };
}

export interface DiskMembershipDiff {
  /** Files on disk whose id is not yet in memory. */
  added: DiskFileIdentifier[];
  /** In-memory ids whose file no longer exists on disk. */
  removedIds: string[];
}

/**
 * Finds files added to or deleted from `manuscript/` and `lorebook/` on disk.
 */
export function diffDiskIdentifiers(
  currentIds: Iterable<string>,
  disk: DiskFileIdentifier[]
): DiskMembershipDiff {
  const known = new Set(currentIds);
  const onDisk = new Set(disk.map((d) => d.id));
  const added = disk
    .filter((d) => !known.has(d.id))
    .map((d) => ({
      ...d,
      relativePath: normalizeRelativePath(d),
    }));
  const removedIds: string[] = [];
  for (const id of known) {
    if (!onDisk.has(id)) removedIds.push(id);
  }
  return { added, removedIds };
}
