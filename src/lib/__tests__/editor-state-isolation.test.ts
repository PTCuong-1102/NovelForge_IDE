import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Editor & Lore state isolation guard tests', () => {
  const rootDir = process.cwd();

  it('1. CharacterSheet re-syncs its local form state when the entity changes', () => {
    const code = fs.readFileSync(
      path.join(rootDir, 'src/components/lorebook/CharacterSheet.tsx'),
      'utf8'
    );
    assert(
      /import React, \{[^}]*useEffect/.test(code),
      'CharacterSheet must import useEffect'
    );
    assert(
      /useEffect\([\s\S]*?\[entity\.id[^\]]*entity\.updated_at[^\]]*\]\s*\)/.test(code) ||
        /useEffect\([\s\S]*?\[entity\.updated_at[^\]]*entity\.id[^\]]*\]\s*\)/.test(code),
      'CharacterSheet must re-sync its state when entity.id or entity.updated_at changes'
    );
  });

  it('2. RefactorRenameModal resets its form for every newly opened entity', () => {
    const code = fs.readFileSync(
      path.join(rootDir, 'src/components/modals/RefactorRenameModal.tsx'),
      'utf8'
    );
    assert(
      /import React, \{[^}]*useEffect/.test(code),
      'RefactorRenameModal must import useEffect'
    );
    assert(
      /\[refactorEntityId,\s*refactorModalOpen/.test(code),
      'RefactorRenameModal must depend on refactorEntityId and refactorModalOpen'
    );
    assert(
      code.includes('setSelectedMatchIds(new Set())'),
      'RefactorRenameModal must clear the stale match selection'
    );
  });

  it('3. NovelEditor never rewrites the raw Markdown draft while the user types', () => {
    const code = fs.readFileSync(
      path.join(rootDir, 'src/components/editor/NovelEditor.tsx'),
      'utf8'
    );
    assert(
      code.includes('setRawMarkdownDraft(serializeChapterToLosslessMarkdown(chapter))'),
      'NovelEditor must still build the raw Markdown draft'
    );
    assert(
      /useRef\((chapter\.id|'[^']*')\)/.test(code),
      'NovelEditor must remember the previous chapter id'
    );
    assert(
      /previousChapterIdRef\.current\s*!==\s*chapter\.id/.test(code),
      'the raw draft refresh must be guarded by a chapter id change'
    );
  });

  it('4. DockLayout keys the editor and the character sheet by entity id', () => {
    const code = fs.readFileSync(
      path.join(rootDir, 'src/components/workbench/DockLayout.tsx'),
      'utf8'
    );
    assert(
      /<NovelEditor\s+key=\{[^}]*\.id\}/.test(code),
      'NovelEditor must be keyed by chapter id'
    );
    assert(
      /<CharacterSheet\s+key=\{[^}]*\.id\}/.test(code),
      'CharacterSheet must be keyed by entity id'
    );
  });
});
