/**
 * Unified Safe Tauri IPC Bridge with Browser Fallback
 */

export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
  );
}

export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function invokeSafe<T>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<IpcResult<T>> {
  if (!isTauri()) {
    return { ok: false, error: 'NOT_IN_TAURI' };
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const data = await invoke<T>(cmd, args);
    return { ok: true, data };
  } catch (err: unknown) {
    // Rust errors: FsError/GitError serialize as { kind, message }.
    if (
      typeof err === 'object' &&
      err !== null &&
      'message' in err &&
      typeof (err as { message?: unknown }).message === 'string'
    ) {
      const e = err as { kind?: string; message: string };
      return {
        ok: false,
        error: e.kind ? `[${e.kind}] ${e.message}` : e.message,
      };
    }
    const message =
      err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
    return { ok: false, error: message };
  }
}

export function assertIpcAvailable(): void {
  if (!isTauri()) {
    throw new Error(
      'Tính năng này yêu cầu môi trường desktop Tauri IPC. Hiện tại ứng dụng đang chạy ở chế độ Web Demo.'
    );
  }
}
