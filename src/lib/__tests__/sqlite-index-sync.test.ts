import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('SQLite index sync guard tests', () => {
  const rootDir = process.cwd();

  it('1. The workspace store refreshes the SQLite index after a disk save', () => {
    const code = fs.readFileSync(
      path.join(rootDir, 'src/stores/useWorkspaceStore.ts'),
      'utf8'
    );
    assert(
      code.includes('scheduleSqliteSync'),
      'the store must schedule an index sync after writing to disk'
    );
    assert(
      code.includes("invokeSafe('sync_project_sqlite'"),
      'the sync must call the sync_project_sqlite IPC command'
    );
    assert(
      /scheduleSqliteSync\s*=\s*\(\)\s*=>[\s\S]*?2500/.test(code),
      'the index sync must be debounced'
    );
  });
});
