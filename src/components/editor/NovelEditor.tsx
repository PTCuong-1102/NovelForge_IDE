'use client';

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import {
  Sparkles,
  Check,
  X,
  ExternalLink,
  Search,
  Edit3,
  AlertTriangle,
  AlertCircle,
  Lightbulb,
  Plus,
  Type,
  Minus,
  Indent,
  Pilcrow,
  Wand2,
  FileCode2,
  BookOpen,
  RefreshCw,
} from 'lucide-react';
import {
  ChapterDocument,
  ContinuityIssue,
  LoreEntity,
  countVietnameseAndLatinWords,
  runContinuityLinterEngine,
} from '@/lib/tauri-bridge';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { useAgentStore } from '@/stores/useAgentStore';
import { findWholeWordOccurrences } from '@/lib/word-boundary';
import { invokeSafe } from '@/lib/ipc';
import { CHAPTER_FRONTMATTER_KEYS } from '@/lib/tauri-bridge';
import { ChapterHeaderProperties } from './ChapterHeaderProperties';
import { SlashMenu } from './SlashMenu';
import {
  AiGhostTextExtension,
  EntityAndLinterExtension,
  buildContextualGhostSuggestion,
  paragraphsToTipTapDoc,
  parseLosslessMarkdownToChapter,
  serializeChapterToLosslessMarkdown,
  tipTapDocToParagraphs,
} from './extensions';

interface NovelEditorProps {
  chapter: ChapterDocument;
}

type EditorCanvasMode = 'blocks' | 'tiptap' | 'markdown';

export const NovelEditor: React.FC<NovelEditorProps> = ({ chapter }) => {
  const { entities, updateChapterParagraphs, updateChapterMetadata, openTab, rootPath } =
    useWorkspaceStore();
  const {
    paragraphFocus,
    toggleParagraphFocus,
    firstLineIndent,
    toggleFirstLineIndent,
    proseFont,
    setProseFont,
    proseFontSize,
    setProseFontSize,
    focusedParagraphIndex,
    setFocusedParagraphIndex,
    openRefactorModal,
    openFindUsages,
    ignoredIssueIds,
    ignoreIssue,
    slashMenuOpen,
    slashMenuParagraphIndex,
    setSlashMenu,
  } = useEditorStore();

  const { diffProposals, resolveDiffProposal, sendComposerPrompt } =
    useAgentStore();

  // Names inserted by the Slash Menu come from the project, never from demo data.
  const povName =
    chapter.pov_character_name ||
    entities.find((e) => e.entity_type === 'character')?.title ||
    'Nhân vật chính';
  const locationName =
    chapter.location_tag?.replace(/^#/, '') || 'bối cảnh hiện tại';

  const [canvasMode, setCanvasMode] = useState<EditorCanvasMode>('blocks');
  const [editingParagraphIndex, setEditingParagraphIndex] = useState<
    number | null
  >(null);
  const [editingChapterTitle, setEditingChapterTitle] = useState(false);

  // Ghost Text AI state
  const [ghostAiEnabled, setGhostAiEnabled] = useState(true);
  const [ghostVariantIndex, setGhostVariantIndex] = useState(0);
  const [ghostDismissedForText, setGhostDismissedForText] = useState<
    string | null
  >(null);

  // Lossless Raw Markdown buffer when in 'markdown' mode
  const [rawMarkdownDraft, setRawMarkdownDraft] = useState('');

  const [hoveredEntity, setHoveredEntity] = useState<LoreEntity | null>(null);
  const [hoverCardPos, setHoverCardPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [activeIssuePopover, setActiveIssuePopover] = useState<{
    issue: ContinuityIssue;
    x: number;
    y: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const activeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Tracks what the raw Markdown draft was last built from, so the draft is
  // never rewritten while the user is typing in raw mode.
  const previousChapterIdRef = useRef(chapter.id);
  const previousCanvasModeRef = useRef<EditorCanvasMode | null>(null);

  const words = useMemo(
    () => countVietnameseAndLatinWords(chapter.paragraphs.join(' ')),
    [chapter.paragraphs]
  );
  const issues = useMemo(
    () => runContinuityLinterEngine(chapter, entities, ignoredIssueIds),
    [chapter, entities, ignoredIssueIds]
  );

  const pendingDiffs = useMemo(
    () =>
      diffProposals.filter(
        (d) => d.chapter_id === chapter.id && d.status === 'pending'
      ),
    [diffProposals, chapter.id]
  );

  // Compute active AI Ghost Text suggestion for the focused paragraph
  const activeParaIdx =
    editingParagraphIndex ??
    Math.min(
      focusedParagraphIndex,
      Math.max(0, chapter.paragraphs.length - 1)
    );
  const activeParaText = chapter.paragraphs[activeParaIdx] || '';

  const currentGhostSuggestion = useMemo(() => {
    if (!ghostAiEnabled) return '';
    if (ghostDismissedForText === activeParaText) return '';
    return buildContextualGhostSuggestion(
      activeParaText,
      chapter,
      entities,
      ghostVariantIndex
    );
  }, [
    ghostAiEnabled,
    ghostDismissedForText,
    activeParaText,
    chapter,
    entities,
    ghostVariantIndex,
  ]);

  // Mutable refs for ProseMirror extensions to read latest state without re-mounting editor
  const entitiesRef = useRef(entities);
  entitiesRef.current = entities;

  const issuesRef = useRef(issues);
  issuesRef.current = issues;

  const ghostEnabledRef = useRef(ghostAiEnabled);
  ghostEnabledRef.current = ghostAiEnabled;

  const chapterRef = useRef(chapter);
  chapterRef.current = chapter;

  const ghostVariantRef = useRef(ghostVariantIndex);
  ghostVariantRef.current = ghostVariantIndex;

  const suppressNextBlurRef = useRef(false);

  const handleOpenEntityCard = useCallback(
    (ent: LoreEntity, clientX: number, clientY: number) => {
      setHoveredEntity(ent);
      setHoverCardPos({
        x: Math.max(16, Math.min(clientX, window.innerWidth - 360)),
        y: Math.max(16, Math.min(clientY + 14, window.innerHeight - 320)),
      });
    },
    []
  );

  const handleOpenIssueCard = useCallback(
    (issue: ContinuityIssue, clientX: number, clientY: number) => {
      setActiveIssuePopover({
        issue,
        x: Math.max(16, Math.min(clientX, window.innerWidth - 380)),
        y: Math.max(16, Math.min(clientY + 14, window.innerHeight - 320)),
      });
    },
    []
  );

  // TipTap / ProseMirror Engine instance with Lossless Markdown + Entity Highlighting + Ghost Text
  const tiptapEditor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Typography,
      Placeholder.configure({
        placeholder:
          'Bắt đầu viết chương truyện... (Nhấn Tab để chấp nhận Ghost Text AI, / để mở menu lệnh)',
      }),
      EntityAndLinterExtension.configure({
        getEntities: () => entitiesRef.current,
        getIssues: () => issuesRef.current,
        onEntityClick: (entity, event) => {
          handleOpenEntityCard(entity, event.clientX, event.clientY);
        },
        onIssueClick: (issue, event) => {
          handleOpenIssueCard(issue, event.clientX, event.clientY);
        },
      }),
      AiGhostTextExtension.configure({
        isEnabled: () => ghostEnabledRef.current,
        getSuggestion: (paraText) =>
          buildContextualGhostSuggestion(
            paraText,
            chapterRef.current,
            entitiesRef.current,
            ghostVariantRef.current
          ),
        onAcceptSuggestion: () => {
          setGhostVariantIndex((prev) => prev + 1);
        },
        onCycleSuggestion: () => {
          setGhostVariantIndex((prev) => prev + 1);
        },
        onDismissSuggestion: () => {
          setGhostDismissedForText(activeParaText);
        },
      }),
    ],
    editorProps: {
      handleKeyDown: (view, event) => {
        if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const { $from } = view.state.selection;
          const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
          if (!textBefore || /\s$/.test(textBefore)) {
            let paraIdx = 0;
            let activeIdx = 0;
            view.state.doc.descendants((node, pos) => {
              if (!node.isTextblock) return true;
              if (pos < $from.pos && $from.pos <= pos + node.nodeSize) {
                activeIdx = paraIdx;
              }
              paraIdx += 1;
              return false;
            });
            event.preventDefault();
            setSlashMenu(true, activeIdx);
            return true;
          }
        }
        return false;
      },
    },
    content: paragraphsToTipTapDoc(chapter.paragraphs),
    onUpdate: ({ editor }) => {
      const serializedParagraphs = tipTapDocToParagraphs(editor.getJSON());
      updateChapterParagraphs(chapterRef.current.id, serializedParagraphs);
    },
  });

  // Synchronize external chapter changes into TipTap & Markdown views
  useEffect(() => {
    if (tiptapEditor && !tiptapEditor.isFocused) {
      const currentFromEditor = tipTapDocToParagraphs(tiptapEditor.getJSON());
      if (
        JSON.stringify(currentFromEditor) !==
        JSON.stringify(chapter.paragraphs)
      ) {
        tiptapEditor.commands.setContent(
          paragraphsToTipTapDoc(chapter.paragraphs),
          false
        );
      }
    }
    const chapterChanged = previousChapterIdRef.current !== chapter.id;
    const enteredMarkdownMode =
      previousCanvasModeRef.current !== 'markdown' && canvasMode === 'markdown';
    previousChapterIdRef.current = chapter.id;
    previousCanvasModeRef.current = canvasMode;
    if (canvasMode === 'markdown' && (chapterChanged || enteredMarkdownMode)) {
      setRawMarkdownDraft(serializeChapterToLosslessMarkdown(chapter));
    }
  }, [chapter.id, chapter.paragraphs, tiptapEditor, canvasMode]);

  // Force ProseMirror decoration refresh when Lorebook entities, Linter issues, or Ghost Text change
  useEffect(() => {
    if (tiptapEditor && !tiptapEditor.isDestroyed) {
      tiptapEditor.view.dispatch(tiptapEditor.state.tr);
    }
  }, [tiptapEditor, entities, issues, ghostAiEnabled, ghostVariantIndex]);

  // Auto-focus and auto-resize textarea when entering in-place editing
  useEffect(() => {
    if (editingParagraphIndex !== null && activeTextareaRef.current) {
      const el = activeTextareaRef.current;
      el.focus();
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [editingParagraphIndex]);

  // Marks the proposal file on disk as resolved so it is not loaded again.
  const dismissProposalFile = async (proposalId: string) => {
    if (!rootPath) return;
    await invokeSafe('dismiss_edit_proposal', {
      projectRoot: rootPath,
      proposalId,
    });
  };

  const handleParagraphChange = (pIdx: number, newText: string) => {    const updated = [...chapter.paragraphs];
    updated[pIdx] = newText;
    updateChapterParagraphs(chapter.id, updated);
    setGhostDismissedForText(null);
    if (activeTextareaRef.current) {
      activeTextareaRef.current.style.height = 'auto';
      activeTextareaRef.current.style.height = `${activeTextareaRef.current.scrollHeight}px`;
    }
  };

  const handleAcceptGhostText = (pIdx: number) => {
    if (!currentGhostSuggestion) return;
    const updated = [...chapter.paragraphs];
    updated[pIdx] = `${(updated[pIdx] || '').trimEnd()}${currentGhostSuggestion}`;
    updateChapterParagraphs(chapter.id, updated);
    setGhostVariantIndex((v) => v + 1);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    pIdx: number
  ) => {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const caret = e.currentTarget.selectionStart ?? e.currentTarget.value.length;
      const textBefore = e.currentTarget.value.slice(0, caret);
      if (!textBefore || /\s$/.test(textBefore)) {
        e.preventDefault();
        setSlashMenu(true, pIdx);
        return;
      }
    }

    // Tab accepts and Esc rejects the inline diff of the focused paragraph.
    const pendingDiff = pendingDiffs.find((d) => d.paragraph_index === pIdx);
    if (pendingDiff) {
      if (e.key === 'Tab') {
        e.preventDefault();
        handleParagraphChange(pIdx, pendingDiff.proposed_text);
        resolveDiffProposal(pendingDiff.id, 'accepted');
        void dismissProposalFile(pendingDiff.id);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        resolveDiffProposal(pendingDiff.id, 'rejected');
        void dismissProposalFile(pendingDiff.id);
        return;
      }
    }

    // Tab accepts AI Ghost Text suggestion when cursor is at the end of the paragraph
    if (e.key === 'Tab' && ghostAiEnabled && currentGhostSuggestion) {
      e.preventDefault();
      handleAcceptGhostText(pIdx);
      return;
    }

    // Alt+\ cycles AI Ghost Text suggestion
    if (e.altKey && e.key === '\\') {
      e.preventDefault();
      setGhostDismissedForText(null);
      setGhostVariantIndex((v) => v + 1);
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setEditingParagraphIndex(null);
      if (slashMenuOpen) setSlashMenu(false);
      return;
    }

    // Enter without Shift inserts a new paragraph right below and moves focus
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      suppressNextBlurRef.current = true;
      const updated = [...chapter.paragraphs];
      updated.splice(pIdx + 1, 0, '');
      updateChapterParagraphs(chapter.id, updated);
      setFocusedParagraphIndex(pIdx + 1);
      setEditingParagraphIndex(pIdx + 1);
    }
  };

  // Handle lossless raw Markdown edits
  const handleRawMarkdownChange = (nextRaw: string) => {
    setRawMarkdownDraft(nextRaw);
    const parsed = parseLosslessMarkdownToChapter(nextRaw);
    updateChapterParagraphs(chapter.id, parsed.paragraphs);
    const fm = parsed.frontmatter;
    const metadataPatch: Partial<ChapterDocument> = {};

    const text = (key: string): string | undefined => {
      const value = fm[key];
      return typeof value === 'string' ? value : undefined;
    };
    const numeric = (key: string): number | undefined => {
      const value = fm[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim() !== '') {
        const parsedNumber = Number(value);
        return Number.isFinite(parsedNumber) ? parsedNumber : undefined;
      }
      return undefined;
    };

    // Every standard chapter field of the raw view is mapped back, so editing
    // the YAML in the raw Markdown view never drops a field.
    const title = text('title');
    if (title?.trim()) metadataPatch.title = title.trim();
    const actId = text('act_id');
    if (actId !== undefined) metadataPatch.act_id = actId;
    const actTitle = text('act_title');
    if (actTitle !== undefined) metadataPatch.act_title = actTitle;
    const order = numeric('order');
    if (order !== undefined) metadataPatch.order = order;
    if (
      fm.status === 'draft' ||
      fm.status === 'editing' ||
      fm.status === 'completed'
    ) {
      metadataPatch.status = fm.status;
    }
    const povId = text('pov_character_id');
    if (povId !== undefined) metadataPatch.pov_character_id = povId;
    const povName = text('pov_character_name');
    if (povName !== undefined) metadataPatch.pov_character_name = povName;
    const storyDate = text('story_date');
    if (storyDate !== undefined) metadataPatch.story_date = storyDate;
    const storyYear = numeric('story_year');
    if (storyYear !== undefined) metadataPatch.story_year = storyYear;
    const locationId = text('location_id');
    if (locationId !== undefined) metadataPatch.location_id = locationId;
    const locationTag = text('location_tag');
    if (locationTag !== undefined) metadataPatch.location_tag = locationTag;
    const targetWords = numeric('target_words');
    if (targetWords !== undefined) metadataPatch.target_words = targetWords;
    if (typeof fm.is_flashback === 'boolean') {
      metadataPatch.is_flashback = fm.is_flashback;
    }
    // Custom YAML keys and their declaration order must survive an edit in the
    // raw Markdown view.
    const extras: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fm)) {
      if (!CHAPTER_FRONTMATTER_KEYS.has(key)) extras[key] = value;
    }
    metadataPatch.extra_frontmatter = extras;
    metadataPatch.frontmatter_keys_order = parsed.frontmatterKeysOrder;
    if (Object.keys(metadataPatch).length > 0) {
      updateChapterMetadata(chapter.id, metadataPatch);
    }
  };

  // Quick fix resolution
  const handleApplyQuickFix = (
    issue: ContinuityIssue,
    quickFix: ContinuityIssue['quick_fixes'][number]
  ) => {
    const action = quickFix.action;
    if (action === 'mark_flashback') {
      const updated = [...chapter.paragraphs];
      updated[issue.paragraph_index] = `[Hồi tưởng] ${updated[issue.paragraph_index]}`;
      updateChapterParagraphs(chapter.id, updated);
      setActiveIssuePopover(null);
    } else if (action === 'revive_entity' && issue.entity_id) {
      useWorkspaceStore
        .getState()
        .updateEntity(issue.entity_id, { status: 'alive' });
      setActiveIssuePopover(null);
    } else if (action === 'replace_synonym') {
      const updated = [...chapter.paragraphs];
      const replacement = quickFix.replacement;
      if (replacement) {
        // The replacement travels with the quick fix, so every attribute
        // conflict is handled — not only the two hardcoded phrases.
        updated[issue.paragraph_index] = updated[issue.paragraph_index]
          .split(issue.matched_text)
          .join(replacement);
      }
      updateChapterParagraphs(chapter.id, updated);
      setActiveIssuePopover(null);
    } else if (action === 'ignore_rule') {
      ignoreIssue(issue.id);
      setActiveIssuePopover(null);
    }
  };

  const fontClass =
    proseFont === 'serif'
      ? 'font-serif'
      : proseFont === 'mono'
      ? 'font-mono'
      : 'font-sans';

  return (
    <div
      ref={containerRef}
      className="relative flex-1 h-full overflow-y-auto px-4 md:px-8 py-6 flex flex-col items-center select-text"
      style={{ backgroundColor: 'var(--bg-canvas)' }}
      onClick={() => {
        setHoveredEntity(null);
        setActiveIssuePopover(null);
        if (slashMenuOpen) setSlashMenu(false);
      }}
    >
      {/* Floating Editorial Toolbar */}
      <div
        className="sticky top-0 z-30 w-full max-w-[820px] mb-5 px-3.5 py-2 rounded-xl border shadow-sm backdrop-blur-md flex flex-wrap items-center justify-between gap-2 text-xs select-none"
        style={{
          backgroundColor: 'var(--bg-panel)',
          borderColor: 'var(--border-color)',
        }}
      >
        {/* Left: Engine Mode Switcher & Literary Actions */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Canvas Engine Mode Selector */}
          <div className="flex items-center bg-canvas p-0.5 rounded-lg border border-border">
            <button
              onClick={() => setCanvasMode('blocks')}
              className={`px-2 py-1 rounded-md font-semibold flex items-center gap-1 transition-colors ${
                canvasMode === 'blocks'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-muted hover:text-primary'
              }`}
              title="Chế độ Trang giấy Đoạn văn Liền mạch (In-Place Literary Blocks)"
            >
              <BookOpen size={12} />
              <span>Trang giấy</span>
            </button>
            <button
              onClick={() => setCanvasMode('tiptap')}
              className={`px-2 py-1 rounded-md font-semibold flex items-center gap-1 transition-colors ${
                canvasMode === 'tiptap'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-muted hover:text-primary'
              }`}
              title="Chế độ Nhân ProseMirror / TipTap Liên tục"
            >
              <Sparkles size={12} />
              <span>TipTap Engine</span>
            </button>
            <button
              onClick={() => {
                setRawMarkdownDraft(serializeChapterToLosslessMarkdown(chapter));
                setCanvasMode('markdown');
              }}
              className={`px-2 py-1 rounded-md font-semibold flex items-center gap-1 transition-colors ${
                canvasMode === 'markdown'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-muted hover:text-primary'
              }`}
              title="Kiểm tra & Chỉnh sửa Markdown + YAML Frontmatter hai chiều không mất cấu trúc (Lossless .md)"
            >
              <FileCode2 size={12} />
              <span>Lossless .md</span>
            </button>
          </div>

          <button
            onClick={() =>
              setSlashMenu(
                !slashMenuOpen,
                editingParagraphIndex ?? focusedParagraphIndex
              )
            }
            className="px-2.5 py-1 rounded-lg bg-elevated hover:bg-elevated/80 border border-border text-primary font-semibold flex items-center gap-1.5 transition-colors"
            title="Mở menu lệnh nhanh (Gõ / trong đoạn văn)"
          >
            <Wand2 size={13} className="text-accent" />
            <span>Lệnh (/)</span>
          </button>

          <button
            onClick={() => setGhostAiEnabled((v) => !v)}
            className={`px-2.5 py-1 rounded-lg border flex items-center gap-1 font-semibold transition-colors ${
              ghostAiEnabled
                ? 'semantic-info-box'
                : 'bg-elevated border-border text-muted hover:text-primary'
            }`}
            title="Bật/Tắt gợi ý hoàn thiện câu AI Ghost Text (Nhấn Tab để nhận)"
          >
            <Sparkles size={12} />
            <span>Ghost AI</span>
          </button>

          <button
            onClick={toggleFirstLineIndent}
            className={`px-2 py-1 rounded-lg border flex items-center gap-1 font-medium transition-colors ${
              firstLineIndent
                ? 'semantic-success-box'
                : 'bg-elevated border-border text-muted hover:text-primary'
            }`}
            title="Bật/Tắt thụt đầu dòng văn học (First-line Indent)"
          >
            <Indent size={13} />
          </button>
        </div>

        {/* Right: Typography & Reading Ergonomics */}
        <div className="flex items-center gap-2">
          {/* Font selector */}
          <div className="flex items-center gap-1.5 bg-elevated px-2 py-1 rounded-lg border border-border">
            <Type size={12} className="text-accent" />
            <select
              value={proseFont}
              onChange={(e) =>
                setProseFont(e.target.value as 'serif' | 'sans' | 'mono')
              }
              className="bg-transparent text-xs font-medium text-primary focus:outline-none cursor-pointer"
            >
              <option value="serif">Literata (Văn học)</option>
              <option value="sans">Plus Jakarta Sans (Hiện đại)</option>
              <option value="mono">JetBrains Mono (Bản nháp)</option>
            </select>
          </div>

          {/* Font size */}
          <div className="flex items-center gap-1 bg-elevated px-1.5 py-0.5 rounded-lg border border-border text-xs">
            <button
              onClick={() => setProseFontSize(Math.max(14, proseFontSize - 1))}
              className="p-1 hover:bg-canvas rounded text-muted hover:text-primary"
              title="Giảm cỡ chữ"
            >
              <Minus size={11} />
            </button>
            <span className="font-mono font-semibold text-primary px-1">
              {proseFontSize}px
            </span>
            <button
              onClick={() => setProseFontSize(Math.min(26, proseFontSize + 1))}
              className="p-1 hover:bg-canvas rounded text-muted hover:text-primary"
              title="Tăng cỡ chữ"
            >
              <Plus size={11} />
            </button>
          </div>

          {/* Paragraph Focus Toggle */}
          <button
            onClick={toggleParagraphFocus}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1 transition-colors ${
              paragraphFocus
                ? 'semantic-success-box'
                : 'bg-elevated border-border text-muted hover:text-primary'
            }`}
            title="Làm dịu các đoạn văn xung quanh để tập trung vào đoạn đang viết"
          >
            <Pilcrow size={12} />
            <span className="hidden sm:inline">Focus</span>
          </button>
        </div>
      </div>

      {/* Elevated Literary Paper Sheet */}
      <div
        className="w-full max-w-[820px] rounded-2xl border px-6 sm:px-12 py-8 sm:py-10 mb-16 transition-colors duration-200"
        style={{
          backgroundColor: 'var(--bg-paper)',
          borderColor: 'var(--border-color)',
          boxShadow: 'var(--shadow-paper)',
        }}
      >
        {/* Compact Notion Property Strip */}
        <ChapterHeaderProperties
          chapter={chapter}
          entities={entities}
          wordCount={words}
        />

        {/* Editable Chapter Title */}
        <div className="mb-8">
          {editingChapterTitle ? (
            <input
              type="text"
              autoFocus
              value={chapter.title}
              onChange={(e) =>
                updateChapterMetadata(chapter.id, { title: e.target.value })
              }
              onBlur={() => setEditingChapterTitle(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                  setEditingChapterTitle(false);
                }
              }}
              className={`w-full text-2xl md:text-3xl font-bold bg-transparent text-primary border-b-2 border-accent pb-1 focus:outline-none ${fontClass}`}
            />
          ) : (
            <h1
              onClick={() => setEditingChapterTitle(true)}
              title="Nhấp để đổi tiêu đề chương"
              className={`text-2xl md:text-3xl font-bold text-primary tracking-tight cursor-text hover:opacity-90 transition-opacity ${fontClass}`}
            >
              {chapter.title}
            </h1>
          )}
        </div>

        {/* AI Ghost Text Interactive Preview Bar (Grounded in Lorebook RAG) */}
        {ghostAiEnabled && currentGhostSuggestion && canvasMode !== 'markdown' && (
          <div className="mb-6 p-3 rounded-xl border semantic-info-box flex flex-wrap items-center justify-between gap-2 text-xs select-none">
            <div className="flex-1 min-w-[240px]">
              <div className="flex items-center gap-1.5 font-bold mb-0.5">
                <Sparkles size={13} />
                <span>
                  Ghost Text AI (Đoạn {activeParaIdx + 1} · Ngữ cảnh Lorebook:{' '}
                  {chapter.pov_character_name} tại {chapter.location_tag}):
                </span>
              </div>
              <p className={`italic text-primary ${fontClass}`}>
                &ldquo;...{currentGhostSuggestion.trim()}&rdquo;
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setGhostVariantIndex((v) => v + 1)}
                className="px-2.5 py-1 rounded-lg bg-canvas border border-border text-primary font-semibold flex items-center gap-1 hover:opacity-90"
                title="Đổi gợi ý Ghost Text khác (Alt+\)"
              >
                <RefreshCw size={11} />
                <span>Đổi gợi ý (Alt+\)</span>
              </button>
              <button
                onClick={() => handleAcceptGhostText(activeParaIdx)}
                className="px-3 py-1 rounded-lg bg-accent text-white font-semibold flex items-center gap-1 shadow-sm hover:opacity-95"
                title="Chèn gợi ý Ghost Text vào cuối đoạn đang chọn (Tab)"
              >
                <Check size={12} />
                <span>Chấp nhận (Tab)</span>
              </button>
            </div>
          </div>
        )}

        {/* MODE 1: Seamless In-Place Prose Paragraphs */}
        {canvasMode === 'blocks' && (
          <div className="flex flex-col gap-5 prose-editor-area">
            {chapter.paragraphs.map((para, pIdx) => {
              const isFocused =
                focusedParagraphIndex === pIdx ||
                editingParagraphIndex === pIdx;
              const isEditing = editingParagraphIndex === pIdx;
              const diffForThisPara = pendingDiffs.find(
                (d) => d.paragraph_index === pIdx
              );
              const paraIssues = issues.filter(
                (i) => i.paragraph_index === pIdx
              );
              const isSpecialBlock =
                para.startsWith('> [!GHI_CHÚ_TÁC_GIẢ]') ||
                para.trim() === '***';

              return (
                <div
                  key={pIdx}
                  className={`relative group transition-opacity duration-200 ${
                    paragraphFocus && !isFocused
                      ? 'opacity-45 hover:opacity-90'
                      : 'opacity-100'
                  }`}
                >
                  {/* Paragraph Number Gutter Indicator on Hover */}
                  <div className="hidden sm:flex items-center gap-1 absolute -left-9 top-2.5 opacity-0 group-hover:opacity-100 transition-opacity select-none">
                    <span className="text-[11px] font-mono text-muted">
                      ¶{pIdx + 1}
                    </span>
                  </div>

                  {isEditing ? (
                    /* In-Place Auto-Expanding Editor (Matches Literary Typography 1:1) */
                    <div className="relative rounded-xl ring-2 ring-accent/60 bg-elevated/30 p-3 transition-all">
                      <textarea
                        ref={activeTextareaRef}
                        value={para}
                        onChange={(e) =>
                          handleParagraphChange(pIdx, e.target.value)
                        }
                        onKeyDown={(e) => handleKeyDown(e, pIdx)}
                        onBlur={() => {
                          if (suppressNextBlurRef.current) {
                            suppressNextBlurRef.current = false;
                            return;
                          }
                          setEditingParagraphIndex(null);
                        }}
                        style={{
                          fontSize: `${proseFontSize}px`,
                          lineHeight: 1.85,
                          textIndent:
                            firstLineIndent && !isSpecialBlock ? '1.75em' : '0',
                        }}
                        className={`w-full bg-transparent resize-none focus:outline-none text-primary ${fontClass}`}
                        placeholder="Nhập nội dung đoạn văn... (Nhấn Tab để nhận Ghost Text AI, Enter để sang đoạn mới, / để mở lệnh)"
                      />
                      {ghostAiEnabled && currentGhostSuggestion && (
                        <div
                          className={`mt-1.5 text-xs italic text-muted flex items-center justify-between gap-2 pt-1.5 border-t border-border/40 select-none ${fontClass}`}
                        >
                          <span>
                            <strong className="not-italic semantic-info-text font-sans">
                              Ghost AI:
                            </strong>{' '}
                            {currentGhostSuggestion}
                          </span>
                          <button
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleAcceptGhostText(pIdx);
                            }}
                            className="ai-ghost-text-badge shrink-0"
                          >
                            Tab ↵
                          </button>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 mt-1 border-t border-border/50 text-[11px] text-muted font-sans select-none">
                        <span>
                          Đang sửa trực tiếp đoạn {pIdx + 1} ·{' '}
                          <kbd className="px-1 py-0.5 rounded bg-canvas border border-border font-mono">
                            Tab
                          </kbd>{' '}
                          nhận Ghost AI ·{' '}
                          <kbd className="px-1 py-0.5 rounded bg-canvas border border-border font-mono">
                            /
                          </kbd>{' '}
                          mở lệnh
                        </span>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setEditingParagraphIndex(null);
                          }}
                          className="px-2 py-0.5 rounded bg-accent text-white font-semibold"
                        >
                          Xong (Esc)
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Seamless Literary Display (Click anywhere on text to edit in-place) */
                    <div
                      onClick={() => {
                        setFocusedParagraphIndex(pIdx);
                        setEditingParagraphIndex(pIdx);
                      }}
                      className={`px-3 py-2 rounded-xl leading-relaxed text-primary ${fontClass} cursor-text transition-all border ${
                        isFocused
                          ? 'border-border/80 bg-elevated/25'
                          : 'border-transparent hover:border-border/50 hover:bg-elevated/15'
                      }`}
                      style={{
                        fontSize: `${proseFontSize}px`,
                        lineHeight: 1.85,
                        textIndent:
                          firstLineIndent && !isSpecialBlock ? '1.75em' : '0',
                      }}
                      title="Nhấp vào đoạn văn để sửa trực tiếp tại chỗ"
                    >
                      <div className="whitespace-pre-wrap">
                        {para.trim().length === 0 ? (
                          <span className="text-muted italic">
                            Đoạn văn trống — nhấp vào đây để bắt đầu viết...
                          </span>
                        ) : (
                          renderDecoratedParagraph(
                            para,
                            pIdx,
                            chapter,
                            entities,
                            paraIssues,
                            (ent, e) => {
                              e.stopPropagation();
                              handleOpenEntityCard(ent, e.clientX, e.clientY);
                            },
                            (issue, e) => {
                              e.stopPropagation();
                              handleOpenIssueCard(issue, e.clientX, e.clientY);
                            }
                          )
                        )}
                        {ghostAiEnabled &&
                          isFocused &&
                          currentGhostSuggestion &&
                          !isSpecialBlock && (
                            <span
                              className="ai-ghost-text-widget"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAcceptGhostText(pIdx);
                              }}
                              title="Nhấp hoặc nhấn Tab để chèn gợi ý Ghost Text AI"
                            >
                              {currentGhostSuggestion}
                              <kbd className="ai-ghost-text-badge">Tab ↵</kbd>
                            </span>
                          )}
                      </div>
                    </div>
                  )}

                  {/* Inline Diff Proposal Floating Card (High-Contrast Across All 3 Themes) */}
                  {diffForThisPara && (
                    <div
                      className="mt-3 p-4 rounded-xl border-2 shadow-md flex flex-col gap-2.5 select-none animate-in fade-in"
                      style={{
                        backgroundColor: 'var(--bg-elevated)',
                        borderColor: 'var(--accent-color)',
                      }}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 font-bold semantic-success-text">
                          <Sparkles size={14} />
                          Đề xuất chỉnh sửa từ {diffForThisPara.agent_name}{' '}
                          (Đoạn {pIdx + 1}):
                        </span>
                        <span className="text-xs font-mono text-muted">
                          {diffForThisPara.created_at}
                        </span>
                      </div>

                      <div
                        className={`text-sm leading-relaxed flex flex-col gap-2 ${fontClass}`}
                      >
                        <div className="p-2.5 rounded-lg border semantic-error-box line-through">
                          {diffForThisPara.original_text}
                        </div>
                        <div className="p-2.5 rounded-lg border semantic-success-box font-medium">
                          {diffForThisPara.proposed_text}
                        </div>
                      </div>

                      <p className="text-xs text-muted italic">
                        Lý do: &ldquo;{diffForThisPara.rationale}&rdquo;
                      </p>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60 text-xs">
                        <button
                          onClick={() => {
                            resolveDiffProposal(diffForThisPara.id, 'rejected');
                            void dismissProposalFile(diffForThisPara.id);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-canvas hover:opacity-90 border border-border text-primary transition-colors flex items-center gap-1 font-semibold"
                        >
                          <X size={13} />
                          <span>Từ chối (Esc)</span>
                        </button>
                        <button
                          onClick={() => {
                            handleParagraphChange(
                              pIdx,
                              diffForThisPara.proposed_text
                            );
                            resolveDiffProposal(diffForThisPara.id, 'accepted');
                            void dismissProposalFile(diffForThisPara.id);
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1 font-semibold shadow-sm"
                        >
                          <Check size={13} />
                          <span>Chấp nhận (Tab)</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* MODE 2: Full ProseMirror / TipTap Continuous Engine */}
        {canvasMode === 'tiptap' && (
          <div
            className={`novelforge-tiptap-content prose-editor-area ${fontClass} ${
              firstLineIndent ? 'novelforge-indent-enabled' : ''
            }`}
            style={{
              fontSize: `${proseFontSize}px`,
              lineHeight: 1.85,
            }}
          >
            <EditorContent editor={tiptapEditor} />
          </div>
        )}

        {/* MODE 3: Lossless Bi-Directional Markdown + YAML Frontmatter Inspector */}
        {canvasMode === 'markdown' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-3 py-2 rounded-xl border semantic-success-box text-xs select-none">
              <span className="font-semibold">
                Đồng bộ Markdown hai chiều (Lossless YAML Frontmatter + Block AST): Mọi thay đổi được bảo toàn 100% cấu trúc.
              </span>
              <span className="font-mono text-[11px]">
                {chapter.file_path}
              </span>
            </div>
            <textarea
              value={rawMarkdownDraft}
              onChange={(e) => handleRawMarkdownChange(e.target.value)}
              rows={22}
              className="w-full p-4 rounded-xl border border-border bg-canvas text-primary font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-accent"
              spellCheck={false}
            />
          </div>
        )}

        {/* Append New Paragraph Action */}
        <div className="mt-8 pt-4 border-t border-border/50 flex justify-center select-none">
          <button
            onClick={() => {
              const updated = [...chapter.paragraphs, ''];
              updateChapterParagraphs(chapter.id, updated);
              const newIdx = updated.length - 1;
              setFocusedParagraphIndex(newIdx);
              if (canvasMode === 'blocks') {
                setEditingParagraphIndex(newIdx);
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-elevated hover:opacity-90 border border-border text-xs font-semibold text-primary transition-all"
          >
            <Plus size={14} className="text-accent" />
            <span>Thêm đoạn văn mới (Hoặc nhấn Enter khi đang gõ)</span>
          </button>
        </div>
      </div>

      {/* 1. IntelliJ Hover Documentation Card */}
      {hoveredEntity && hoverCardPos && (
        <div
          className="fixed z-50 w-80 rounded-xl shadow-2xl border p-4 select-none animate-in fade-in zoom-in-95 duration-150 text-xs"
          style={{
            left: `${hoverCardPos.x}px`,
            top: `${hoverCardPos.y}px`,
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="font-bold text-sm text-primary flex items-center gap-1.5">
                <span>{hoveredEntity.title}</span>
                {hoveredEntity.aliases && hoveredEntity.aliases.length > 0 && (
                  <span className="text-xs font-normal text-muted">
                    ({hoveredEntity.aliases.join(', ')})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                    hoveredEntity.status === 'dead'
                      ? 'semantic-error-box'
                      : 'semantic-success-box'
                  }`}
                >
                  {hoveredEntity.status === 'dead'
                    ? '● Đã tử vong'
                    : '● Còn sống'}
                </span>
                {hoveredEntity.age_at_story && (
                  <span className="text-xs text-muted font-medium">
                    {hoveredEntity.age_at_story} tuổi
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setHoveredEntity(null)}
              className="p-1 text-muted hover:text-primary rounded hover:bg-canvas"
            >
              <X size={13} />
            </button>
          </div>

          <div className="space-y-1.5 text-xs text-muted border-t border-border/60 pt-2.5 mb-3 leading-relaxed">
            {hoveredEntity.appearance && (
              <div>
                <strong className="text-primary font-semibold">
                  Ngoại hình:
                </strong>{' '}
                {hoveredEntity.appearance}
              </div>
            )}
            {hoveredEntity.personality && (
              <div>
                <strong className="text-primary font-semibold">
                  Tính cách:
                </strong>{' '}
                {hoveredEntity.personality}
              </div>
            )}
            {hoveredEntity.death_chapter_title && (
              <div className="semantic-error-text font-semibold">
                Tử vong: {hoveredEntity.death_chapter_title} (
                {hoveredEntity.death_date})
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
            <button
              onClick={() => {
                openTab({
                  id: `tab-char-${hoveredEntity.id}`,
                  title: hoveredEntity.title,
                  type: 'lore-entity',
                  targetId: hoveredEntity.id,
                });
                setHoveredEntity(null);
              }}
              className="semantic-success-text hover:underline flex items-center gap-1 font-semibold"
            >
              <ExternalLink size={12} />
              <span>Mở hồ sơ</span>
            </button>
            <button
              onClick={() => {
                openFindUsages(hoveredEntity.id);
                setHoveredEntity(null);
              }}
              className="text-primary hover:text-accent flex items-center gap-1 font-semibold"
            >
              <Search size={12} />
              <span>Xem xuất hiện</span>
            </button>
            <button
              onClick={() => {
                openRefactorModal(hoveredEntity.id);
                setHoveredEntity(null);
              }}
              className="text-primary hover:text-accent flex items-center gap-1 font-semibold"
            >
              <Edit3 size={12} />
              <span>Đổi tên</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. Continuity Linter Popover & Quick Fixes */}
      {activeIssuePopover && (
        <div
          className="fixed z-50 w-88 rounded-xl shadow-2xl border-2 p-4 select-none animate-in fade-in zoom-in-95 duration-150 text-xs"
          style={{
            left: `${activeIssuePopover.x}px`,
            top: `${activeIssuePopover.y}px`,
            backgroundColor: 'var(--bg-elevated)',
            borderColor:
              activeIssuePopover.issue.severity === 'error'
                ? '#EF4444'
                : '#F59E0B',
            color: 'var(--text-primary)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-1.5 font-bold text-sm">
              {activeIssuePopover.issue.severity === 'error' ? (
                <span className="semantic-error-text flex items-center gap-1.5">
                  <AlertCircle size={16} /> Mâu Thuẫn Logic Cốt Truyện
                </span>
              ) : (
                <span className="semantic-warning-text flex items-center gap-1.5">
                  <AlertTriangle size={16} /> Cảnh Báo Văn Phong
                </span>
              )}
            </div>
            <button
              onClick={() => setActiveIssuePopover(null)}
              className="p-1 text-muted hover:text-primary rounded hover:bg-canvas"
            >
              <X size={13} />
            </button>
          </div>

          <p className="text-xs text-primary font-medium leading-relaxed mb-1">
            {activeIssuePopover.issue.message}
          </p>
          <p className="text-xs text-muted mb-3 leading-relaxed">
            {activeIssuePopover.issue.detail}
          </p>

          <div className="border-t border-border/60 pt-2.5 flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
              <Lightbulb size={12} className="text-accent" /> Giải pháp nhanh
              (Quick Fix - Alt+Enter):
            </span>
            {activeIssuePopover.issue.quick_fixes.map((qf) => (
              <button
                key={qf.id}
                onClick={() =>
                  handleApplyQuickFix(activeIssuePopover.issue, qf)
                }
                className="text-left text-xs p-2 rounded-lg bg-canvas hover:opacity-90 border border-border text-primary font-semibold transition-colors"
              >
                {qf.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. Slash Menu Popup */}
      {slashMenuOpen && (
        <div
          className="fixed z-50"
          style={{
            top: '35%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <SlashMenu
            onInsertSceneBreak={() => {
              const updated = [...chapter.paragraphs];
              updated.splice(slashMenuParagraphIndex + 1, 0, '***');
              updateChapterParagraphs(chapter.id, updated);
              tiptapEditor?.commands.setContent(paragraphsToTipTapDoc(updated), false);
              setSlashMenu(false);
            }}
            onInsertFlashback={() => {
              const updated = [...chapter.paragraphs];
              updated.splice(
                slashMenuParagraphIndex + 1,
                0,
                '[Hồi tưởng] Bắt đầu đoạn hồi tưởng quá khứ tại đây...'
              );
              updateChapterParagraphs(chapter.id, updated);
              tiptapEditor?.commands.setContent(paragraphsToTipTapDoc(updated), false);
              setSlashMenu(false);
            }}
            onInsertAuthorNote={() => {
              const updated = [...chapter.paragraphs];
              updated.splice(
                slashMenuParagraphIndex + 1,
                0,
                '> [!GHI_CHÚ_TÁC_GIẢ] Nhớ kiểm tra lại sự hiện diện của ổ khóa Thần Nông trước cảnh rượt đuổi.'
              );
              updateChapterParagraphs(chapter.id, updated);
              tiptapEditor?.commands.setContent(paragraphsToTipTapDoc(updated), false);
              setSlashMenu(false);
            }}
            onInsertCharacter={() => {
              const updated = [...chapter.paragraphs];
              const idx = Math.min(slashMenuParagraphIndex, Math.max(0, updated.length - 1));
              updated[idx] = `${(updated[idx] || '').trimEnd()} ${povName}`.trim();
              updateChapterParagraphs(chapter.id, updated);
              tiptapEditor?.commands.setContent(paragraphsToTipTapDoc(updated), false);
              setSlashMenu(false);
            }}
            onInsertLocation={() => {
              const updated = [...chapter.paragraphs];
              const idx = Math.min(slashMenuParagraphIndex, Math.max(0, updated.length - 1));
              updated[idx] = `${(updated[idx] || '').trimEnd()} ${locationName}`.trim();
              updateChapterParagraphs(chapter.id, updated);
              tiptapEditor?.commands.setContent(paragraphsToTipTapDoc(updated), false);
              setSlashMenu(false);
            }}
            onAiContinue={() => {
              sendComposerPrompt(
                'Viết tiếp cảnh này với nhịp độ dồn dập',
                chapter.id,
                slashMenuParagraphIndex,
                chapter.paragraphs[slashMenuParagraphIndex]
              );
              setSlashMenu(false);
            }}
            onAiShowDontTell={() => {
              sendComposerPrompt(
                "Chuyển đổi đoạn này theo kỹ thuật Show Don't Tell, tăng chi tiết ngũ quan",
                chapter.id,
                slashMenuParagraphIndex,
                chapter.paragraphs[slashMenuParagraphIndex]
              );
              setSlashMenu(false);
            }}
            onClose={() => setSlashMenu(false)}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Dynamically decorates raw paragraph text with interactive Lorebook Entity Pills (@Mention/#Location)
 * and Continuity Linter Squiggly Underlines across all 3 themes.
 */
function renderDecoratedParagraph(
  text: string,
  pIdx: number,
  _chapter: ChapterDocument,
  entities: LoreEntity[],
  issues: ContinuityIssue[],
  onHoverEntity: (entity: LoreEntity, e: React.MouseEvent) => void,
  onClickIssue: (issue: ContinuityIssue, e: React.MouseEvent) => void
): React.ReactNode {
  // Author note callout (High contrast across all themes)
  if (text.startsWith('> [!GHI_CHÚ_TÁC_GIẢ]')) {
    return (
      <div
        className="p-3.5 my-2 rounded-xl border-l-4 semantic-info-box text-xs font-sans"
        style={{ textIndent: 0 }}
      >
        <strong className="block mb-1 font-bold">
          📝 Ghi chú tác giả (Tự động ẩn khi xuất bản sách):
        </strong>
        <span className="text-primary font-medium">
          {text.replace('> [!GHI_CHÚ_TÁC_GIẢ]', '')}
        </span>
      </div>
    );
  }

  // Scene break
  if (text.trim() === '***') {
    return (
      <div
        className="text-center my-4 text-lg tracking-[0.5em] text-muted font-bold select-none"
        style={{ textIndent: 0 }}
      >
        * * *
      </div>
    );
  }

  // Dynamically collect all entity names, aliases, and linter issue phrases
  const entityMapByName = new Map<string, LoreEntity>();
  const tokensToMatch: string[] = [];

  for (const e of entities) {
    if (e.entity_type === 'chapter') continue;
    if (e.title.trim()) {
      entityMapByName.set(e.title.trim().toLowerCase(), e);
      tokensToMatch.push(e.title.trim());
    }
    for (const a of e.aliases || []) {
      if (a.trim()) {
        entityMapByName.set(a.trim().toLowerCase(), e);
        tokensToMatch.push(a.trim());
      }
    }
  }

  for (const iss of issues) {
    if (iss.paragraph_index === pIdx && iss.matched_text.trim()) {
      tokensToMatch.push(iss.matched_text.trim());
    }
  }

  // Sort longest tokens first so "Lâm Vũ Linh" matches before "Linh"
  const uniqueSortedTokens = Array.from(new Set(tokensToMatch)).sort(
    (a, b) => b.length - a.length
  );

  if (uniqueSortedTokens.length === 0) {
    return <span>{text}</span>;
  }

  // Whole-word matches only: a character named "An" must not light up "đang".
  const spans: Array<{ start: number; end: number; token: string }> = [];
  const taken: Array<[number, number]> = [];
  for (const token of uniqueSortedTokens) {
    for (const [start, end] of findWholeWordOccurrences(text, token, true)) {
      if (taken.some(([s, e]) => !(end <= s || start >= e))) continue;
      taken.push([start, end]);
      spans.push({ start, end, token });
    }
  }
  spans.sort((a, b) => a.start - b.start);

  const segments: Array<{ text: string; token?: string }> = [];
  let segmentCursor = 0;
  for (const span of spans) {
    if (span.start > segmentCursor) {
      segments.push({ text: text.slice(segmentCursor, span.start) });
    }
    segments.push({
      text: text.slice(span.start, span.end),
      token: span.token,
    });
    segmentCursor = span.end;
  }
  if (segmentCursor < text.length) {
    segments.push({ text: text.slice(segmentCursor) });
  }

  return (
    <span>
      {segments.map((segment, i) => {
        if (!segment.token) return <span key={i}>{segment.text}</span>;

        const chunk = segment.text;
        const lower = chunk.toLowerCase();
        const matchedEntity = entityMapByName.get(lower);

        // Check if chunk has a linter issue
        const matchingIssue = issues.find(
          (iss) =>
            iss.paragraph_index === pIdx &&
            iss.matched_text.toLowerCase() === lower
        );

        if (matchingIssue) {
          return (
            <span
              key={i}
              onClick={(e) => onClickIssue(matchingIssue, e)}
              className={
                matchingIssue.severity === 'error'
                  ? 'linter-squiggly-error'
                  : 'linter-squiggly-warning'
              }
              title={`${matchingIssue.message} (Nhấp để xem giải pháp nhanh)`}
            >
              {chunk}
            </span>
          );
        }

        if (matchedEntity) {
          const isLoc = matchedEntity.entity_type === 'location';
          return (
            <span
              key={i}
              onClick={(e) => onHoverEntity(matchedEntity, e)}
              onMouseEnter={(e) => onHoverEntity(matchedEntity, e)}
              className={isLoc ? 'lore-location-pill' : 'entity-mention-pill'}
              title={`Thực thể Lorebook: ${matchedEntity.title} (Rê chuột hoặc nhấp để mở thẻ thông tin nhanh)`}
            >
              {isLoc ? `#${chunk}` : `@${chunk}`}
            </span>
          );
        }

        return <span key={i}>{chunk}</span>;
      })}
    </span>
  );
}
