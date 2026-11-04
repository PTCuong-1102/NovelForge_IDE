'use client';

import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  useEditor,
  EditorContent,
  BubbleMenu,
} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import CharacterCount from '@tiptap/extension-character-count';
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
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Heading3,
  Quote,
  Eye,
  Type,
  Maximize2,
  Minus,
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
  scanImplicitEntitiesInChapter,
} from '@/lib/tauri-bridge';

interface NovelEditorProps {
  chapter: ChapterDocument;
}

export const NovelEditor: React.FC<NovelEditorProps> = ({ chapter }) => {
  const { entities, updateChapterParagraphs, openTab } = useWorkspaceStore();
  const {
    typewriterScrolling,
    paragraphFocus,
    toggleTypewriterScrolling,
    toggleParagraphFocus,
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

  const {
    diffProposals,
    resolveDiffProposal,
    sendComposerPrompt,
  } = useAgentStore();

  const [hoveredEntity, setHoveredEntity] = useState<LoreEntity | null>(null);
  const [hoverCardPos, setHoverCardPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const [activeIssuePopover, setActiveIssuePopover] = useState<{
    issue: ReturnType<typeof runContinuityLinterEngine>[0];
    x: number;
    y: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

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

  // Initialize TipTap instance
  const initialContent = useMemo(() => {
    return chapter.paragraphs
      .map((p) => {
        if (p.startsWith('> [!GHI_CHÚ_TÁC_GIẢ]')) {
          return `<blockquote><p><strong>GHI CHÚ TÁC GIẢ:</strong> ${p.replace(
            '> [!GHI_CHÚ_TÁC_GIẢ]',
            ''
          )}</p></blockquote>`;
        }
        if (p.trim() === '***') {
          return '<hr />';
        }
        return `<p>${p}</p>`;
      })
      .join('');
  }, [chapter.id]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: 'Bắt đầu viết bản thảo hoặc gõ / để mở menu lệnh nhanh...',
      }),
      Highlight.configure({
        multicolor: true,
      }),
      CharacterCount,
      Typography,
    ],
    content: initialContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'focus:outline-none min-h-[300px] leading-relaxed text-primary select-text',
      },
    },
    onUpdate: ({ editor }) => {
      // Sync from TipTap back to chapter paragraphs lossless structure
      const text = editor.getText();
      const rawParas = text
        .split('\n')
        .map((p) => p.trim())
        .filter(Boolean);

      if (rawParas.length > 0) {
        updateChapterParagraphs(chapter.id, rawParas);
      }
    },
  });

  // Keep editor content in sync when chapter changes
  useEffect(() => {
    if (editor && editor.getText().length === 0 && chapter.paragraphs.length > 0) {
      editor.commands.setContent(initialContent);
    }
  }, [chapter.id, editor, initialContent]);

  const handleParagraphChange = (pIdx: number, newText: string) => {
    const updated = [...chapter.paragraphs];
    updated[pIdx] = newText;
    updateChapterParagraphs(chapter.id, updated);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    pIdx: number
  ) => {
    if (e.key === '/') {
      setSlashMenu(true, pIdx);
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
      className="relative flex-1 h-full overflow-y-auto px-6 py-6 flex flex-col items-center select-text"
      style={{ backgroundColor: 'var(--bg-canvas)' }}
      onClick={() => {
        setHoveredEntity(null);
        setActiveIssuePopover(null);
        if (slashMenuOpen) setSlashMenu(false);
      }}
    >
      <div className="w-full max-w-[780px] flex flex-col">
        {/* Editor Floating Toolbar (Ergonomics) */}
        <div
          className="sticky top-0 z-30 mb-6 px-3 py-1.5 rounded-xl border shadow-sm backdrop-blur-md flex items-center justify-between text-xs select-none"
          style={{
            backgroundColor: 'var(--bg-panel)',
            borderColor: 'var(--border-color)',
          }}
        >
          {/* Text Styles */}
          <div className="flex items-center gap-1 border-r border-border/50 pr-2">
            <button
              onClick={() => editor?.chain().focus().toggleBold().run()}
              className={`p-1.5 rounded hover:bg-elevated transition-colors ${
                editor?.isActive('bold') ? 'bg-accent/15 text-accent font-bold' : 'text-muted hover:text-primary'
              }`}
              title="In đậm (Ctrl+B)"
            >
              <Bold size={13} />
            </button>
            <button
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              className={`p-1.5 rounded hover:bg-elevated transition-colors ${
                editor?.isActive('italic') ? 'bg-accent/15 text-accent font-bold' : 'text-muted hover:text-primary'
              }`}
              title="In nghiêng (Ctrl+I)"
            >
              <Italic size={13} />
            </button>
            <button
              onClick={() => editor?.chain().focus().toggleStrike().run()}
              className={`p-1.5 rounded hover:bg-elevated transition-colors ${
                editor?.isActive('strike') ? 'bg-accent/15 text-accent font-bold' : 'text-muted hover:text-primary'
              }`}
              title="Gạch ngang"
            >
              <Strikethrough size={13} />
            </button>
            <button
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`p-1.5 rounded hover:bg-elevated transition-colors ${
                editor?.isActive('heading', { level: 2 }) ? 'bg-accent/15 text-accent font-bold' : 'text-muted hover:text-primary'
              }`}
              title="Tiêu đề phân đoạn (H2)"
            >
              <Heading2 size={13} />
            </button>
            <button
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              className={`p-1.5 rounded hover:bg-elevated transition-colors ${
                editor?.isActive('blockquote') ? 'bg-accent/15 text-accent font-bold' : 'text-muted hover:text-primary'
              }`}
              title="Trích dẫn văn học"
            >
              <Quote size={13} />
            </button>
          </div>

          {/* Typography & Focus Mode */}
          <div className="flex items-center gap-2">
            {/* Font selector */}
            <div className="flex items-center gap-1 bg-elevated px-1.5 py-0.5 rounded border border-border">
              <Type size={12} className="text-muted" />
              <select
                value={proseFont}
                onChange={(e) => setProseFont(e.target.value as 'serif' | 'sans' | 'mono')}
                className="bg-transparent text-[11px] text-primary focus:outline-none cursor-pointer"
              >
                <option value="serif">Literata (Serif)</option>
                <option value="sans">Inter (Sans)</option>
                <option value="mono">JetBrains Mono</option>
              </select>
            </div>

            {/* Font size */}
            <div className="flex items-center gap-1 text-[11px] text-muted">
              <button
                onClick={() => setProseFontSize(Math.max(14, proseFontSize - 1))}
                className="p-1 hover:bg-elevated rounded"
                title="Giảm cỡ chữ"
              >
                <Minus size={11} />
              </button>
              <span className="font-mono text-primary">{proseFontSize}px</span>
              <button
                onClick={() => setProseFontSize(Math.min(26, proseFontSize + 1))}
                className="p-1 hover:bg-elevated rounded"
                title="Tăng cỡ chữ"
              >
                <Plus size={11} />
              </button>
            </div>

            {/* Paragraph Focus Toggle */}
            <button
              onClick={toggleParagraphFocus}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                paragraphFocus
                  ? 'bg-accent/15 border-accent/40 text-accent'
                  : 'bg-elevated border-border text-muted hover:text-primary'
              }`}
              title="Tập trung vào đoạn văn đang soạn thảo"
            >
              Paragraph Focus
            </button>
          </div>
        </div>

        {/* Chapter Header Properties (Notion Style) */}
        <ChapterHeaderProperties
          chapter={chapter}
          entities={entities}
          wordCount={words}
        />

        {/* Chapter Title */}
        <h1 className="text-2xl md:text-3xl font-bold mb-6 text-primary tracking-tight">
          {chapter.title}
        </h1>

        {/* Prose Paragraphs with Dynamic Semantic Underlines & Hover Support */}
        <div className="flex flex-col gap-6 prose-editor-area">
          {chapter.paragraphs.map((para, pIdx) => {
            const isFocused = focusedParagraphIndex === pIdx;
            const diffForThisPara = pendingDiffs.find(
              (d) => d.paragraph_index === pIdx
            );
            const paraIssues = issues.filter(
              (i) => i.paragraph_index === pIdx
            );

            return (
              <div
                key={pIdx}
                className={`relative group transition-opacity duration-200 ${
                  paragraphFocus && !isFocused ? 'opacity-70' : 'opacity-100'
                }`}
                onFocus={() => setFocusedParagraphIndex(pIdx)}
              >
                {/* Visual Rich Display with Entity Pills & Linter Squiggly */}
                <div
                  className={`p-3 rounded-lg leading-relaxed text-primary ${fontClass} transition-colors border ${
                    isFocused ? 'border-border/60 bg-elevated/20' : 'border-transparent'
                  }`}
                  style={{ fontSize: `${proseFontSize}px`, lineHeight: 1.75 }}
                >
                  {/* Highlight paragraph tokens: Entity Pills & Linter Underlines */}
                  <div className="whitespace-pre-wrap">
                    {renderDecoratedParagraph(
                      para,
                      pIdx,
                      chapter,
                      entities,
                      paraIssues,
                      (ent, e) => {
                        e.stopPropagation();
                        setHoveredEntity(ent);
                        setHoverCardPos({ x: e.clientX, y: e.clientY + 15 });
                      },
                      (issue, e) => {
                        e.stopPropagation();
                        setActiveIssuePopover({
                          issue,
                          x: e.clientX,
                          y: e.clientY + 15,
                        });
                      }
                    )}
                  </div>

                  {/* Inline text area for editing */}
                  <textarea
                    value={para}
                    onChange={(e) => handleParagraphChange(pIdx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, pIdx)}
                    rows={Math.max(2, Math.ceil(para.length / 80))}
                    className="w-full mt-2 bg-transparent resize-none focus:outline-none text-muted text-xs font-mono border-t border-border/30 pt-1 opacity-0 group-hover:opacity-60 focus:opacity-100 transition-opacity"
                    placeholder="Chỉnh sửa văn bản thô... (Gõ / để mở Slash Command)"
                  />
                </div>

                {/* Inline Diff Proposal Floating Card (Cline / Antigravity / OpenCode) */}
                {diffForThisPara && (
                  <div
                    className="mt-2 p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-950/20 shadow-lg flex flex-col gap-2 select-none animate-in fade-in slide-in-from-top-2"
                    style={{ backgroundColor: 'var(--bg-elevated)' }}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
                        <Sparkles size={14} />
                        Đề xuất chỉnh sửa từ {diffForThisPara.agent_name}:
                      </span>
                      <span className="text-[10px] text-muted">
                        {diffForThisPara.created_at}
                      </span>
                    </div>

                    <div className="text-xs leading-relaxed flex flex-col gap-1.5 font-serif">
                      <div className="p-2 rounded bg-red-500/10 border-l-2 border-red-500 text-red-300 line-through text-[13px]">
                        {diffForThisPara.original_text}
                      </div>
                      <div className="p-2 rounded bg-emerald-500/10 border-l-2 border-emerald-500 text-emerald-300 font-medium text-[13px]">
                        {diffForThisPara.proposed_text}
                      </div>
                    </div>

                    <p className="text-[11px] text-muted italic">
                      Lý do: &ldquo;{diffForThisPara.rationale}&rdquo;
                    </p>

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/50 text-xs">
                      <button
                        onClick={() =>
                          resolveDiffProposal(diffForThisPara.id, 'rejected')
                        }
                        className="px-2.5 py-1 rounded bg-elevated hover:bg-elevated/80 text-muted hover:text-primary transition-colors flex items-center gap-1 font-medium"
                      >
                        <X size={13} />
                        <span>Từ chối (Esc)</span>
                      </button>
                      <button
                        onClick={() => {
                          handleParagraphChange(pIdx, diffForThisPara.proposed_text);
                          resolveDiffProposal(diffForThisPara.id, 'accepted');
                        }}
                        className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1 font-semibold"
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

        {/* Append New Paragraph Button */}
        <div className="mt-8 mb-20 flex justify-center">
          <button
            onClick={() => {
              const updated = [
                ...chapter.paragraphs,
                'Viết tiếp phân cảnh tại đây...',
              ];
              updateChapterParagraphs(chapter.id, updated);
              setFocusedParagraphIndex(updated.length - 1);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-elevated hover:bg-elevated/80 border border-border text-xs font-semibold text-primary transition-colors"
          >
            <Plus size={14} />
            <span>Thêm đoạn văn mới (Enter)</span>
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
                  <span className="text-[11px] font-normal text-muted">
                    ({hoveredEntity.aliases.join(', ')})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    hoveredEntity.status === 'dead'
                      ? 'bg-red-500/15 text-red-400'
                      : 'bg-emerald-500/15 text-emerald-400'
                  }`}
                >
                  {hoveredEntity.status === 'dead' ? '● Đã tử vong' : '● Còn sống'}
                </span>
                {hoveredEntity.age_at_story && (
                  <span className="text-[10px] text-muted">
                    {hoveredEntity.age_at_story} tuổi
                  </span>
                )}
                {hoveredEntity.role && (
                  <span className="text-[10px] text-muted truncate max-w-[120px]">
                    {hoveredEntity.role}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setHoveredEntity(null)}
              className="p-1 text-muted hover:text-primary rounded hover:bg-canvas"
            >
              <X size={12} />
            </button>
          </div>

          <div className="space-y-1.5 text-[11px] text-muted border-t border-border/50 pt-2 mb-3 leading-relaxed">
            {hoveredEntity.appearance && (
              <div>
                <strong className="text-primary font-medium">Ngoại hình:</strong>{' '}
                {hoveredEntity.appearance}
              </div>
            )}
            {hoveredEntity.personality && (
              <div>
                <strong className="text-primary font-medium">Tính cách:</strong>{' '}
                {hoveredEntity.personality}
              </div>
            )}
            {hoveredEntity.death_chapter_title && (
              <div className="text-red-400 font-medium">
                Tử vong: {hoveredEntity.death_chapter_title} (
                {hoveredEntity.death_date})
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border/50 pt-2 text-[11px]">
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
              className="text-emerald-500 hover:underline flex items-center gap-1 font-medium"
            >
              <ExternalLink size={12} />
              <span>Mở hồ sơ</span>
            </button>
            <button
              onClick={() => {
                openFindUsages(hoveredEntity.id);
                setHoveredEntity(null);
              }}
              className="text-primary hover:text-accent flex items-center gap-1 font-medium"
            >
              <Search size={12} />
              <span>Xem xuất hiện</span>
            </button>
            <button
              onClick={() => {
                openRefactorModal(hoveredEntity.id);
                setHoveredEntity(null);
              }}
              className="text-primary hover:text-accent flex items-center gap-1 font-medium"
            >
              <Edit3 size={12} />
              <span>Đổi tên (Shift+F6)</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. Continuity Linter Popover & Quick Fixes */}
      {activeIssuePopover && (
        <div
          className="fixed z-50 w-88 rounded-xl shadow-2xl border p-4 select-none animate-in fade-in zoom-in-95 duration-150 text-xs"
          style={{
            left: `${Math.min(activeIssuePopover.x, window.innerWidth - 360)}px`,
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
                <span className="text-red-500 flex items-center gap-1">
                  <AlertCircle size={16} /> Mâu Thuẫn Logic Cốt Truyện
                </span>
              ) : (
                <span className="text-amber-500 flex items-center gap-1">
                  <AlertTriangle size={16} /> Cảnh Báo Văn Phong
                </span>
              )}
            </div>
            <button
              onClick={() => setActiveIssuePopover(null)}
              className="p-1 text-muted hover:text-primary rounded hover:bg-canvas"
            >
              <X size={12} />
            </button>
          </div>

          <p className="text-xs text-primary leading-relaxed mb-1">
            {activeIssuePopover.issue.message}
          </p>
          <p className="text-[11px] text-muted mb-3 leading-relaxed">
            {activeIssuePopover.issue.detail}
          </p>

          <div className="border-t border-border/50 pt-2 flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
              <Lightbulb size={12} /> Giải pháp nhanh (Quick Fix - Alt+Enter):
            </span>
            {activeIssuePopover.issue.quick_fixes.map((qf) => (
              <button
                key={qf.id}
                onClick={() =>
                  handleApplyQuickFix(activeIssuePopover.issue, qf.action)
                }
                className="text-left text-[11px] p-1.5 rounded hover:bg-canvas text-accent font-medium transition-colors"
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
          style={{ top: '35%', left: '50%', transform: 'translate(-50%, -50%)' }}
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
              updated[slashMenuParagraphIndex] += ' @Lâm Vũ Linh';
              updateChapterParagraphs(chapter.id, updated);
              setSlashMenu(false);
            }}
            onInsertLocation={() => {
              const updated = [...chapter.paragraphs];
              updated[slashMenuParagraphIndex] += ' #Bến_Cảng_Đông';
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
                'Chuyển đổi đoạn này theo kỹ thuật Show Don\'t Tell, tăng chi tiết ngũ quan',
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
 * and Continuity Linter Squiggly Underlines.
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
  // If paragraph contains author note
  if (text.startsWith('> [!GHI_CHÚ_TÁC_GIẢ]')) {
    return (
      <div className="p-3 my-2 rounded-lg bg-blue-500/10 border-l-4 border-blue-500 text-blue-300 text-xs font-sans">
        <strong className="block mb-1 font-bold">Ghi chú tác giả (Sẽ ẩn khi xuất bản):</strong>
        <span>{text.replace('> [!GHI_CHÚ_TÁC_GIẢ]', '')}</span>
      </div>
    );
  }

  // If scene break
  if (text.trim() === '***') {
    return (
      <div className="text-center my-6 text-xl tracking-widest text-muted font-bold">
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
      {text.split(/(\b(?:Lâm Vũ Linh|Tiểu Linh|Trần Hạo|Hạo Đen|Vũ Đình Khánh|Chỉ huy Khánh|Kiều Hạ My|Bác sĩ My|Chim Bói Cá|Bến Cảng Đông|Cảng Đông|Tháp Chỉ Huy Aegis|Ổ Khóa Lượng Tử Thần Nông|Lõi Thần Nông|lạnh lẽo|tóc dài)\b)/g).map((chunk, i) => {
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
              title={`${matchingIssue.message} (Bấm để xem giải pháp nhanh)`}
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
              title={`Nhân vật/Thực thể: ${matchedEntity.title} (Bấm để xem Hover Card)`}
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
