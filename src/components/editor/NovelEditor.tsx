'use client';

import React, { useRef, useState, useEffect, useMemo } from 'react';
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
  Eye,
} from 'lucide-react';
import { ChapterDocument, LoreEntity } from '@/lib/tauri-bridge';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { useAgentStore } from '@/stores/useAgentStore';
import { ChapterHeaderProperties } from './ChapterHeaderProperties';
import { SlashMenu } from './SlashMenu';
import {
  countVietnameseAndLatinWords,
  runContinuityLinterEngine,
} from '@/lib/tauri-bridge';

interface NovelEditorProps {
  chapter: ChapterDocument;
}

export const NovelEditor: React.FC<NovelEditorProps> = ({ chapter }) => {
  const { entities, updateChapterParagraphs, updateChapterMetadata, openTab } =
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

  const [editingParagraphIndex, setEditingParagraphIndex] = useState<
    number | null
  >(null);
  const [editingChapterTitle, setEditingChapterTitle] = useState(false);

  const [hoveredEntity, setHoveredEntity] = useState<LoreEntity | null>(null);
  const [hoverCardPos, setHoverCardPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [activeIssuePopover, setActiveIssuePopover] = useState<{
    issue: ReturnType<typeof runContinuityLinterEngine>[0];
    x: number;
    y: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const activeTextareaRef = useRef<HTMLTextAreaElement | null>(null);

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

  // Auto-focus and auto-resize textarea when entering in-place editing
  useEffect(() => {
    if (editingParagraphIndex !== null && activeTextareaRef.current) {
      const el = activeTextareaRef.current;
      el.focus();
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [editingParagraphIndex]);

  const handleParagraphChange = (pIdx: number, newText: string) => {
    const updated = [...chapter.paragraphs];
    updated[pIdx] = newText;
    updateChapterParagraphs(chapter.id, updated);
    if (activeTextareaRef.current) {
      activeTextareaRef.current.style.height = 'auto';
      activeTextareaRef.current.style.height = `${activeTextareaRef.current.scrollHeight}px`;
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    pIdx: number
  ) => {
    if (e.key === '/') {
      setSlashMenu(true, pIdx);
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
      const updated = [...chapter.paragraphs];
      updated.splice(pIdx + 1, 0, '');
      updateChapterParagraphs(chapter.id, updated);
      setFocusedParagraphIndex(pIdx + 1);
      setEditingParagraphIndex(pIdx + 1);
    }
  };

  // Quick fix resolution
  const handleApplyQuickFix = (
    issue: ReturnType<typeof runContinuityLinterEngine>[0],
    action: string
  ) => {
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
      if (issue.matched_text === 'lạnh lẽo') {
        updated[issue.paragraph_index] = updated[issue.paragraph_index].replace(
          /lạnh lẽo/g,
          'buốt lạnh'
        );
      } else if (issue.matched_text === 'tóc dài') {
        updated[issue.paragraph_index] = updated[issue.paragraph_index].replace(
          /tóc dài/g,
          'mái tóc ngắn ngang vai'
        );
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
        {/* Left: Quick Literary Block Actions */}
        <div className="flex items-center gap-1.5">
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
            <span>Chèn / Lệnh AI (/)</span>
          </button>

          <button
            onClick={() => {
              const targetIdx = editingParagraphIndex ?? focusedParagraphIndex;
              const updated = [...chapter.paragraphs];
              updated.splice(targetIdx + 1, 0, '***');
              updateChapterParagraphs(chapter.id, updated);
            }}
            className="px-2 py-1 rounded-lg hover:bg-elevated text-muted hover:text-primary font-mono font-bold transition-colors"
            title="Chèn ngắt phân cảnh (***)"
          >
            ***
          </button>

          <button
            onClick={toggleFirstLineIndent}
            className={`px-2.5 py-1 rounded-lg border flex items-center gap-1 font-medium transition-colors ${
              firstLineIndent
                ? 'semantic-success-box'
                : 'bg-elevated border-border text-muted hover:text-primary'
            }`}
            title="Bật/Tắt thụt đầu dòng văn học (First-line Indent)"
          >
            <Indent size={13} />
            <span className="hidden sm:inline">Thụt đầu dòng</span>
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

        {/* Seamless In-Place Prose Paragraphs */}
        <div className="flex flex-col gap-5 prose-editor-area">
          {chapter.paragraphs.map((para, pIdx) => {
            const isFocused =
              focusedParagraphIndex === pIdx || editingParagraphIndex === pIdx;
            const isEditing = editingParagraphIndex === pIdx;
            const diffForThisPara = pendingDiffs.find(
              (d) => d.paragraph_index === pIdx
            );
            const paraIssues = issues.filter(
              (i) => i.paragraph_index === pIdx
            );
            const isSpecialBlock =
              para.startsWith('> [!GHI_CHÚ_TÁC_GIẢ]') || para.trim() === '***';

            return (
              <div
                key={pIdx}
                className={`relative group transition-opacity duration-200 ${
                  paragraphFocus && !isFocused ? 'opacity-45 hover:opacity-90' : 'opacity-100'
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
                      onBlur={() => setEditingParagraphIndex(null)}
                      style={{
                        fontSize: `${proseFontSize}px`,
                        lineHeight: 1.85,
                        textIndent:
                          firstLineIndent && !isSpecialBlock ? '1.75em' : '0',
                      }}
                      className={`w-full bg-transparent resize-none focus:outline-none text-primary ${fontClass}`}
                      placeholder="Nhập nội dung đoạn văn... (Nhấn Enter để sang đoạn mới, Esc để hoàn tất, / để mở lệnh)"
                    />
                    <div className="flex items-center justify-between pt-2 mt-1 border-t border-border/50 text-[11px] text-muted font-sans select-none">
                      <span>
                        Đang sửa trực tiếp đoạn {pIdx + 1} · Gõ{' '}
                        <kbd className="px-1 py-0.5 rounded bg-canvas border border-border font-mono">
                          /
                        </kbd>{' '}
                        để gọi AI hoặc chèn thực thể
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
                            setHoveredEntity(ent);
                            setHoverCardPos({
                              x: Math.min(e.clientX, window.innerWidth - 340),
                              y: e.clientY + 14,
                            });
                          },
                          (issue, e) => {
                            e.stopPropagation();
                            setActiveIssuePopover({
                              issue,
                              x: Math.min(e.clientX, window.innerWidth - 360),
                              y: e.clientY + 14,
                            });
                          }
                        )
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
                        Đề xuất chỉnh sửa từ {diffForThisPara.agent_name} (Đoạn{' '}
                        {pIdx + 1}):
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
                        onClick={() =>
                          resolveDiffProposal(diffForThisPara.id, 'rejected')
                        }
                        className="px-3 py-1.5 rounded-lg bg-canvas hover: opacity-90 border border-border text-primary transition-colors flex items-center gap-1 font-semibold"
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

        {/* Append New Paragraph Action */}
        <div className="mt-8 pt-4 border-t border-border/50 flex justify-center select-none">
          <button
            onClick={() => {
              const updated = [...chapter.paragraphs, ''];
              updateChapterParagraphs(chapter.id, updated);
              const newIdx = updated.length - 1;
              setFocusedParagraphIndex(newIdx);
              setEditingParagraphIndex(newIdx);
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
                  handleApplyQuickFix(activeIssuePopover.issue, qf.action)
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
              setSlashMenu(false);
            }}
            onInsertCharacter={() => {
              const updated = [...chapter.paragraphs];
              updated[slashMenuParagraphIndex] += ' Lâm Vũ Linh';
              updateChapterParagraphs(chapter.id, updated);
              setSlashMenu(false);
            }}
            onInsertLocation={() => {
              const updated = [...chapter.paragraphs];
              updated[slashMenuParagraphIndex] += ' Bến Cảng Đông';
              updateChapterParagraphs(chapter.id, updated);
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
 * Decorates raw paragraph text with interactive Entity Pills (@Mention/#Location)
 * and Continuity Linter Squiggly Underlines with high-contrast across all 3 themes.
 */
function renderDecoratedParagraph(
  text: string,
  pIdx: number,
  chapter: ChapterDocument,
  entities: LoreEntity[],
  issues: ReturnType<typeof runContinuityLinterEngine>,
  onHoverEntity: (entity: LoreEntity, e: React.MouseEvent) => void,
  onClickIssue: (
    issue: ReturnType<typeof runContinuityLinterEngine>[0],
    e: React.MouseEvent
  ) => void
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

  // Tokenize text to highlight entities and linter issues
  const entityMapByName = new Map<string, LoreEntity>();
  entities.forEach((e) => {
    entityMapByName.set(e.title.toLowerCase(), e);
    e.aliases?.forEach((a) => entityMapByName.set(a.toLowerCase(), e));
  });

  return (
    <span>
      {text
        .split(
          /(\b(?:Lâm Vũ Linh|Tiểu Linh|Trần Hạo|Hạo Đen|Vũ Đình Khánh|Chỉ huy Khánh|Kiều Hạ My|Bác sĩ My|Chim Bói Cá|Bến Cảng Đông|Cảng Đông|Tháp Chỉ Huy Aegis|Ổ Khóa Lượng Tử Thần Nông|Lõi Thần Nông|lạnh lẽo|tóc dài)\b)/g
        )
        .map((chunk, i) => {
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
                className={isLoc ? 'lore-location-pill' : 'entity-mention-pill'}
                title={`Thực thể Lorebook: ${matchedEntity.title} (Nhấp để mở thẻ thông tin nhanh)`}
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
