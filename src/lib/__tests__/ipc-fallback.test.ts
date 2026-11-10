import test from 'node:test';
import assert from 'node:assert/strict';
import { isTauri, invokeSafe, assertIpcAvailable } from '../ipc';
import { useWorkspaceStore } from './helpers/workspace-store';

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
});
