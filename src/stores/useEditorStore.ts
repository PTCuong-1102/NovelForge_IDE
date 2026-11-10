import { create } from 'zustand';

export interface ActiveModalState {
  commandPaletteOpen: boolean;
  commandPaletteMode: 'quick-open' | 'commands';
  refactorModalOpen: boolean;
  refactorEntityId: string | null;
  findUsagesEntityId: string | null;
  publishModalOpen: boolean;
}

interface EditorStoreState extends ActiveModalState {
  activeChapterId: string;
  focusedParagraphIndex: number;
  typewriterScrolling: boolean;
  paragraphFocus: boolean;
  firstLineIndent: boolean;
  proseFont: 'serif' | 'sans' | 'mono';
  proseFontSize: number;
  ignoredIssueIds: string[];
  hoveredEntityId: string | null;
  hoveredIssueId: string | null;
  slashMenuOpen: boolean;
  slashMenuParagraphIndex: number;

  // Actions
  setActiveChapterId: (id: string) => void;
  setFocusedParagraphIndex: (idx: number) => void;
  toggleTypewriterScrolling: () => void;
  toggleParagraphFocus: () => void;
  toggleFirstLineIndent: () => void;
  setProseFont: (font: 'serif' | 'sans' | 'mono') => void;
  setProseFontSize: (size: number) => void;
  ignoreIssue: (issueId: string) => void;
  setHoveredEntityId: (entityId: string | null) => void;
  setHoveredIssueId: (issueId: string | null) => void;
  openCommandPalette: (mode: 'quick-open' | 'commands') => void;
  closeCommandPalette: () => void;
  openRefactorModal: (entityId: string) => void;
  closeRefactorModal: () => void;
  openFindUsages: (entityId: string | null) => void;
  setPublishModalOpen: (open: boolean) => void;
  setSlashMenu: (open: boolean, paragraphIndex?: number) => void;
}

export const useEditorStore = create<EditorStoreState>((set) => ({
  activeChapterId: 'ch_08',
  focusedParagraphIndex: 1,
  typewriterScrolling: true,
  paragraphFocus: false,
  firstLineIndent: true,
  proseFont: 'serif',
  proseFontSize: 18,
  ignoredIssueIds: [],
  hoveredEntityId: null,
  hoveredIssueId: null,
  slashMenuOpen: false,
  slashMenuParagraphIndex: 2,

  commandPaletteOpen: false,
  commandPaletteMode: 'quick-open',
  refactorModalOpen: false,
  refactorEntityId: null,
  findUsagesEntityId: null,
  publishModalOpen: false,

  setActiveChapterId: (id) => set({ activeChapterId: id }),
  setFocusedParagraphIndex: (idx) => set({ focusedParagraphIndex: idx }),
  toggleTypewriterScrolling: () =>
    set((s) => ({ typewriterScrolling: !s.typewriterScrolling })),
  toggleParagraphFocus: () =>
    set((s) => ({ paragraphFocus: !s.paragraphFocus })),
  toggleFirstLineIndent: () =>
    set((s) => ({ firstLineIndent: !s.firstLineIndent })),
  setProseFont: (font) => set({ proseFont: font }),
  setProseFontSize: (size) => set({ proseFontSize: size }),
  ignoreIssue: (issueId) =>
    set((s) => ({ ignoredIssueIds: [...s.ignoredIssueIds, issueId] })),
  setHoveredEntityId: (entityId) => set({ hoveredEntityId: entityId }),
  setHoveredIssueId: (issueId) => set({ hoveredIssueId: issueId }),

  openCommandPalette: (mode) =>
    set({ commandPaletteOpen: true, commandPaletteMode: mode }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),

  openRefactorModal: (entityId) =>
    set({ refactorModalOpen: true, refactorEntityId: entityId }),
  closeRefactorModal: () => set({ refactorModalOpen: false }),

  openFindUsages: (entityId) => set({ findUsagesEntityId: entityId }),
  setPublishModalOpen: (open) => set({ publishModalOpen: open }),
  setSlashMenu: (open, paragraphIndex) =>
    set((s) => ({
      slashMenuOpen: open,
      slashMenuParagraphIndex:
        paragraphIndex !== undefined ? paragraphIndex : s.slashMenuParagraphIndex,
    })),
}));
