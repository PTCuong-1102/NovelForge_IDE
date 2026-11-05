import test from 'node:test';
import assert from 'node:assert/strict';
import { isTauri, invokeSafe, assertIpcAvailable } from '../ipc';

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
