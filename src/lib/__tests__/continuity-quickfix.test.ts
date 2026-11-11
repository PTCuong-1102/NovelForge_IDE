import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Continuity quick fix & snapshot restore guard tests', () => {
  const rootDir = process.cwd();
  const read = (rel: string) =>
    fs.readFileSync(path.join(rootDir, rel), 'utf8');

  it('1. The snapshot restore asks for confirmation exactly once', () => {
    const sidebar = read('src/components/workbench/Sidebar.tsx');
    assert(
      !/confirm\(\s*`Bạn có chắc chắn muốn khôi phục/.test(sidebar),
      'the Sidebar must not open a second confirmation dialog'
    );
    assert(
      sidebar.includes('restoreSnapshot(snap.id)'),
      'the Sidebar must still trigger the restore'
    );

    const store = read('src/stores/useWorkspaceStore.ts');
    assert(
      store.includes('window.confirm('),
      'the store owns the single confirmation dialog'
    );
  });

  it('2. Every quick fix action is handled in the Continuity Inspector', () => {
    const sidebar = read('src/components/workbench/Sidebar.tsx');
    for (const action of [
      'ignore_rule',
      'revive_entity',
      'mark_flashback',
      'replace_synonym',
    ]) {
      assert(
        sidebar.includes(`qf.action === '${action}'`),
        `the Sidebar must handle the ${action} quick fix`
      );
    }
    assert(
      sidebar.includes('applyParagraphFix'),
      'the Sidebar must apply the paragraph level fixes'
    );
  });

  it('3. Accepting or rejecting a proposal also resolves the file on disk', () => {
    const editor = read('src/components/editor/NovelEditor.tsx');
    assert(
      editor.includes('dismiss_edit_proposal'),
      'the editor must tell the backend that the proposal is handled'
    );
    assert(
      editor.includes('dismissProposalFile'),
      'accept and reject must both dismiss the proposal file'
    );
  });

  it('4. The frontend linter checks every character profile, not a fixed name', () => {
    const bridge = read('src/lib/tauri-bridge.ts');
    assert(
      !bridge.includes("lower.includes('lâm vũ linh')"),
      'the attribute rule must not be hardcoded to a demo character'
    );
    assert(
      !bridge.includes("entity_id: 'char_linh_001'"),
      'the attribute rule must not report a fixed entity id'
    );
    assert(
      bridge.includes('ATTRIBUTE_CONFLICTS'),
      'the attribute rule must use the shared conflict table'
    );
  });

  it('5. The editor quick fix uses the replacement carried by the quick fix', () => {
    const editor = read('src/components/editor/NovelEditor.tsx');
    assert(
      !editor.includes("issue.matched_text === 'lạnh lẽo'"),
      'the editor must not hardcode the pacing phrase'
    );
    assert(
      !editor.includes("issue.matched_text === 'tóc dài'"),
      'the editor must not hardcode the hair phrase'
    );
    assert(
      editor.includes('quickFix.replacement'),
      'the editor must use the replacement carried by the quick fix'
    );
  });
});
