import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Simulation labelling & hardcoded demo data guard tests', () => {
  const rootDir = process.cwd();
  const read = (rel: string) =>
    fs.readFileSync(path.join(rootDir, rel), 'utf8');

  it('1. Story Composer never fabricates an MCP execution log', () => {
    const code = read('src/stores/useAgentStore.ts');
    const composer = code.slice(
      code.lastIndexOf('sendComposerPrompt:'),
      code.lastIndexOf('triggerMcpToolSimulation:')
    );
    assert(
      !composer.includes("agent_name: 'Antigravity'"),
      'the Composer must not forge an MCP tool execution log'
    );
    assert(
      composer.includes('[Mô phỏng mẫu cục bộ]'),
      'the Composer answer must be labelled as a local template simulation'
    );
  });

  it('2. The Composer panel states that the model output is simulated', () => {
    const code = read('src/components/ai-hub/RightDock.tsx');
    assert(
      code.includes('Mô phỏng (Local Template)'),
      'RightDock must label the Composer model selector as a simulation'
    );
  });

  it('3. Ghost Text never falls back to demo character or location names', () => {
    const code = read('src/components/editor/extensions/ghost-text.ts');
    assert(
      !code.includes('Lâm Vũ Linh'),
      'ghost-text must not hardcode the demo character name'
    );
    assert(
      !code.includes('Bến Cảng Đông'),
      'ghost-text must not hardcode the demo location name'
    );
    assert(
      code.includes('nhân vật chính') && code.includes('bối cảnh hiện tại'),
      'ghost-text must fall back to neutral wording'
    );
  });

  it('4. The Slash Menu inserts the real POV character and location', () => {
    const code = read('src/components/editor/NovelEditor.tsx');
    assert(
      !code.includes("+= ' Lâm Vũ Linh'"),
      'the Slash Menu must not insert a hardcoded character name'
    );
    assert(
      !code.includes("+= ' Bến Cảng Đông'"),
      'the Slash Menu must not insert a hardcoded location name'
    );
    assert(
      code.includes('chapter.pov_character_name'),
      'the Slash Menu must use the chapter POV name'
    );
  });

  it('5. Refactor Rename never targets a hardcoded demo entity id', () => {
    for (const rel of [
      'src/app/page.tsx',
      'src/components/modals/CommandPalette.tsx',
      'src/components/lorebook/RelationshipGraph.tsx',
    ]) {
      const code = read(rel);
      assert(
        !code.includes('char_linh_001'),
        `${rel} must not hardcode the demo entity id char_linh_001`
      );
    }
  });

  it('6. The What-If branch selector is labelled as a simulation', () => {
    const code = read('src/components/workbench/Sidebar.tsx');
    assert(
      code.includes('Nhánh (Mô phỏng):'),
      'Sidebar must label the branch selector as a simulation'
    );
  });

  it('7. The explorer groups chapters by their real act instead of a fixed one', () => {
    const code = read('src/components/workbench/Sidebar.tsx');
    assert(
      !code.includes('Hồi 1: Tín Hiệu Từ Đáy Biển'),
      'Sidebar must not hardcode a demo act title'
    );
    assert(
      /actGroups\s*=\s*useMemo/.test(code),
      'Sidebar must group chapters by act with useMemo'
    );
    assert(
      /allIssues\s*=\s*useMemo/.test(code),
      'Sidebar must memoise the project-wide linter run'
    );
  });

  it('8. Opening a real project drops the sample agent activity', () => {
    const agentStore = read('src/stores/useAgentStore.ts');
    assert(
      agentStore.includes('clearDemoArtifacts'),
      'the agent store must be able to drop the sample artefacts'
    );

    const workspaceStore = read('src/stores/useWorkspaceStore.ts');
    assert(
      workspaceStore.includes('clearDemoArtifacts()'),
      'opening a real project must clear the sample artefacts'
    );
    assert(
      workspaceStore.includes('loadDemoArtifacts()'),
      'the sample workspace must restore the sample artefacts'
    );
  });
});
