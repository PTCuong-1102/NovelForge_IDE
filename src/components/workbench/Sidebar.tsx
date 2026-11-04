'use client';

import React, { useState } from 'react';
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
  Eye,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useEditorStore } from '@/stores/useEditorStore';
import {
  countVietnameseAndLatinWords,
  runContinuityLinterEngine,
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
  } = useWorkspaceStore();

  const {
    openFindUsages,
    openRefactorModal,
    ignoreIssue,
    ignoredIssueIds,
    setActiveChapterId,
    setFocusedParagraphIndex,
  } = useEditorStore();

  const [expandedActs, setExpandedActs] = useState<Record<string, boolean>>({
    act_01: true,
  });
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
    setExpandedActs((prev) => ({ ...prev, [actId]: !prev[actId] }));
  };

  const toggleLoreGroup = (type: string) => {
    setExpandedLoreTypes((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  // Compile linter issues across all chapters
  const allIssues = chapters.flatMap((ch) =>
    runContinuityLinterEngine(ch, entities, ignoredIssueIds)
  );

  return (
    <div
      className="w-64 h-full flex flex-col select-none border-r text-sm"
      style={{
        backgroundColor: 'var(--bg-panel)',
        borderColor: 'var(--border-color)',
      }}
    >
      {/* 1. EXPLORER VIEW */}
      {activeActivity === 'explorer' && (
        <div className="flex flex-col h-full">
          <div className="p-3 border-b flex justify-between items-center" style={{ borderColor: 'var(--border-color)' }}>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Bản Thảo (Manuscript)
            </span>
            <button
              onClick={() => createChapter('')}
              title="Thêm chương mới"
              className="p-1 hover:bg-elevated rounded text-muted hover:text-primary transition-colors"
            >
              <Plus size={15} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {/* Act group */}
            <div className="mb-2">
              <div
                onClick={() => toggleAct('act_01')}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer hover:bg-elevated text-xs font-semibold text-primary"
              >
                {expandedActs['act_01'] ? (
                  <ChevronDown size={14} className="text-muted" />
                ) : (
                  <ChevronRight size={14} className="text-muted" />
                )}
                {expandedActs['act_01'] ? (
                  <FolderOpen size={15} className="text-amber-500" />
                ) : (
                  <Folder size={15} className="text-amber-500" />
                )}
                <span>Hồi 1: Tín Hiệu Từ Đáy Biển</span>
              </div>

              {expandedActs['act_01'] && (
                <div className="ml-4 pl-2 border-l border-border/50 flex flex-col gap-0.5 mt-1">
                  {chapters.map((ch) => {
                    const words = countVietnameseAndLatinWords(
                      ch.paragraphs.join(' ')
                    );
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
                        className="group flex items-center justify-between px-2 py-1.5 rounded cursor-pointer hover:bg-elevated transition-colors"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <FileText size={14} className="text-muted shrink-0" />
                          <span className="truncate text-xs text-primary font-medium">
                            {ch.title}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted ml-2 shrink-0">
                          {words} từ
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Lorebook database link */}
            <div className="pt-2 border-t mt-4" style={{ borderColor: 'var(--border-color)' }}>
              <div
                onClick={() =>
                  openTab({
                    id: 'tab-lore-db',
                    title: 'Lorebook Database',
                    type: 'lore-database',
                    targetId: 'lore-all',
                  })
                }
                className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-elevated text-xs font-medium text-emerald-500"
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
          <div className="p-3 border-b flex justify-between items-center" style={{ borderColor: 'var(--border-color)' }}>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
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
                className="px-1.5 py-0.5 text-[10px] bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded font-medium"
              >
                Graph
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {/* Characters */}
            <div className="mb-3">
              <div
                onClick={() => toggleLoreGroup('character')}
                className="flex items-center justify-between px-2 py-1 rounded cursor-pointer hover:bg-elevated text-xs font-semibold text-primary"
              >
                <div className="flex items-center gap-1.5">
                  {expandedLoreTypes['character'] ? (
                    <ChevronDown size={13} className="text-muted" />
                  ) : (
                    <ChevronRight size={13} className="text-muted" />
                  )}
                  <User size={14} className="text-emerald-500" />
                  <span>Nhân vật ({entities.filter((e) => e.entity_type === 'character').length})</span>
                </div>
              </div>

              {expandedLoreTypes['character'] && (
                <div className="ml-4 pl-2 border-l border-border/50 flex flex-col gap-0.5 mt-1">
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
                        className="group flex items-center justify-between px-2 py-1 rounded cursor-pointer hover:bg-elevated text-xs text-primary"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              char.status === 'dead' ? 'bg-red-500' : 'bg-emerald-500'
                            }`}
                          />
                          <span className="truncate">{char.title}</span>
                        </div>
                        {char.status === 'dead' && (
                          <span className="text-[9px] text-red-400 bg-red-500/10 px-1 rounded">
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
                className="flex items-center justify-between px-2 py-1 rounded cursor-pointer hover:bg-elevated text-xs font-semibold text-primary"
              >
                <div className="flex items-center gap-1.5">
                  {expandedLoreTypes['location'] ? (
                    <ChevronDown size={13} className="text-muted" />
                  ) : (
                    <ChevronRight size={13} className="text-muted" />
                  )}
                  <MapPin size={14} className="text-blue-500" />
                  <span>Địa danh ({entities.filter((e) => e.entity_type === 'location').length})</span>
                </div>
              </div>

              {expandedLoreTypes['location'] && (
                <div className="ml-4 pl-2 border-l border-border/50 flex flex-col gap-0.5 mt-1">
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
                        className="flex items-center justify-between px-2 py-1 rounded cursor-pointer hover:bg-elevated text-xs text-primary"
                      >
                        <span className="truncate">{loc.title}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Items */}
            <div className="mb-3">
              <div
                onClick={() => toggleLoreGroup('item')}
                className="flex items-center justify-between px-2 py-1 rounded cursor-pointer hover:bg-elevated text-xs font-semibold text-primary"
              >
                <div className="flex items-center gap-1.5">
                  {expandedLoreTypes['item'] ? (
                    <ChevronDown size={13} className="text-muted" />
                  ) : (
                    <ChevronRight size={13} className="text-muted" />
                  )}
                  <Sparkles size={14} className="text-purple-500" />
                  <span>Vật phẩm ({entities.filter((e) => e.entity_type === 'item').length})</span>
                </div>
              </div>

              {expandedLoreTypes['item'] && (
                <div className="ml-4 pl-2 border-l border-border/50 flex flex-col gap-0.5 mt-1">
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
                        className="flex items-center justify-between px-2 py-1 rounded cursor-pointer hover:bg-elevated text-xs text-primary"
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
          <div className="p-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Tra Cứu Toàn Cục (Ctrl+Shift+F)
            </span>
            <div className="mt-2">
              <input
                type="text"
                placeholder="Tìm từ khóa hoặc tên nhân vật..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-2 py-1.5 bg-elevated rounded border border-border text-xs focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            <div className="mb-3">
              <span className="text-[11px] font-semibold text-muted uppercase">
                Tra cứu xuất hiện nhanh:
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {entities.slice(0, 4).map((e) => (
                  <button
                    key={e.id}
                    onClick={() => {
                      setSearchQuery(e.title);
                      openFindUsages(e.id);
                    }}
                    className="px-2 py-0.5 bg-elevated hover:bg-elevated/80 rounded text-[11px] text-primary transition-colors"
                  >
                    {e.title}
                  </button>
                ))}
              </div>
            </div>

            {searchQuery && (
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-medium text-muted">
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
                      className="p-2 bg-elevated/40 rounded border border-border/50 text-xs"
                    >
                      <div className="font-semibold text-primary mb-1">
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
                          className="p-1 hover:bg-elevated rounded cursor-pointer text-muted hover:text-primary truncate"
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
          <div className="p-3 border-b flex flex-col gap-2" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Dòng Thời Gian & Nhánh Cốt Truyện
              </span>
              <button
                onClick={() => setShowNewBranchInput(!showNewBranchInput)}
                title="Tạo nhánh cốt truyện thử nghiệm (What-If Timeline)"
                className="p-1 hover:bg-elevated rounded text-muted hover:text-primary transition-colors"
              >
                <Plus size={15} />
              </button>
            </div>

            {/* Branch selector */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted">Nhánh:</span>
              <select
                value={activeBranch}
                onChange={(e) => switchBranch(e.target.value)}
                className="bg-elevated text-primary text-xs px-2 py-1 rounded border border-border focus:outline-none"
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
                  className="w-full px-2 py-1 text-xs bg-elevated rounded border border-border"
                />
                <button
                  onClick={() => {
                    if (newBranchInput.trim()) {
                      createWhatIfBranch(newBranchInput);
                      setNewBranchInput('');
                      setShowNewBranchInput(false);
                    }
                  }}
                  className="px-2 py-1 text-xs bg-emerald-600 text-white rounded font-medium"
                >
                  Tạo
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-muted uppercase">
                Điểm Nhớ (Git Snapshots):
              </span>
              <button
                onClick={() => {
                  const label = prompt('Nhập tên điểm nhớ cần lưu:');
                  if (label && label.trim()) {
                    createGitSnapshot(label.trim());
                  }
                }}
                className="text-[10px] text-accent hover:underline font-semibold"
              >
                + Lưu mốc mới
              </button>
            </div>

            <div className="flex flex-col gap-2 mt-1">
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="p-2.5 bg-elevated/40 hover:bg-elevated/70 border border-border/60 rounded-xl flex flex-col gap-1.5 transition-colors"
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <GitCommit size={14} className="text-emerald-500 shrink-0" />
                    <span className="truncate">{snap.label}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted">
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> {snap.timestamp}
                    </span>
                    <span className="text-emerald-400 font-mono">
                      +{snap.word_count_delta} từ
                    </span>
                  </div>
                  <div className="pt-1 border-t border-border/40 flex justify-end">
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Bạn có chắc chắn muốn khôi phục toàn bộ bản thảo về điểm nhớ "${snap.label}"?`
                          )
                        ) {
                          restoreSnapshot(snap.id);
                        }
                      }}
                      className="px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold transition-colors flex items-center gap-1"
                    >
                      <RotateCcw size={10} /> Khôi phục mốc này
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. CONTINUITY INSPECTOR VIEW */}
      {activeActivity === 'inspector' && (
        <div className="flex flex-col h-full">
          <div className="p-3 border-b flex justify-between items-center" style={{ borderColor: 'var(--border-color)' }}>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Continuity Inspector
              </span>
              <div className="text-[11px] text-muted">
                {allIssues.filter((i) => i.severity === 'error').length} lỗi,{' '}
                {allIssues.filter((i) => i.severity === 'warning').length} cảnh báo
              </div>
            </div>
            <button
              onClick={() => openRefactorModal('char_hao_002')}
              title="Đổi tên toàn cục an toàn (Shift+F6)"
              className="text-[10px] bg-elevated hover:bg-elevated/80 px-2 py-1 rounded text-primary border border-border font-medium"
            >
              Refactor
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
            {allIssues.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted">
                Tuyệt vời! Không phát hiện mâu thuẫn cốt truyện nào.
              </div>
            ) : (
              allIssues.map((issue) => (
                <div
                  key={issue.id}
                  className={`p-2.5 rounded border text-xs flex flex-col gap-1.5 ${
                    issue.severity === 'error'
                      ? 'bg-red-500/10 border-red-500/30 text-red-200'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  }`}
                >
                  <div className="flex items-start gap-1.5">
                    {issue.severity === 'error' ? (
                      <XCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <div className="font-semibold text-primary">
                      {issue.chapter_title} (Đoạn {issue.paragraph_index + 1})
                    </div>
                  </div>

                  <p className="text-[11px] text-primary/90 leading-relaxed">
                    {issue.message}
                  </p>

                  <div className="pt-1.5 border-t border-border/40 flex flex-col gap-1">
                    <span className="text-[10px] font-semibold text-muted">
                      Quick Fix (Alt+Enter):
                    </span>
                    {issue.quick_fixes.map((qf) => (
                      <button
                        key={qf.id}
                        onClick={() => {
                          if (qf.action === 'ignore_rule') {
                            ignoreIssue(issue.id);
                          } else if (qf.action === 'revive_entity' && issue.entity_id) {
                            useWorkspaceStore.getState().updateEntity(issue.entity_id, {
                              status: 'alive',
                            });
                          }
                        }}
                        className="text-left text-[11px] text-accent hover:underline"
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
