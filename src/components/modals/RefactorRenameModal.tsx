'use client';

import React, { useState } from 'react';
import {
  Edit3,
  Check,
  X,
  CheckSquare,
  Square,
} from 'lucide-react';
import { useEditorStore } from '@/stores/useEditorStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { buildRefactorRenamePreview } from '@/lib/tauri-bridge';

export const RefactorRenameModal: React.FC = () => {
  const { refactorModalOpen, refactorEntityId, closeRefactorModal } =
    useEditorStore();
  const { entities, chapters, applyRefactorRename } = useWorkspaceStore();

  const targetEntity = entities.find((e) => e.id === refactorEntityId);

  const [newName, setNewName] = useState(
    targetEntity ? `${targetEntity.title} (Mới)` : 'Lâm Hạ Vy'
  );
  const [aliasPairs, setAliasPairs] = useState<{ from: string; to: string }[]>([
    { from: 'Tiểu Linh', to: 'Tiểu Vy' },
    { from: 'Đặc vụ số 7', to: 'Đặc vụ số 9' },
  ]);

  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(
    new Set()
  );

  if (!refactorModalOpen || !targetEntity) return null;

  // Build project-wide matches
  const previewMatches = buildRefactorRenamePreview(
    chapters,
    targetEntity.title,
    newName,
    aliasPairs
  );

  const toggleSelectMatch = (id: string) => {
    setSelectedMatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedMatchIds(new Set(previewMatches.map((m) => m.id)));
  };

  const handleApply = () => {
    const updatedAliases = aliasPairs.map((a) => a.to);
    applyRefactorRename(
      targetEntity.id,
      newName,
      updatedAliases,
      selectedMatchIds.size > 0
        ? selectedMatchIds
        : new Set(previewMatches.map((m) => m.id)),
      aliasPairs
    );
    closeRefactorModal();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in select-none text-xs"
      onClick={closeRefactorModal}
    >
      <div
        className="w-full max-w-[700px] max-h-[85vh] rounded-2xl border shadow-2xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: 'var(--bg-panel)',
          borderColor: 'var(--border-color)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="p-4 border-b flex justify-between items-center"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-2">
            <Edit3 size={18} className="text-accent" />
            <span className="font-bold text-sm text-primary">
              Smart Literary Refactor: Đổi Tên Toàn Dự Án
            </span>
          </div>
          <button
            onClick={closeRefactorModal}
            className="p-1 text-muted hover:text-primary rounded hover:bg-elevated"
          >
            <X size={15} />
          </button>
        </div>

        {/* Input Form */}
        <div
          className="p-4 border-b space-y-3"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted block mb-1">
                Tên nhân vật hiện tại:
              </label>
              <input
                type="text"
                disabled
                value={targetEntity.title}
                className="w-full bg-elevated/60 border border-border rounded-lg px-2.5 py-1.5 text-muted font-medium"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-accent block mb-1">
                Tên nhân vật mới:
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-elevated border border-accent rounded-lg px-2.5 py-1.5 text-primary font-bold focus:outline-none"
              />
            </div>
          </div>

          {/* Alias updates */}
          <div>
            <span className="text-[11px] font-semibold text-muted block mb-1">
              Đồng bộ biệt danh liên quan:
            </span>
            <div className="space-y-1.5">
              {aliasPairs.map((pair, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    disabled
                    value={pair.from}
                    className="w-1/2 bg-elevated/60 border border-border rounded-lg px-2 py-1 text-muted"
                  />
                  <span className="text-muted font-bold">→</span>
                  <input
                    type="text"
                    value={pair.to}
                    onChange={(e) => {
                      const updated = [...aliasPairs];
                      updated[idx].to = e.target.value;
                      setAliasPairs(updated);
                    }}
                    className="w-1/2 bg-elevated border border-border rounded-lg px-2 py-1 text-primary font-medium focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Diff Preview Matches (High-Contrast Adaptive Tokens) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 select-text">
          <div className="flex justify-between items-center text-xs mb-2">
            <span className="font-bold text-primary">
              Tìm thấy {previewMatches.length} vị trí xuất hiện trong{' '}
              {chapters.length} chương:
            </span>
            <button
              onClick={selectAll}
              className="text-accent hover:underline font-semibold"
            >
              Chọn tất cả
            </button>
          </div>

          {previewMatches.map((m) => {
            const isChecked =
              selectedMatchIds.size === 0 || selectedMatchIds.has(m.id);
            return (
              <div
                key={m.id}
                onClick={() => toggleSelectMatch(m.id)}
                className="p-3 rounded-xl border border-border bg-elevated/50 hover:bg-elevated cursor-pointer transition-colors space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-primary">
                    {isChecked ? (
                      <CheckSquare size={14} className="text-accent" />
                    ) : (
                      <Square size={14} className="text-muted" />
                    )}
                    <span>
                      {m.chapter_title} (Đoạn {m.paragraph_index + 1})
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-muted">
                    &ldquo;{m.matched_token}&rdquo; → &ldquo;
                    {m.replacement_token}&rdquo;
                  </span>
                </div>

                <div className="p-2 rounded-lg border semantic-error-box text-xs font-serif leading-relaxed line-through">
                  {m.original_sentence}
                </div>
                <div className="p-2 rounded-lg border semantic-success-box text-xs font-serif leading-relaxed font-medium">
                  {m.preview_sentence}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div
          className="p-3 border-t flex justify-end gap-2"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <button
            onClick={closeRefactorModal}
            className="px-3 py-1.5 rounded-lg bg-elevated hover:opacity-90 border border-border text-primary transition-colors font-semibold"
          >
            Hủy bỏ
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors flex items-center gap-1.5 shadow-md"
          >
            <Check size={14} />
            <span>Refactor Toàn Dự Án</span>
          </button>
        </div>
      </div>
    </div>
  );
};
