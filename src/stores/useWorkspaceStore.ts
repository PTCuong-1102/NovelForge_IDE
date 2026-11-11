import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  ChapterDocument,
  CharacterRelationEdge,
  LoreEntity,
  StorySnapshot,
  ThemeMode,
  countVietnameseAndLatinWords,
} from '@/lib/tauri-bridge';
import {
  DEMO_CHAPTERS,
  DEMO_ENTITIES,
  DEMO_RELATIONS,
  DEMO_SNAPSHOTS,
  createDemoWorkspace,
} from '@/lib/ipc-demo';
import { isTauri, invokeSafe } from '@/lib/ipc';
import { replaceWholeWordUnicode } from '@/lib/word-boundary';
import { useAgentStore } from '@/stores/useAgentStore';
import {
  loadProject,
  saveChapterToDisk,
  saveEntityToDisk,
} from '@/lib/project-io';

export type LeftActivityView =
  | 'explorer'
  | 'lorebook'
  | 'search'
  | 'git'
  | 'inspector';

export type CenterTabType =
  | 'chapter'
  | 'lore-entity'
  | 'lore-database'
  | 'relationship-graph'
  | 'timeline-board';

export interface OpenWorkbenchTab {
  id: string;
  title: string;
  type: CenterTabType;
  targetId: string;
  pane: 'primary' | 'secondary';
}

export interface WorkspaceState {
  projectName: string;
  theme: ThemeMode;
  activeActivity: LeftActivityView;
  leftSidebarOpen: boolean;
  rightDockOpen: boolean;
  zenMode: boolean;
  splitView: boolean;
  activeBranch: string;
  availableBranches: string[];
  saveStatus: 'saved' | 'saving' | 'unsaved';
  isDemoData: boolean;
  rootPath: string | null;

  isProjectLoading: boolean;
  ipcNotice: string | null;
  openTabs: OpenWorkbenchTab[];
  activePrimaryTabId: string;
  activeSecondaryTabId: string | null;

  chapters: ChapterDocument[];
  entities: LoreEntity[];
  relations: CharacterRelationEdge[];
  snapshots: StorySnapshot[];

  // Actions
  setTheme: (theme: ThemeMode) => void;
  setActiveActivity: (view: LeftActivityView) => void;
  toggleLeftSidebar: () => void;
  toggleRightDock: () => void;
  toggleZenMode: () => void;
  toggleSplitView: () => void;
  openTab: (tab: Omit<OpenWorkbenchTab, 'pane'>, pane?: 'primary' | 'secondary') => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string, pane: 'primary' | 'secondary') => void;

  updateChapterParagraphs: (chapterId: string, paragraphs: string[]) => void;
  updateChapterMetadata: (chapterId: string, patch: Partial<ChapterDocument>) => void;
  updateEntity: (entityId: string, patch: Partial<LoreEntity>) => void;
  createEntity: (entity: LoreEntity) => void;
  createChapter: (title: string) => void;
  reorderChapters: (fromIndex: number, toIndex: number) => void;
  applyRefactorRename: (
    entityId: string,
    newName: string,
    newAliases: string[],
    selectedMatchIds: Set<string>,
    aliasMap: { from: string; to: string }[]
  ) => void;
  createGitSnapshot: (label: string) => Promise<void>;
  restoreSnapshot: (snapshotId: string) => Promise<void>;
  createWhatIfBranch: (branchName: string) => void;
  switchBranch: (branchName: string) => void;
  loadDemoProject: () => void;
  closeProject: () => Promise<void>;
  openProjectFromDialog: () => Promise<void>;
  /** Writes every pending debounced save to disk and waits for it to finish. */
  flushAllSaves: () => Promise<void>;
  /** Re-reads chapters, entities and snapshots from disk (desktop, real project). */
  reloadCurrentProjectFromDisk: () => Promise<void>;
  dismissIpcNotice: () => void;
  resetToDefaults: () => void;
  exportProjectJson: () => string;
  importProjectJson: (jsonString: string) => boolean;
}

const INITIAL_ENTITIES = DEMO_ENTITIES;
const INITIAL_CHAPTERS = DEMO_CHAPTERS;
const INITIAL_RELATIONS = DEMO_RELATIONS;
const INITIAL_SNAPSHOTS = DEMO_SNAPSHOTS;

export interface PersistedWorkspaceState {
  projectName: string;
  theme: ThemeMode;
  chapters: ChapterDocument[];
  entities: LoreEntity[];
  relations: CharacterRelationEdge[];
  snapshots: StorySnapshot[];
  activeBranch: string;
  availableBranches: string[];
  isDemoData: boolean;
  rootPath: string | null;
  openTabs: OpenWorkbenchTab[];
  activePrimaryTabId: string;
  activeSecondaryTabId: string | null;
}

/**
 * Only demo workspaces may be cached in `localStorage`: a disk-backed project is
 * re-read from disk on startup, so caching its chapters would overwrite real files
 * and blow the 5 MB storage quota.
 */
export function workspacePartialize(
  state: WorkspaceState
): PersistedWorkspaceState {
  const isDemo = state.isDemoData;
  return {
    projectName: state.projectName,
    theme: state.theme,
    chapters: isDemo ? state.chapters : [],
    entities: isDemo ? state.entities : [],
    relations: isDemo ? state.relations : [],
    snapshots: isDemo ? state.snapshots : [],
    activeBranch: state.activeBranch,
    availableBranches: state.availableBranches,
    isDemoData: state.isDemoData,
    rootPath: state.rootPath,
    openTabs: state.openTabs,
    activePrimaryTabId: state.activePrimaryTabId,
    activeSecondaryTabId: state.activeSecondaryTabId,
  };
}

// --- Disk persistence (debounced; no-op outside Tauri or in demo mode) ---
const chapterSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const entitySaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

let getStateRef: (() => WorkspaceState) | null = null;

const debounceKey = (
  map: Map<string, ReturnType<typeof setTimeout>>,
  key: string,
  ms: number,
  fn: () => void
) => {
  const prev = map.get(key);
  if (prev) clearTimeout(prev);
  map.set(
    key,
    setTimeout(() => {
      map.delete(key);
      fn();
    }, ms)
  );
};

const persistChapter = (chapterId: string) => {
  if (!getStateRef) return;
  const s = getStateRef();
  if (!isTauri() || s.isDemoData || !s.rootPath) return;
  debounceKey(chapterSaveTimers, chapterId, 1000, () => {
    const cur = getStateRef!();
    const ch = cur.chapters.find((c) => c.id === chapterId);
    if (!ch || !cur.rootPath) return;
    useWorkspaceStore.setState({ saveStatus: 'saving' });
    saveChapterToDisk(cur.rootPath, ch).then((res) => {
      useWorkspaceStore.setState((prev) => ({
        saveStatus: res.ok ? 'saved' : 'unsaved',
        ipcNotice: res.ok
          ? prev.ipcNotice
          : prev.ipcNotice ?? `Không lưu được ${ch.file_path}: ${res.error ?? 'unknown error'}`,
      }));
      if (res.ok) scheduleSqliteSync();
    });
  });
};

const persistEntity = (entityId: string) => {
  if (!getStateRef) return;
  const s = getStateRef();
  if (!isTauri() || s.isDemoData || !s.rootPath) return;
  debounceKey(entitySaveTimers, entityId, 1500, () => {
    const cur = getStateRef!();
    const entity = cur.entities.find((e) => e.id === entityId);
    if (!entity || !cur.rootPath) return;
    saveEntityToDisk(cur.rootPath, entity).then((res) => {
      if (!res.ok) {
        useWorkspaceStore.setState((prev) => ({
          ipcNotice:
            prev.ipcNotice ??
            `Không lưu được ${entity.file_path}: ${res.error ?? 'unknown error'}`,
        }));
        return;
      }
      scheduleSqliteSync();
    });
  });
};

const persistAllChapters = () => {
  if (!getStateRef) return;
  for (const ch of getStateRef().chapters) persistChapter(ch.id);
};

/** True only when a real disk write can happen (desktop app, real project). */
const canWriteToDisk = (s: WorkspaceState): boolean =>
  isTauri() && !s.isDemoData && Boolean(s.rootPath);

/** Asks the user to confirm a destructive action; proceeds when there is no UI. */
const askConfirm = (message: string): boolean =>
  typeof window === 'undefined' ? true : window.confirm(message);

// --- SQLite index sync (debounced; only for real desktop projects) ---
let sqliteSyncTimer: ReturnType<typeof setTimeout> | null = null;

/** Rebuilds `.novelforge/index.sqlite` shortly after a file was written. */
const scheduleSqliteSync = () => {
  if (!getStateRef) return;
  const s = getStateRef();
  if (!canWriteToDisk(s) || !s.rootPath) return;
  const projectRoot = s.rootPath;
  if (sqliteSyncTimer) clearTimeout(sqliteSyncTimer);
  sqliteSyncTimer = setTimeout(() => {
    sqliteSyncTimer = null;
    void invokeSafe('sync_project_sqlite', { projectRoot });
  }, 2500);
};

const flushChapterSave = async (chapterId: string): Promise<boolean> => {
  const pending = chapterSaveTimers.get(chapterId);
  if (!pending) return true;
  clearTimeout(pending);
  chapterSaveTimers.delete(chapterId);
  if (!getStateRef) return true;
  const cur = getStateRef();
  const ch = cur.chapters.find((c) => c.id === chapterId);
  if (!ch || !cur.rootPath || !canWriteToDisk(cur)) return true;

  const res = await saveChapterToDisk(cur.rootPath, ch);
  if (res.ok) {
    scheduleSqliteSync();
    return true;
  }
  useWorkspaceStore.setState((prev) => ({
    saveStatus: 'unsaved',
    ipcNotice:
      prev.ipcNotice ??
      `Không lưu được ${ch.file_path}: ${res.error ?? 'unknown error'}`,
  }));
  return false;
};

const flushEntitySave = async (entityId: string): Promise<boolean> => {
  const pending = entitySaveTimers.get(entityId);
  if (!pending) return true;
  clearTimeout(pending);
  entitySaveTimers.delete(entityId);
  if (!getStateRef) return true;
  const cur = getStateRef();
  const entity = cur.entities.find((e) => e.id === entityId);
  if (!entity || !cur.rootPath || !canWriteToDisk(cur)) return true;

  const res = await saveEntityToDisk(cur.rootPath, entity);
  if (res.ok) {
    scheduleSqliteSync();
    return true;
  }
  useWorkspaceStore.setState((prev) => ({
    saveStatus: 'unsaved',
    ipcNotice:
      prev.ipcNotice ??
      `Không lưu được ${entity.file_path}: ${res.error ?? 'unknown error'}`,
  }));
  return false;
};

const flushAllChapterSaves = (): Promise<boolean[]> =>
  Promise.all([...chapterSaveTimers.keys()].map(flushChapterSave));

const flushAllEntitySaves = (): Promise<boolean[]> =>
  Promise.all([...entitySaveTimers.keys()].map(flushEntitySave));

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => {
      getStateRef = get;
      return {
      projectName: '',
      theme: 'obsidian',
      activeActivity: 'explorer',
      leftSidebarOpen: true,
      rightDockOpen: true,
      zenMode: false,
      splitView: false,
      activeBranch: 'main',
      availableBranches: ['main'],
      saveStatus: 'saved',
      isDemoData: false,
      rootPath: null,
      isProjectLoading: false,
      ipcNotice: null,

      openTabs: [],
      activePrimaryTabId: '',
      activeSecondaryTabId: null,

      chapters: [],
      entities: [],
      relations: [],
      snapshots: [],

      setTheme: (theme) => set({ theme }),

      setActiveActivity: (view) =>
        set((state) => ({
          activeActivity: view,
          leftSidebarOpen:
            state.activeActivity === view ? !state.leftSidebarOpen : true,
        })),

      toggleLeftSidebar: () =>
        set((state) => ({ leftSidebarOpen: !state.leftSidebarOpen })),

      toggleRightDock: () =>
        set((state) => ({ rightDockOpen: !state.rightDockOpen })),

      toggleZenMode: () => set((state) => ({ zenMode: !state.zenMode })),

      toggleSplitView: () =>
        set((state) => {
          const nextSplit = !state.splitView;
          if (!nextSplit) {
            return { splitView: false };
          }

          const existingSecondary = state.openTabs.find(
            (t) => t.pane === 'secondary'
          );
          if (existingSecondary) {
            return {
              splitView: true,
              activeSecondaryTabId: existingSecondary.id,
            };
          }

          // Split the second open tab into the right pane.
          const second = state.openTabs.find(
            (t) => t.pane === 'primary' && t.id !== state.activePrimaryTabId
          );
          if (second) {
            return {
              splitView: true,
              openTabs: state.openTabs.map((t) =>
                t.id === second.id ? { ...t, pane: 'secondary' as const } : t
              ),
              activeSecondaryTabId: second.id,
            };
          }

          // Nothing to split: open the lore database in the right pane.
          const loreTab: OpenWorkbenchTab = {
            id: 'tab-lore-db',
            title: 'Lorebook Database',
            type: 'lore-database',
            targetId: 'lore-all',
            pane: 'secondary',
          };
          return {
            splitView: true,
            openTabs: [...state.openTabs, loreTab],
            activeSecondaryTabId: loreTab.id,
          };
        }),

      openTab: (newTab, pane = 'primary') =>
        set((state) => {
          const existing = state.openTabs.find(
            (t) => t.targetId === newTab.targetId && t.type === newTab.type
          );
          if (existing) {
            if (pane === 'secondary') {
              return {
                splitView: true,
                activeSecondaryTabId: existing.id,
              };
            }
            return { activePrimaryTabId: existing.id };
          }

          const created: OpenWorkbenchTab = { ...newTab, pane };
          return {
            openTabs: [...state.openTabs, created],
            ...(pane === 'secondary'
              ? { splitView: true, activeSecondaryTabId: created.id }
              : { activePrimaryTabId: created.id }),
          };
        }),

      closeTab: (tabId) =>
        set((state) => {
          if (state.openTabs.length <= 1) return state;
          const filtered = state.openTabs.filter((t) => t.id !== tabId);
          let nextPrimary = state.activePrimaryTabId;
          if (nextPrimary === tabId) {
            nextPrimary = filtered[0]?.id || '';
          }
          const nextSecondary =
            state.activeSecondaryTabId === tabId
              ? filtered.find((t) => t.pane === 'secondary')?.id ??
                filtered[0]?.id ??
                null
              : state.activeSecondaryTabId;
          return {
            openTabs: filtered,
            activePrimaryTabId: nextPrimary,
            activeSecondaryTabId: nextSecondary,
          };
        }),

      setActiveTab: (tabId, pane) =>
        set(() =>
          pane === 'secondary'
            ? { activeSecondaryTabId: tabId }
            : { activePrimaryTabId: tabId }
        ),

      updateChapterParagraphs: (chapterId, paragraphs) => {
        set((state) => ({
          saveStatus: canWriteToDisk(state) ? 'saving' : 'saved',
          chapters: state.chapters.map((ch) =>
            ch.id === chapterId
              ? { ...ch, paragraphs, updated_at: new Date().toISOString() }
              : ch
          ),
        }));
        persistChapter(chapterId);
      },

      updateChapterMetadata: (chapterId, patch) => {
        set((state) => ({
          saveStatus: canWriteToDisk(state) ? 'saving' : 'saved',
          chapters: state.chapters.map((ch) =>
            ch.id === chapterId
              ? { ...ch, ...patch, updated_at: new Date().toISOString() }
              : ch
          ),
        }));
        persistChapter(chapterId);
      },

      updateEntity: (entityId, patch) => {
        set((state) => ({
          entities: state.entities.map((e) =>
            e.id === entityId
              ? { ...e, ...patch, updated_at: new Date().toISOString() }
              : e
          ),
        }));
        persistEntity(entityId);
      },

      createEntity: (entity) => {
        set((state) => ({
          entities: [...state.entities, entity],
        }));
        persistEntity(entity.id);
      },

      createChapter: (title) => {
        const state = get();
        const usedIds = new Set(state.chapters.map((c) => c.id));
        const usedPaths = new Set(state.chapters.map((c) => c.file_path));
        const pad = (n: number) => String(n).padStart(2, '0');
        // Pick the first free slot: both the id and the file path must be unused.
        let n =
          state.chapters.reduce((max, c) => Math.max(max, c.order), 0) + 1;
        while (
          usedIds.has(`ch_${pad(n)}`) ||
          usedPaths.has(`manuscript/act-01/ch-${pad(n)}.md`)
        ) {
          n += 1;
        }
        const nextOrder = n;
        const newId = `ch_${pad(nextOrder)}`;
        const newChapter: ChapterDocument = {
          id: newId,
          act_id: 'act_01',
          act_title: 'Hồi 1',
          order: nextOrder,
          title: title || `Chương ${nextOrder}: Phân Cảnh Mới`,
          file_path: `manuscript/act-01/ch-${pad(nextOrder)}.md`,
          status: 'draft',
          pov_character_id: '',
          pov_character_name: '',
          story_date: '',
          story_year: new Date().getFullYear(),
          location_id: '',
          location_tag: '',
          target_words: 3000,
          is_flashback: false,
          paragraphs: [
            'Bắt đầu viết phân cảnh mới tại đây. Gõ / để mở Slash Command.',
          ],
          updated_at: new Date().toISOString(),
        };
        const tabId = `tab-${newId}`;
        set({
          chapters: [...state.chapters, newChapter],
          openTabs: [
            ...state.openTabs,
            {
              id: tabId,
              title: newChapter.title,
              type: 'chapter',
              targetId: newId,
              pane: 'primary',
            },
          ],
          activePrimaryTabId: tabId,
        });
        persistChapter(newId);
      },

      reorderChapters: (fromIndex, toIndex) => {
        set((state) => {
          const next = [...state.chapters];
          const [moved] = next.splice(fromIndex, 1);
          if (!moved) return state;
          next.splice(toIndex, 0, moved);
          return { chapters: next.map((ch, idx) => ({ ...ch, order: idx + 1 })) };
        });
        persistAllChapters();
      },

      applyRefactorRename: (
        entityId,
        newName,
        newAliases,
        selectedMatchIds,
        aliasMap
      ) => {
        set((state) => {
          const targetEntity = state.entities.find((e) => e.id === entityId);
          if (!targetEntity) return state;

          const pairs: { from: string; to: string }[] = [
            { from: targetEntity.title, to: newName },
            ...aliasMap.filter((a) => a.from.trim() && a.to.trim()),
          ];

          const updatedChapters = state.chapters.map((ch) => {
            const nextParagraphs = ch.paragraphs.map((para, pIdx) => {
              let nextPara = para;
              for (const pair of pairs) {
                const matchId = `ref-${ch.id}-p${pIdx}-${pair.from}`;
                if (selectedMatchIds.has(matchId)) {
                  nextPara = replaceWholeWordUnicode(nextPara, pair.from, pair.to);
                }
              }
              return nextPara;
            });

            return {
              ...ch,
              pov_character_name:
                ch.pov_character_id === entityId ? newName : ch.pov_character_name,
              paragraphs: nextParagraphs,
            };
          });

          const updatedEntities = state.entities.map((e) =>
            e.id === entityId
              ? {
                  ...e,
                  title: newName,
                  aliases: newAliases,
                  body: replaceWholeWordUnicode(
                    e.body,
                    targetEntity.title,
                    newName
                  ),
                  updated_at: new Date().toISOString(),
                }
              : e
          );

          const updatedTabs = state.openTabs.map((t) =>
            t.targetId === entityId ? { ...t, title: newName } : t
          );

          return {
            chapters: updatedChapters,
            entities: updatedEntities,
            openTabs: updatedTabs,
          };
        });
        persistAllChapters();
        persistEntity(entityId);
      },

      flushAllSaves: async () => {
        const results = [
          ...(await flushAllChapterSaves()),
          ...(await flushAllEntitySaves()),
        ];
        if (results.every(Boolean)) {
          set({ saveStatus: 'saved' });
        }
      },

      reloadCurrentProjectFromDisk: async () => {
        const s = get();
        if (!isTauri() || s.isDemoData || !s.rootPath) return;

        const res = await loadProject(s.rootPath);
        if (!res.ok) {
          set({
            saveStatus: 'unsaved',
            ipcNotice: `Không tải lại được project từ đĩa: ${res.error}`,
          });
          return;
        }

        const snaps = await invokeSafe<StorySnapshot[]>('list_snapshots', {
          projectRoot: s.rootPath,
        });
        set({
          projectName: res.data.projectName,
          chapters: res.data.chapters,
          entities: res.data.entities,
          snapshots: snaps.ok ? snaps.data : s.snapshots,
          saveStatus: 'saved',
        });
        useAgentStore.getState().clearDemoArtifacts();
      },

      createGitSnapshot: async (label) => {
        const finalLabel =
          label ||
          `Snapshot tự động (${new Date().toLocaleTimeString('vi-VN')})`;

        // Every pending edit must reach the disk before Git reads the work tree.
        await get().flushAllSaves();

        const snapshotLabelState = get();

        if (
          isTauri() &&
          !snapshotLabelState.isDemoData &&
          snapshotLabelState.rootPath
        ) {
          const projectRoot = snapshotLabelState.rootPath;
          set({ saveStatus: 'saving' });
          const res = await invokeSafe<StorySnapshot>('create_snapshot', {
            projectRoot,
            label: finalLabel,
          });
          if (res.ok) {
            set((prev) => ({
              snapshots: [res.data, ...prev.snapshots],
              saveStatus: 'saved',
              ipcNotice: null,
            }));
          } else {
            set({
              saveStatus: 'saved',
              ipcNotice: res.error.includes('NOTHING_TO_COMMIT')
                ? null
                : `Snapshot thất bại: ${res.error}`,
            });
          }
          return;
        }

        // Browser / demo fallback: local in-memory snapshot.
        set((state) => {
          const snapMap: Record<string, string[]> = {};
          state.chapters.forEach((c) => {
            snapMap[c.id] = [...c.paragraphs];
          });
          const totalWords = state.chapters.reduce(
            (acc, ch) =>
              acc + countVietnameseAndLatinWords(ch.paragraphs.join(' ')),
            0
          );
          const prevTotal = state.snapshots[0]?.total_words ?? 0;
          const newSnap: StorySnapshot = {
            id: `snap-${Date.now()}`,
            branch_name: state.activeBranch,
            label: finalLabel,
            timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
            word_count_delta: totalWords - prevTotal,
            total_words: totalWords,
            chapter_snapshots: snapMap,
          };
          return {
            snapshots: [newSnap, ...state.snapshots],
            saveStatus: 'saved',
          };
        });
      },

      restoreSnapshot: async (snapshotId) => {
        // Pending edits must be flushed before Git rewrites the work tree.
        await get().flushAllSaves();

        const snapshotState = get();
        const snap = snapshotState.snapshots.find((s) => s.id === snapshotId);
        const projectRoot = snapshotState.rootPath;
        const isRealProject =
          isTauri() && !snapshotState.isDemoData && Boolean(projectRoot);

        // One confirmation for every mode — the demo restore rewrites the
        // in-memory manuscript too.
        const confirmed = askConfirm(
          isRealProject
            ? `Khôi phục snapshot "${snap?.label ?? snapshotId}"?\n\nChỉ manuscript/ và lorebook/ sẽ được ghi đè theo nội dung tại thời điểm snapshot. Các tệp khác không bị ảnh hưởng, và lịch sử git không bị xóa.`
            : `Khôi phục snapshot "${snap?.label ?? snapshotId}"?\n\n(Chế độ demo — chỉ khôi phục trong bộ nhớ của phiên, không ghi xuống đĩa.)`
        );
        if (!confirmed) return;

        if (isRealProject && projectRoot) {
          set({ saveStatus: 'saving' });
          const res = await invokeSafe('restore_snapshot', {
            projectRoot,
            snapshotId,
            confirm: true,
          });
          if (!res.ok) {
            set({
              saveStatus: 'unsaved',
              ipcNotice: `Không khôi phục được: ${res.error}`,
            });
            return;
          }
          const reload = await loadProject(projectRoot);
          if (reload.ok) {
            set({
              chapters: reload.data.chapters,
              entities: reload.data.entities,
              saveStatus: 'saved',
              ipcNotice: 'Đã khôi phục snapshot (chỉ manuscript/ và lorebook/).',
            });
          } else {
            set({
              saveStatus: 'unsaved',
              ipcNotice: `Đã khôi phục nhưng tải lại thất bại: ${reload.error}`,
            });
          }
          return;
        }

        // Browser / demo fallback — local in-memory restore.
        set((state) => {
          const targetSnap = state.snapshots.find((s) => s.id === snapshotId);
          if (!targetSnap || !targetSnap.chapter_snapshots) return state;

          const restoredChapters = state.chapters.map((ch) => {
            const savedParagraphs = targetSnap.chapter_snapshots?.[ch.id];
            if (savedParagraphs) {
              return {
                ...ch,
                paragraphs: [...savedParagraphs],
                updated_at: new Date().toISOString(),
              };
            }
            return ch;
          });

          return {
            chapters: restoredChapters,
            activeBranch: targetSnap.branch_name,
            saveStatus: 'saved',
          };
        });
      },

      createWhatIfBranch: (branchName) =>
        set((state) => {
          const formatted = branchName.startsWith('what-if/')
            ? branchName
            : `what-if/${branchName.toLowerCase().replace(/\s+/g, '-')}`;
          return {
            availableBranches: state.availableBranches.includes(formatted)
              ? state.availableBranches
              : [...state.availableBranches, formatted],
            activeBranch: formatted,
          };
        }),

      switchBranch: (branchName) => set({ activeBranch: branchName }),

      dismissIpcNotice: () => set({ ipcNotice: null }),

      openProjectFromDialog: async () => {
        if (!isTauri()) {
          set({
            ipcNotice:
              'Mở thư mục chỉ hoạt động trong bản desktop. Trong trình duyệt, hãy dùng "Mở project demo".',
          });
          return;
        }
        await get().flushAllSaves();
        set({ isProjectLoading: true, ipcNotice: null });
        try {
          const { open } = await import('@tauri-apps/plugin-dialog');
          const picked = await open({
            directory: true,
            title: 'Chọn thư mục project novel',
          });
          if (!picked || typeof picked !== 'string') {
            set({ isProjectLoading: false });
            return;
          }
          const res = await loadProject(picked);
          if (!res.ok) {
            set({
              isProjectLoading: false,
              ipcNotice: `Không mở được project: ${res.error}`,
            });
            return;
          }
          const first = res.data.chapters[0];
          const firstTabId = first ? `tab-${first.id}` : 'tab-lore-db';
          const openingTabs: OpenWorkbenchTab[] = first
            ? [
                {
                  id: firstTabId,
                  title: first.title,
                  type: 'chapter' as const,
                  targetId: first.id,
                  pane: 'primary' as const,
                },
              ]
            : [
                {
                  id: 'tab-lore-db',
                  title: 'Lorebook Database',
                  type: 'lore-database' as const,
                  targetId: 'lore-all',
                  pane: 'primary' as const,
                },
              ];
          set({
            isProjectLoading: false,
            isDemoData: false,
            projectName: res.data.projectName,
            rootPath: picked,
            chapters: res.data.chapters,
            entities: res.data.entities,
            relations: [],
            snapshots: [],
            availableBranches: ['main'],
            activeBranch: 'main',
            openTabs: openingTabs,
            activePrimaryTabId: firstTabId,
            activeSecondaryTabId: null,
            saveStatus: 'saved',
            ipcNotice:
              res.data.chapters.length === 0 && res.data.entities.length === 0
                ? 'Thư mục này chưa có manuscript/*.md hoặc lorebook/*.md — hãy thêm nội dung rồi mở lại.'
                : null,
          });
          // A real project must not show the sample workspace activity.
          useAgentStore.getState().clearDemoArtifacts();
          // Best-effort: restore snapshot timeline from git history.
          const snaps = await invokeSafe<StorySnapshot[]>('list_snapshots', {
            projectRoot: picked,
          });
          if (snaps.ok) {
            set({ snapshots: snaps.data });
          }
        } catch (e) {
          set({
            isProjectLoading: false,
            ipcNotice: `Không mở được project: ${e instanceof Error ? e.message : String(e)}`,
          });
        }
      },

      loadDemoProject: () => {
        const demo = createDemoWorkspace();
        useAgentStore.getState().loadDemoArtifacts();
        set({
          isProjectLoading: false,
          isDemoData: true,
          projectName: demo.projectName,
          chapters: demo.chapters,
          entities: demo.entities,
          relations: demo.relations,
          snapshots: demo.snapshots,
          availableBranches: [
            'main',
            'what-if/tran-hao-con-song',
            'what-if/linh-phan-boi-aegis',
          ],
          activeBranch: 'main',
          rootPath: null,
          openTabs: [
            {
              id: 'tab-ch-08',
              title: 'Ch.08: Đêm Mưa Tại Bến Cảng',
              type: 'chapter',
              targetId: 'ch_08',
              pane: 'primary',
            },
            {
              id: 'tab-char-linh',
              title: 'Lâm Vũ Linh',
              type: 'lore-entity',
              targetId: 'char_linh_001',
              pane: 'primary',
            },
            {
              id: 'tab-lore-db',
              title: 'Lorebook Database',
              type: 'lore-database',
              targetId: 'lore-all',
              pane: 'secondary',
            },
          ],
          activePrimaryTabId: 'tab-ch-08',
          activeSecondaryTabId: 'tab-lore-db',
          ipcNotice: null,
        });
      },

      closeProject: async () => {
        await get().flushAllSaves();
        set({
          isProjectLoading: false,
          isDemoData: false,
          projectName: "",
          chapters: [],
          entities: [],
          relations: [],
          snapshots: [],
          openTabs: [],
          activePrimaryTabId: '',
          activeSecondaryTabId: null,
          rootPath: null,
          ipcNotice: null,
        });
      },

      resetToDefaults: () =>
        set({
          chapters: INITIAL_CHAPTERS,
          entities: INITIAL_ENTITIES,
          relations: INITIAL_RELATIONS,
          snapshots: INITIAL_SNAPSHOTS,
          activeBranch: 'main',
        }),

      exportProjectJson: () => {
        const state = get();
        return JSON.stringify(
          {
            projectName: state.projectName,
            chapters: state.chapters,
            entities: state.entities,
            relations: state.relations,
            snapshots: state.snapshots,
            exportedAt: new Date().toISOString(),
          },
          null,
          2
        );
      },

      importProjectJson: (jsonString) => {
        try {
          const parsed = JSON.parse(jsonString);
          if (parsed && Array.isArray(parsed.chapters) && Array.isArray(parsed.entities)) {
            set({
              chapters: parsed.chapters,
              entities: parsed.entities,
              relations: parsed.relations || INITIAL_RELATIONS,
              snapshots: parsed.snapshots || INITIAL_SNAPSHOTS,
              projectName: parsed.projectName || 'Dự án nhập từ tệp',
              isDemoData: true,
              rootPath: null,
            });
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },
      };
    },
    {
      name: 'novelforge-workspace-storage',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: workspacePartialize,
    }
  )
);
