import test from 'node:test';
import assert from 'node:assert/strict';
import { isTauri, invokeSafe, assertIpcAvailable } from '../ipc';
import { useWorkspaceStore } from './helpers/workspace-store';
import { workspacePartialize } from '@/stores/useWorkspaceStore';
import { useAgentStore } from '@/stores/useAgentStore';
import type { ChapterDocument } from '@/lib/tauri-bridge';

const makeChapter = (
  id: string,
  order: number,
  filePath: string
): ChapterDocument => ({
  id,
  act_id: 'act_01',
  act_title: 'Hồi 1',
  order,
  title: `Chương ${order}`,
  file_path: filePath,
  status: 'draft',
  pov_character_id: '',
  pov_character_name: '',
  story_date: '',
  story_year: 2026,
  location_id: '',
  location_tag: '',
  target_words: 1000,
  is_flashback: false,
  paragraphs: ['Nội dung chương.'],
  updated_at: '',
});

test('Tauri IPC Safe Bridge & Browser Fallback Tests', async (t) => {
  await t.test('1. isTauri() returns false in node / non-Tauri browser environment', () => {
    assert.strictEqual(isTauri(), false);
  });

  await t.test('2. invokeSafe returns NOT_IN_TAURI without throwing when outside Tauri', async () => {
    const res = await invokeSafe('read_markdown_file', { path: 'test.md' });
    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.strictEqual(res.error, 'NOT_IN_TAURI');
    }
  });

  await t.test('3. assertIpcAvailable throws informative error when outside Tauri', () => {
    assert.throws(
      () => {
        assertIpcAvailable();
      },
      {
        message: /Tính năng này yêu cầu môi trường desktop Tauri IPC/
      }
    );
  });
});

test('Workspace store disk-save flush behaviour', async (t) => {
  await t.test('1. demo/web mode never leaves saveStatus stuck on "saving"', () => {
    useWorkspaceStore.getState().loadDemoProject();
    useWorkspaceStore.getState().updateChapterParagraphs('ch_08', ['Mưa rơi tầm tã.']);
    assert.strictEqual(useWorkspaceStore.getState().saveStatus, 'saved');
  });

  await t.test('2. flushAllSaves returns a promise that completes', async () => {
    const pending = useWorkspaceStore.getState().flushAllSaves();
    assert.ok(pending instanceof Promise, 'flushAllSaves must return a Promise');
    await pending;
  });

  await t.test('3. createGitSnapshot awaits flushAllSaves before touching git', async () => {
    const original = useWorkspaceStore.getState().flushAllSaves;
    let flushResolved = false;
    useWorkspaceStore.setState({
      flushAllSaves: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        flushResolved = true;
      },
    });
    try {
      await useWorkspaceStore.getState().createGitSnapshot('test snapshot');
      assert.ok(flushResolved, 'createGitSnapshot must await flushAllSaves');
    } finally {
      useWorkspaceStore.setState({ flushAllSaves: original });
    }
  });

  await t.test('4. restoreSnapshot awaits flushAllSaves before touching git', async () => {
    const original = useWorkspaceStore.getState().flushAllSaves;
    let flushResolved = false;
    useWorkspaceStore.setState({
      flushAllSaves: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        flushResolved = true;
      },
    });
    try {
      await useWorkspaceStore.getState().restoreSnapshot('snap-missing');
      assert.ok(flushResolved, 'restoreSnapshot must await flushAllSaves');
    } finally {
      useWorkspaceStore.setState({ flushAllSaves: original });
    }
  });

  await t.test('5. partialize drops chapters/entities for a disk-backed project', () => {
    useWorkspaceStore.getState().loadDemoProject();
    const state = {
      ...useWorkspaceStore.getState(),
      isDemoData: false,
      rootPath: '/tmp/my-novel',
    };
    assert.ok(state.chapters.length > 0, 'fixture needs at least one chapter');

    const persisted = workspacePartialize(state);
    assert.deepEqual(persisted.chapters, []);
    assert.deepEqual(persisted.entities, []);
    assert.deepEqual(persisted.relations, []);
    assert.deepEqual(persisted.snapshots, []);
    assert.equal(persisted.rootPath, '/tmp/my-novel');
  });

  await t.test('6. partialize keeps demo chapters/entities', () => {
    useWorkspaceStore.getState().loadDemoProject();
    const state = {
      ...useWorkspaceStore.getState(),
      isDemoData: true,
      rootPath: null,
    };
    const persisted = workspacePartialize(state);
    assert.ok(persisted.chapters.length > 0);
    assert.ok(persisted.entities.length > 0);
  });

  await t.test('7. localStorage never receives disk-backed chapters', () => {
    useWorkspaceStore.getState().loadDemoProject();
    useWorkspaceStore.setState({ isDemoData: false, rootPath: '/tmp/my-novel' });

    const raw = globalThis.localStorage.getItem('novelforge-workspace-storage');
    assert.ok(raw, 'expected the persisted workspace payload');
    const parsed = JSON.parse(raw);
    assert.deepEqual(parsed.state.chapters, []);
    assert.deepEqual(parsed.state.entities, []);
    assert.equal(parsed.state.rootPath, '/tmp/my-novel');
  });

  await t.test('8. reorderChapters rewrites the order field of every chapter', () => {
    useWorkspaceStore.setState({
      chapters: [
        makeChapter('ch_01', 1, 'manuscript/act-01/ch-01.md'),
        makeChapter('ch_02', 2, 'manuscript/act-01/ch-02.md'),
        makeChapter('ch_03', 3, 'manuscript/act-01/ch-03.md'),
      ],
      openTabs: [],
    });

    useWorkspaceStore.getState().reorderChapters(2, 0);
    const after = useWorkspaceStore.getState().chapters;
    assert.deepEqual(
      after.map((c) => c.id),
      ['ch_03', 'ch_01', 'ch_02']
    );
    assert.deepEqual(
      after.map((c) => c.order),
      [1, 2, 3],
      'the order field must follow the new sequence'
    );
  });

  await t.test('9. createChapter never reuses an existing id or file path', () => {
    useWorkspaceStore.setState({
      chapters: [
        makeChapter('ch_01', 1, 'manuscript/act-01/ch-01.md'),
        makeChapter('ch_02', 1, 'manuscript/act-01/ch-02.md'),
      ],
      openTabs: [],
    });

    useWorkspaceStore.getState().createChapter('Chương mới');
    const chapters = useWorkspaceStore.getState().chapters;
    assert.equal(chapters.length, 3);
    const ids = chapters.map((c) => c.id);
    const paths = chapters.map((c) => c.file_path);
    assert.equal(new Set(ids).size, ids.length, 'chapter ids must be unique');
    assert.equal(
      new Set(paths).size,
      paths.length,
      'chapter file paths must be unique'
    );
  });

  await t.test('10. closing the active secondary tab moves the secondary selection', () => {
    useWorkspaceStore.setState({
      openTabs: [
        {
          id: 'tab-a',
          title: 'A',
          type: 'chapter',
          targetId: 'ch_01',
          pane: 'primary',
        },
        {
          id: 'tab-b',
          title: 'B',
          type: 'lore-entity',
          targetId: 'ch_01',
          pane: 'secondary',
        },
      ],
      activePrimaryTabId: 'tab-a',
      activeSecondaryTabId: 'tab-b',
    });

    useWorkspaceStore.getState().closeTab('tab-b');
    const state = useWorkspaceStore.getState();
    assert.notStrictEqual(state.activeSecondaryTabId, 'tab-b');
    assert.ok(
      state.activeSecondaryTabId === null ||
        state.openTabs.some((t) => t.id === state.activeSecondaryTabId),
      'the secondary selection must point at a tab that still exists'
    );
  });

  await t.test('11. enabling split view always selects an existing tab', () => {
    useWorkspaceStore.setState({
      openTabs: [
        {
          id: 'tab-a',
          title: 'A',
          type: 'chapter',
          targetId: 'ch_01',
          pane: 'primary',
        },
      ],
      activePrimaryTabId: 'tab-a',
      activeSecondaryTabId: null,
      splitView: false,
    });

    useWorkspaceStore.getState().toggleSplitView();
    const state = useWorkspaceStore.getState();
    assert.ok(state.splitView, 'split view must be enabled');
    assert.ok(
      state.activeSecondaryTabId,
      'split view must have a secondary tab selected'
    );
    assert.ok(
      state.openTabs.some((t) => t.id === state.activeSecondaryTabId),
      'the secondary selection must exist in openTabs'
    );
  });

  await t.test('12. the sample agent activity never survives into a real project', () => {    useWorkspaceStore.getState().loadDemoProject();
    assert.ok(
      useAgentStore.getState().mcpLogs.length > 0,
      'the sample workspace shows the sample activity'
    );

    useAgentStore.getState().clearDemoArtifacts();
    assert.strictEqual(useAgentStore.getState().mcpLogs.length, 0);
    assert.strictEqual(useAgentStore.getState().composerMessages.length, 0);
    assert.strictEqual(useAgentStore.getState().diffProposals.length, 0);
    assert.strictEqual(useAgentStore.getState().pinnedContextIds.length, 0);
  });

  await t.test('13. the demo snapshot restore asks for confirmation', async () => {
    const confirmCalls: string[] = [];
    (globalThis as unknown as { window: unknown }).window = {
      confirm: (message: string) => {
        confirmCalls.push(message);
        return true;
      },
    };
    try {
      useWorkspaceStore.getState().loadDemoProject();
      await useWorkspaceStore.getState().restoreSnapshot('snap-missing');
      assert.strictEqual(
        confirmCalls.length,
        1,
        'the demo restore must ask for confirmation exactly once'
      );
    } finally {
      delete (globalThis as unknown as { window?: unknown }).window;
    }
  });
});
