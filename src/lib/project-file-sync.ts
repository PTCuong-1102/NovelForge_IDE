import { chapterIdFromFileName, titleSlug } from './chapter-file-name';

export interface DiskFileIdentifier {
  relativePath: string;
  id: string;
  title: string;
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

    const diskName = found.relativePath.split('/').pop() ?? '';

    if (found.relativePath.startsWith('manuscript/')) {
      // The disk path wins; a file name carrying another id is reported.
      if (found.relativePath !== item.file_path) {
        filePaths[item.id] = found.relativePath;
      }
      const idInFileName = chapterIdFromFileName(diskName);
      if (idInFileName && idInFileName !== item.id) {
        mismatches.push({
          id: item.id,
          relativePath: found.relativePath,
          idInFileName,
        });
      }
      continue;
    }

    // A lorebook file name follows the title slug: restore it when it drifted.
    const expectedName = `${titleSlug(found.title)}.md`;
    if (found.title && diskName !== expectedName) {
      const directory = found.relativePath.slice(
        0,
        found.relativePath.length - diskName.length
      );
      const to = `${directory}${expectedName}`;
      renames.push({ id: item.id, from: found.relativePath, to });
      filePaths[item.id] = to;
    } else if (found.relativePath !== item.file_path) {
      filePaths[item.id] = found.relativePath;
    }
  }

  return { filePaths, renames, mismatches };
}
