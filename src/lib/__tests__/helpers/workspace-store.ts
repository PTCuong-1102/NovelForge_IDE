/**
 * Imports the persisted workspace store with a working `localStorage` stand-in.
 *
 * The polyfill module must be evaluated BEFORE the store module, otherwise the
 * store captures an unusable storage handle and every `set()` throws.
 */
import './memory-storage';

export { useWorkspaceStore } from '@/stores/useWorkspaceStore';
