import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  ChapterDocument,
  CharacterRelationEdge,
  LoreEntity,
  StorySnapshot,
  ThemeMode,
} from '@/lib/tauri-bridge';
import {
  DEMO_CHAPTERS,
  DEMO_ENTITIES,
  DEMO_RELATIONS,
  DEMO_SNAPSHOTS,
  createDemoWorkspace,
} from '@/lib/ipc-demo';
import { isTauri, invokeSafe } from '@/lib/ipc';

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

interface WorkspaceState {
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
  createGitSnapshot: (label: string) => void;
  restoreSnapshot: (snapshotId: string) => void;
  createWhatIfBranch: (branchName: string) => void;
  switchBranch: (branchName: string) => void;
  loadDemoProject: () => void;
  closeProject: () => void;
  resetToDefaults: () => void;
  exportProjectJson: () => string;
  importProjectJson: (jsonString: string) => boolean;
}

const INITIAL_ENTITIES = DEMO_ENTITIES;
const INITIAL_CHAPTERS = DEMO_CHAPTERS;
const INITIAL_RELATIONS = DEMO_RELATIONS;
const INITIAL_SNAPSHOTS = DEMO_SNAPSHOTS;

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      projectName: 'Huyết Cảng 2026',
      theme: 'obsidian',
      activeActivity: 'explorer',
      leftSidebarOpen: true,
      rightDockOpen: true,
      zenMode: false,
      splitView: false,
      activeBranch: 'main',
      availableBranches: [
        'main',
        'what-if/tran-hao-con-song',
        'what-if/linh-phan-boi-aegis',
      ],
      saveStatus: 'saved',
      isDemoData: true,
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

      chapters: INITIAL_CHAPTERS,
      entities: INITIAL_ENTITIES,
      relations: INITIAL_RELATIONS,
      snapshots: INITIAL_SNAPSHOTS,

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
          return {
            splitView: nextSplit,
            activeSecondaryTabId: state.activeSecondaryTabId || 'tab-lore-db',
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
          return {
            openTabs: filtered,
            activePrimaryTabId: nextPrimary,
          };
        }),

      setActiveTab: (tabId, pane) =>
        set(() =>
          pane === 'secondary'
            ? { activeSecondaryTabId: tabId }
            : { activePrimaryTabId: tabId }
        ),

      updateChapterParagraphs: (chapterId, paragraphs) =>
        set((state) => ({
          saveStatus: 'saved',
          chapters: state.chapters.map((ch) =>
            ch.id === chapterId
              ? { ...ch, paragraphs, updated_at: new Date().toISOString() }
              : ch
          ),
        })),

      updateChapterMetadata: (chapterId, patch) =>
        set((state) => ({
          saveStatus: 'saved',
          chapters: state.chapters.map((ch) =>
            ch.id === chapterId
              ? { ...ch, ...patch, updated_at: new Date().toISOString() }
              : ch
          ),
        })),

      updateEntity: (entityId, patch) =>
        set((state) => ({
          entities: state.entities.map((e) =>
            e.id === entityId
              ? { ...e, ...patch, updated_at: new Date().toISOString() }
              : e
          ),
        })),

      createEntity: (entity) =>
        set((state) => ({
          entities: [...state.entities, entity],
        })),

      createChapter: (title) =>
        set((state) => {
          const nextOrder =
            state.chapters.reduce((max, c) => Math.max(max, c.order), 0) + 1;
          const newId = `ch_${String(nextOrder).padStart(2, '0')}`;
          const newChapter: ChapterDocument = {
            id: newId,
            act_id: 'act_01',
            act_title: 'Hồi 1: Tín Hiệu Từ Đáy Biển',
            order: nextOrder,
            title: title || `Chương ${nextOrder}: Phân Cảnh Mới`,
            file_path: `manuscript/act-01/ch-${String(nextOrder).padStart(2, '0')}.md`,
            status: 'draft',
            pov_character_id: 'char_linh_001',
            pov_character_name: 'Lâm Vũ Linh',
            story_date: '16/10/2026',
            story_year: 2026,
            location_id: 'loc_cang_dong',
            location_tag: '#Bến_Cảng_Đông',
            target_words: 3000,
            is_flashback: false,
            paragraphs: [
              'Bắt đầu viết phân cảnh mới tại đây. Gõ / để mở Slash Command hoặc @ để gắn thẻ nhân vật từ Lorebook.',
            ],
            updated_at: new Date().toISOString(),
          };
          const tabId = `tab-${newId}`;
          return {
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
          };
        }),

      reorderChapters: (fromIndex, toIndex) =>
        set((state) => {
          const next = [...state.chapters];
          const [moved] = next.splice(fromIndex, 1);
          next.splice(toIndex, 0, moved);
          return { chapters: next };
        }),

      applyRefactorRename: (
        entityId,
        newName,
        newAliases,
        selectedMatchIds,
        aliasMap
      ) =>
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
                if (selectedMatchIds.has(matchId) && nextPara.includes(pair.from)) {
                  nextPara = nextPara.split(pair.from).join(pair.to);
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
                  body: e.body.split(targetEntity.title).join(newName),
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
        }),

      createGitSnapshot: (label) =>
        set((state) => {
          const snapMap: Record<string, string[]> = {};
          state.chapters.forEach((c) => {
            snapMap[c.id] = [...c.paragraphs];
          });
          const newSnap: StorySnapshot = {
            id: `snap-${Date.now()}`,
            branch_name: state.activeBranch,
            label:
              label ||
              `Snapshot tự động (${new Date().toLocaleTimeString('vi-VN')})`,
            timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
            word_count_delta: 125,
            total_words: 3545,
            chapter_snapshots: snapMap,
          };
          return {
            snapshots: [newSnap, ...state.snapshots],
            saveStatus: 'saved',
          };
        }),

      restoreSnapshot: (snapshotId) =>
        set((state) => {
          const targetSnap = state.snapshots.find((s) => s.id === snapshotId);
          if (!targetSnap || !targetSnap.chapter_snapshots) return state;

          const restoredChapters = state.chapters.map((ch) => {
            if (targetSnap.chapter_snapshots[ch.id]) {
              return {
                ...ch,
                paragraphs: [...targetSnap.chapter_snapshots[ch.id]],
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
        }),

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

      loadDemoProject: () => {
        const demo = createDemoWorkspace();
        set({
          isDemoData: true,
          projectName: demo.projectName,
          chapters: demo.chapters,
          entities: demo.entities,
          relations: demo.relations,
          snapshots: demo.snapshots,
          rootPath: null,
        });
      },

      closeProject: () => {
        set({
          isDemoData: false,
          projectName: "",
          chapters: [],
          entities: [],
          relations: [],
          snapshots: [],
          openTabs: [],
          rootPath: null,
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
            });
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },
    }),
    {
      name: 'novelforge-workspace-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        projectName: state.projectName,
        theme: state.theme,
        chapters: state.chapters,
        entities: state.entities,
        relations: state.relations,
        snapshots: state.snapshots,
        activeBranch: state.activeBranch,
        availableBranches: state.availableBranches,
      }),
    }
  )
);
