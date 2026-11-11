import { chapterIdFromFileName } from './chapter-file-name';

export interface DiskFileIdentifier {
  relativePath: string;
  id: string;
  title: string;
}

export interface IdentifierReconciliation {
  /** The new relative path of every id whose file moved on disk. */
  filePaths: Record<string, string>;
  /** Files whose name no longer matches the id they declare. */
  mismatches: Array<{
    id: string;
    relativePath: string;
    idInFileName: string | null;
  }>;
}

/**
 * Compares the identifiers held in memory with the ones read from the disk.
 *
 * A file renamed outside the application keeps its frontmatter id, so the id
 * still matches — only the path moved. A chapter whose file name carries a
 * different id was renamed by hand: the app reports it instead of guessing.
 */
export function reconcileIdentifiers(
  current: Array<{ id: string; file_path: string }>,
  disk: DiskFileIdentifier[]
): IdentifierReconciliation {
  const byId = new Map(disk.map((file) => [file.id, file]));
  const filePaths: Record<string, string> = {};
  const mismatches: IdentifierReconciliation['mismatches'] = [];

  for (const item of current) {
    const found = byId.get(item.id);
    if (!found) continue;

    if (found.relativePath !== item.file_path) {
      filePaths[item.id] = found.relativePath;
    }

    if (!found.relativePath.startsWith('manuscript/')) continue;

    const fileName = found.relativePath.split('/').pop() ?? '';
    const idInFileName = chapterIdFromFileName(fileName);
    if (idInFileName && idInFileName !== item.id) {
      mismatches.push({
        id: item.id,
        relativePath: found.relativePath,
        idInFileName,
      });
    }
  }

  return { filePaths, mismatches };
}
