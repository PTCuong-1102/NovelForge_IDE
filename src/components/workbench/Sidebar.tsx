'use client';

import React, { useMemo, useState } from 'react';
import {
  FileText,
  Folder,
  FolderOpen,
  Plus,
  ChevronRight,
  ChevronDown,
  User,
  MapPin,
  Sparkles,
  GitCommit,
  AlertTriangle,
  XCircle,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useEditorStore } from '@/stores/useEditorStore';
import {
  countVietnameseAndLatinWords,
  runContinuityLinterEngine,
  type ChapterDocument,
  type ContinuityIssue,
} from '@/lib/tauri-bridge';

export const Sidebar: React.FC = () => {
  const {
    activeActivity,
    chapters,
    entities,
    snapshots,
    openTab,
    createChapter,
    activeBranch,
    availableBranches,
    switchBranch,
    createWhatIfBranch,
    createGitSnapshot,
    restoreSnapshot,
    updateChapterParagraphs,
  } = useWorkspaceStore();

  const {
    activeChapterId,
    openFindUsages,
    openRefactorModal,
    ignoreIssue,
    ignoredIssueIds,
    setActiveChapterId,
    setFocusedParagraphIndex,
  } = useEditorStore();

  const [expandedActs, setExpandedActs] = useState<Record<string, boolean>>({});
  const [expandedLoreTypes, setExpandedLoreTypes] = useState<
    Record<string, boolean>
  >({
    character: true,
    location: true,
    item: true,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [newBranchInput, setNewBranchInput] = useState('');
  const [showNewBranchInput, setShowNewBranchInput] = useState(false);

  const toggleAct = (actId: string) => {
    setExpandedActs((prev) => ({
      ...prev,
      [actId]: !(prev[actId] ?? true),
    }));
  };

  const toggleLoreGroup = (type: string) => {
    setExpandedLoreTypes((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  // Compile linter issues across all chapters
  const allIssues = useMemo(
    () =>
      chapters.flatMap((ch) =>
        runContinuityLinterEngine(ch, entities, ignoredIssueIds)
      ),
    [chapters, entities, ignoredIssueIds]
  );

  // Applies a continuity quick fix to the offending paragraph of its chapter.
  const applyParagraphFix = (
    issue: ContinuityIssue,
    transform: (text: string) => string
  ) => {
    const chapter = chapters.find((c) => c.id === issue.chapter_id);
    if (!chapter) return;
    const paragraphs = [...chapter.paragraphs];
    const current = paragraphs[issue.paragraph_index];
    if (current === undefined) return;
    const next = transform(current);
    if (next === current) return;
    paragraphs[issue.paragraph_index] = next;
    updateChapterParagraphs(chapter.id, paragraphs);
    ignoreIssue(issue.id);
  };

  // Group chapters by their act so the explorer follows the project structure
  const actGroups = useMemo(() => {    const groups = new Map<string, { title: string; chapters: ChapterDocument[] }>();
    for (const ch of chapters) {
      const actId = ch.act_id || 'act_01';
      const group = groups.get(actId);
      if (group) {
        group.chapters.push(ch);
      } else {
        groups.set(actId, {
          title: ch.act_title || ch.act_id || 'Bản thảo',
          chapters: [ch],
        });
      }
    }
    return Array.from(groups.entries());
  }, [chapters]);

  return (
    <div
      className="w-68 h-full flex flex-col select-none border-r text-sm"
      style={{
        backgroundColor: 'var(--bg-panel)',
        borderColor: 'var(--border-color)',
      }}
    >
      {/* 1. EXPLORER VIEW */}
      {activeActivity === 'explorer' && (
        <div className="flex flex-col h-full">
          <div
            className="p-3 border-b flex justify-between items-center"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              Bản Thảo (Manuscript)
            </span>
            <button
              onClick={() => createChapter('')}
              title="Thêm chương mới"
              className="p-1 hover:bg-elevated rounded-lg text-muted hover:text-primary transition-colors"
            >
              <Plus size={15} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5">
            {/* Act groups */}
            {actGroups.map(([actId, group]) => {
              const expanded = expandedActs[actId] ?? true;
              return (
                <div key={actId} className="mb-2">
                  <div
                    onClick={() => toggleAct(actId)}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-elevated text-xs font-bold text-primary"
                  >
                    {expanded ? (
                      <ChevronDown size={14} className="text-muted" />
                    ) : (
                      <ChevronRight size={14} className="text-muted" />
                    )}
                    {expanded ? (
                      <FolderOpen size={15} className="semantic-warning-text" />
                    ) : (
                      <Folder size={15} className="semantic-warning-text" />
                    )}
                    <span className="truncate">{group.title}</span>
                  </div>

                  {expanded && (
                    <div className="ml-4 pl-2 border-l border-border flex flex-col gap-1 mt-1">
                      {group.chapters.map((ch) => {
                        const words = countVietnameseAndLatinWords(
                          ch.paragraphs.join(' ')
                        );
                        const isCurrent = ch.id === activeChapterId;
                        return (
                          <div
                            key={ch.id}
                            onClick={() => {
                              setActiveChapterId(ch.id);
                              openTab({
                                id: `tab-${ch.id}`,
                                title: ch.title,
                                type: 'chapter',
                                targetId: ch.id,
                              });
                            }}
                            className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                              isCurrent
                                ? 'bg-elevated font-semibold text-primary border border-border'
                                : 'hover:bg-elevated/60 text-primary'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <FileText
                                size={14}
                                className={`shrink-0 ${
                                  isCurrent ? 'text-accent' : 'text-muted'
                                }`}
                              />
                              <span className="truncate text-xs">{ch.title}</span>
                            </div>
                            <span className="text-[11px] font-mono text-muted ml-2 shrink-0">
                              {words} từ
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Quick Lorebook database link */}
            <div
              className="pt-2.5 border-t mt-4"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div
                onClick={() =>
                  openTab({
                    id: 'tab-lore-db',
                    title: 'Lorebook Database',
                    type: 'lore-database',
                    targetId: 'lore-all',
                  })
                }
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-elevated text-xs font-semibold semantic-success-text transition-colors"
              >
                <Sparkles size={14} />
                <span>Mở Toàn Bộ Lorebook (Wiki)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. LOREBOOK VIEW */}
      {activeActivity === 'lorebook' && (
        <div className="flex flex-col h-full">
          <div
            className="p-3 border-b flex justify-between items-center"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              Thế Giới Quan (Lorebook)
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  openTab({
                    id: 'tab-rel-graph',
                    title: 'Sơ Đồ Quan Hệ',
                    type: 'relationship-graph',
                    targetId: 'graph-all',
                  })
                }
                title="Mở Sơ đồ quan hệ nhân vật (React Flow)"
                className="px-2 py-0.5 text-[11px] border semantic-success-box rounded-md font-semibold hover:opacity-90 transition-opacity"
              >
                Graph
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5">
            {/* Characters */}
            <div className="mb-3">
              <div
                onClick={() => toggleLoreGroup('character')}
                className="flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer hover:bg-elevated text-xs font-bold text-primary"
              >
                <div className="flex items-center gap-1.5">
                  {expandedLoreTypes['character'] ? (
                    <ChevronDown size={13} className="text-muted" />
                  ) : (
                    <ChevronRight size={13} className="text-muted" />
                  )}
                  <User size={14} className="semantic-success-text" />
                  <span>
                    Nhân vật (
                    {
                      entities.filter((e) => e.entity_type === 'character')
                        .length
                    }
                    )
                  </span>
                </div>
              </div>

              {expandedLoreTypes['character'] && (
                <div className="ml-4 pl-2 border-l border-border flex flex-col gap-1 mt-1">
                  {entities
                    .filter((e) => e.entity_type === 'character')
                    .map((char) => (
                      <div
                        key={char.id}
                        onClick={() =>
                          openTab({
                            id: `tab-char-${char.id}`,
                            title: char.title,
                            type: 'lore-entity',
                            targetId: char.id,
                          })
                        }
                        className="group flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer hover:bg-elevated text-xs text-primary font-medium"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              char.status === 'dead'
                                ? 'bg-red-500'
                                : 'bg-emerald-500'
                            }`}
                          />
                          <span className="truncate">{char.title}</span>
                        </div>
                        {char.status === 'dead' && (
                          <span className="text-[10px] border semantic-error-box px-1.5 py-0.5 rounded font-semibold">
                            Tử vong
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Locations */}
            <div className="mb-3">
              <div
                onClick={() => toggleLoreGroup('location')}
                className="flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer hover:bg-elevated text-xs font-bold text-primary"
              >
                <div className="flex items-center gap-1.5">
                  {expandedLoreTypes['location'] ? (
                    <ChevronDown size={13} className="text-muted" />
                  ) : (
                    <ChevronRight size={13} className="text-muted" />
                  )}
                  <MapPin size={14} className="semantic-info-text" />
                  <span>
                    Địa danh (
                    {entities.filter((e) => e.entity_type === 'location').length}
                    )
                  </span>
                </div>
              </div>

              {expandedLoreTypes['location'] && (
                <div className="ml-4 pl-2 border-l border-border flex flex-col gap-1 mt-1">
                  {entities
                    .filter((e) => e.entity_type === 'location')
                    .map((loc) => (
                      <div
                        key={loc.id}
                        onClick={() =>
                          openTab({
                            id: `tab-loc-${loc.id}`,
                            title: loc.title,
                            type: 'lore-entity',
                            targetId: loc.id,
                          })
                        }
                        className="flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer hover:bg-elevated text-xs text-primary font-medium"
                      >
                        <span className="truncate">#{loc.title}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Items */}
            <div className="mb-3">
              <div
                onClick={() => toggleLoreGroup('item')}
                className="flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer hover:bg-elevated text-xs font-bold text-primary"
              >
                <div className="flex items-center gap-1.5">
                  {expandedLoreTypes['item'] ? (
                    <ChevronDown size={13} className="text-muted" />
                  ) : (
                    <ChevronRight size={13} className="text-muted" />
                  )}
                  <Sparkles size={14} className="semantic-warning-text" />
                  <span>
                    Vật phẩm (
                    {entities.filter((e) => e.entity_type === 'item').length})
                  </span>
                </div>
              </div>

              {expandedLoreTypes['item'] && (
                <div className="ml-4 pl-2 border-l border-border flex flex-col gap-1 mt-1">
                  {entities
                    .filter((e) => e.entity_type === 'item')
                    .map((item) => (
                      <div
                        key={item.id}
                        onClick={() =>
                          openTab({
                            id: `tab-item-${item.id}`,
                            title: item.title,
                            type: 'lore-entity',
                            targetId: item.id,
                          })
                        }
                        className="flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer hover:bg-elevated text-xs text-primary font-medium"
                      >
                        <span className="truncate">{item.title}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. SEARCH & FIND USAGES VIEW */}
      {activeActivity === 'search' && (
        <div className="flex flex-col h-full">
          <div
            className="p-3 border-b"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              Tra Cứu Toàn Cục (Ctrl+Shift+F)
            </span>
            <div className="mt-2">
              <input
                type="text"
                placeholder="Tìm từ khóa hoặc tên nhân vật..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-elevated rounded-lg border border-border text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5">
            <div className="mb-3">
              <span className="text-[11px] font-bold text-muted uppercase">
                Tra cứu xuất hiện nhanh:
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {entities.slice(0, 4).map((e) => (
                  <button
                    key={e.id}
                    onClick={() => {
                      setSearchQuery(e.title);
                      openFindUsages(e.id);
                    }}
                    className="px-2 py-1 bg-elevated hover:opacity-90 border border-border rounded-md text-xs font-medium text-primary transition-colors"
                  >
                    {e.title}
                  </button>
                ))}
              </div>
            </div>

            {searchQuery && (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-muted">
                  Kết quả cho &ldquo;{searchQuery}&rdquo;:
                </span>
                {chapters.map((ch) => {
                  const matchingParas = ch.paragraphs
                    .map((p, idx) => ({ p, idx }))
                    .filter((item) =>
                      item.p.toLowerCase().includes(searchQuery.toLowerCase())
                    );
                  if (matchingParas.length === 0) return null;

                  return (
                    <div
                      key={ch.id}
                      className="p-2.5 bg-elevated/60 rounded-xl border border-border text-xs"
                    >
                      <div className="font-bold text-primary mb-1">
                        {ch.title} ({matchingParas.length} lần)
                      </div>
                      {matchingParas.map((m) => (
                        <div
                          key={m.idx}
                          onClick={() => {
                            setActiveChapterId(ch.id);
                            setFocusedParagraphIndex(m.idx);
                            openTab({
                              id: `tab-${ch.id}`,
                              title: ch.title,
                              type: 'chapter',
                              targetId: ch.id,
                            });
                          }}
                          className="p-1.5 hover:bg-canvas rounded-lg cursor-pointer text-muted hover:text-primary truncate transition-colors"
                        >
                          Đoạn {m.idx + 1}: &ldquo;{m.p}&rdquo;
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. STORY TIMELINE & GIT SNAPSHOTS VIEW */}
      {activeActivity === 'git' && (
        <div className="flex flex-col h-full">
          <div
            className="p-3 border-b flex flex-col gap-2"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Dòng Thời Gian & Nhánh Cốt Truyện
              </span>
              <button
                onClick={() => setShowNewBranchInput(!showNewBranchInput)}
                title="Tạo nhánh cốt truyện thử nghiệm (What-If Timeline)"
                className="p-1 hover:bg-elevated rounded-lg text-muted hover:text-primary transition-colors"
              >
                <Plus size={15} />
              </button>
            </div>

            {/* Branch selector */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted font-medium">Nhánh (Mô phỏng):</span>
              <select
                value={activeBranch}
                onChange={(e) => switchBranch(e.target.value)}
                className="flex-1 bg-elevated text-primary font-medium text-xs px-2 py-1 rounded-lg border border-border focus:outline-none"
              >
                {availableBranches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {showNewBranchInput && (
              <div className="flex gap-1 mt-1">
                <input
                  type="text"
                  placeholder="what-if/linh-bo-tron..."
                  value={newBranchInput}
                  onChange={(e) => setNewBranchInput(e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-elevated text-primary rounded-lg border border-border"
                />
                <button
                  onClick={() => {
                    if (newBranchInput.trim()) {
                      createWhatIfBranch(newBranchInput);
                      setNewBranchInput('');
                      setShowNewBranchInput(false);
                    }
                  }}
                  className="px-2.5 py-1 text-xs bg-emerald-600 text-white rounded-lg font-semibold"
                >
                  Tạo
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-muted uppercase">
                Điểm Nhớ (Git Snapshots):
              </span>
              <button
                onClick={() => {
                  const label = prompt('Nhập tên điểm nhớ cần lưu:');
                  if (label && label.trim()) {
                    createGitSnapshot(label.trim());
                  }
                }}
                className="text-xs semantic-success-text hover:underline font-bold"
              >
                + Lưu mốc mới
              </button>
            </div>

            <div className="flex flex-col gap-2 mt-1">
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="p-2.5 bg-elevated/60 hover:bg-elevated border border-border rounded-xl flex flex-col gap-1.5 transition-colors"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                    <GitCommit
                      size={14}
                      className="semantic-success-text shrink-0"
                    />
                    <span className="truncate">{snap.label}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted">
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> {snap.timestamp}
                    </span>
                    <span className="semantic-success-text font-mono font-bold">
                      +{snap.word_count_delta} từ
                    </span>
                  </div>
                  <div className="pt-1.5 border-t border-border/60 flex justify-end">
                    <button
                      onClick={() => restoreSnapshot(snap.id)}
                      className="px-2.5 py-1 rounded-lg border semantic-success-box text-[11px] font-semibold transition-opacity hover:opacity-90 flex items-center gap-1"
                    >
                      <RotateCcw size={11} /> Khôi phục mốc này
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. CONTINUITY INSPECTOR VIEW (Zero Low-Contrast Text Across All Themes) */}
      {activeActivity === 'inspector' && (
        <div className="flex flex-col h-full">
          <div
            className="p-3 border-b flex justify-between items-center"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Continuity Inspector
              </span>
              <div className="text-xs font-medium text-muted mt-0.5">
                <span className="semantic-error-text font-bold">
                  {allIssues.filter((i) => i.severity === 'error').length} lỗi
                </span>
                ,{' '}
                <span className="semantic-warning-text font-bold">
                  {allIssues.filter((i) => i.severity === 'warning').length} cảnh
                  báo
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                const targetId =
                  entities.find((e) => e.entity_type === 'character')?.id ||
                  entities[0]?.id;
                if (!targetId) {
                  useWorkspaceStore.setState({
                    ipcNotice:
                      'Chưa có thực thể nào trong project để đổi tên. Hãy thêm nhân vật hoặc địa danh trước.',
                  });
                  return;
                }
                openRefactorModal(targetId);
              }}
              title="Đổi tên toàn cục an toàn (Shift+F6)"
              className="text-xs bg-elevated hover:opacity-90 px-2.5 py-1 rounded-lg text-primary border border-border font-semibold"
            >
              Refactor
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2.5">
            {allIssues.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted">
                Tuyệt vời! Không phát hiện mâu thuẫn cốt truyện nào.
              </div>
            ) : (
              allIssues.map((issue) => (
                <div
                  key={issue.id}
                  className={`p-3 rounded-xl border text-xs flex flex-col gap-2 ${
                    issue.severity === 'error'
                      ? 'semantic-error-box'
                      : 'semantic-warning-box'
                  }`}
                >
                  <div className="flex items-start gap-1.5">
                    {issue.severity === 'error' ? (
                      <XCircle
                        size={15}
                        className="semantic-error-text shrink-0 mt-0.5"
                      />
                    ) : (
                      <AlertTriangle
                        size={15}
                        className="semantic-warning-text shrink-0 mt-0.5"
                      />
                    )}
                    <div className="font-bold text-primary">
                      {issue.chapter_title} (Đoạn {issue.paragraph_index + 1})
                    </div>
                  </div>

                  <p className="text-xs text-primary font-medium leading-relaxed">
                    {issue.message}
                  </p>

                  <div className="pt-2 border-t border-border/60 flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-muted uppercase">
                      Quick Fix (Alt+Enter):
                    </span>
                    {issue.quick_fixes.map((qf) => (
                      <button
                        key={qf.id}
                        onClick={() => {
                          if (qf.action === 'ignore_rule') {
                            ignoreIssue(issue.id);
                          } else if (
                            qf.action === 'revive_entity' &&
                            issue.entity_id
                          ) {
                            useWorkspaceStore
                              .getState()
                              .updateEntity(issue.entity_id, {
                                status: 'alive',
                              });
                          } else if (qf.action === 'mark_flashback') {
                            applyParagraphFix(issue, (text) =>
                              text.toLowerCase().startsWith('[hồi tưởng]')
                                ? text
                                : `[Hồi tưởng] ${text}`
                            );
                          } else if (
                            qf.action === 'replace_synonym' &&
                            qf.replacement
                          ) {
                            const replacement = qf.replacement;
                            applyParagraphFix(issue, (text) =>
                              text.split(issue.matched_text).join(replacement)
                            );
                          }
                        }}
                        className="text-left text-xs font-semibold text-primary hover:underline bg-canvas/80 px-2 py-1 rounded border border-border/70"
                      >
                        {qf.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
