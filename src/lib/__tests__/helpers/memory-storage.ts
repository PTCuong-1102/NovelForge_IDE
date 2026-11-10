/**
 * Node's `localStorage` global is unusable inside `node:test` (it resolves to
 * `undefined` unless `--localstorage-file` is passed), which makes the persisted
 * Zustand store throw on every `set()`. This installs an in-memory stand-in so
 * store actions can be exercised by unit tests.
 */
const memory = new Map<string, string>();

const shim = {
  getItem: (key: string): string | null => memory.get(key) ?? null,
  setItem: (key: string, value: string): void => {
    memory.set(key, value);
  },
  removeItem: (key: string): void => {
    memory.delete(key);
  },
  clear: (): void => {
    memory.clear();
  },
  key: (index: number): string | null => Array.from(memory.keys())[index] ?? null,
  get length(): number {
    return memory.size;
  },
};

Object.defineProperty(globalThis, 'localStorage', {
  value: shim,
  configurable: true,
  writable: true,
});
