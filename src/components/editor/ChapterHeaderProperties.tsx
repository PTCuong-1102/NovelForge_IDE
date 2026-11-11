'use client';

import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Compass,
  User,
  SlidersHorizontal,
  Target,
  Sparkles,
} from 'lucide-react';
import { ChapterDocument, LoreEntity } from '@/lib/tauri-bridge';
import { chapterIdFromFileName } from '@/lib/chapter-file-name';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

interface ChapterHeaderProps {
  chapter: ChapterDocument;
  entities: LoreEntity[];
  wordCount: number;
}

export const ChapterHeaderProperties: React.FC<ChapterHeaderProps> = ({
  chapter,
  entities,
  wordCount,
}) => {
  const { updateChapterMetadata } = useWorkspaceStore();
  const [expanded, setExpanded] = useState(false);
  const [idDraft, setIdDraft] = useState(chapter.id);

  useEffect(() => {
    setIdDraft(chapter.id);
  }, [chapter.id]);

  // Changing the technical id re-points every reference to this chapter.
  const applyIdChange = () => {
    const next = idDraft.trim();
    if (!next || next === chapter.id) return;
    const confirmed = window.confirm(
      `Đổi ID chương từ "${chapter.id}" sang "${next}"?\n\nTab đang mở, đề xuất chỉnh sửa và chỉ mục SQLite sẽ được cập nhật theo.`
    );
    if (!confirmed) return;
    updateChapterMetadata(chapter.id, { id: next });
  };

  const characters = entities.filter((e) => e.entity_type === 'character');
  const locations = entities.filter((e) => e.entity_type === 'location');

  const progressPercent = Math.min(
    100,
    Math.round((wordCount / (chapter.target_words || 4000)) * 100)
  );

  return (
    <div className="mb-6 select-none">
      {/* Compact Notion-style Property Pills Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border/70">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {/* Status Pill */}
          <button
            onClick={() => {
              const nextStatus =
                chapter.status === 'draft'
                  ? 'editing'
                  : chapter.status === 'editing'
                  ? 'completed'
                  : 'draft';
              updateChapterMetadata(chapter.id, { status: nextStatus });
            }}
            className={`px-2.5 py-1 rounded-full font-semibold border transition-colors flex items-center gap-1.5 ${
              chapter.status === 'completed'
                ? 'semantic-success-box'
                : chapter.status === 'editing'
                ? 'semantic-warning-box'
                : 'semantic-info-box'
            }`}
            title="Bấm để chuyển trạng thái chương (Bản nháp -> Đang biên tập -> Hoàn tất)"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            <span>
              {chapter.status === 'completed'
                ? 'Hoàn tất'
                : chapter.status === 'editing'
                ? 'Đang biên tập'
                : 'Bản nháp'}
            </span>
          </button>

          {/* POV Pill */}
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-elevated/80 border border-border text-primary">
            <User size={12} className="text-accent shrink-0" />
            <span className="text-muted">POV:</span>
            <select
              value={chapter.pov_character_id}
              onChange={(e) => {
                const selected = characters.find((c) => c.id === e.target.value);
                updateChapterMetadata(chapter.id, {
                  pov_character_id: e.target.value,
                  pov_character_name: selected?.title || '',
                });
              }}
              className="bg-transparent font-semibold text-primary focus:outline-none cursor-pointer"
            >
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Story Date Pill */}
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-elevated/80 border border-border text-primary">
            <Calendar size={12} className="text-accent shrink-0" />
            <input
              type="text"
              value={chapter.story_date}
              onChange={(e) =>
                updateChapterMetadata(chapter.id, { story_date: e.target.value })
              }
              className="w-20 bg-transparent font-medium text-primary focus:outline-none"
              title="Mốc thời gian cốt truyện"
            />
          </div>

          {/* Location Pill */}
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-elevated/80 border border-border text-primary">
            <Compass size={12} className="semantic-info-text shrink-0" />
            <select
              value={chapter.location_id}
              onChange={(e) => {
                const loc = locations.find((l) => l.id === e.target.value);
                updateChapterMetadata(chapter.id, {
                  location_id: e.target.value,
                  location_tag: `#${loc?.title.replace(/\s+/g, '_') || ''}`,
                });
              }}
              className="bg-transparent font-medium text-primary focus:outline-none cursor-pointer"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  #{l.title}
                </option>
              ))}
            </select>
          </div>

          {chapter.is_flashback && (
            <span className="px-2.5 py-1 rounded-full border semantic-info-box font-semibold flex items-center gap-1">
              <Sparkles size={11} />
              <span>Hồi tưởng</span>
            </span>
          )}
        </div>

        {/* Word Target Progress & Expand YAML Drawer Button */}
        <div className="flex items-center gap-2 text-xs">
          <div
            className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-elevated/80 border border-border"
            title={`Tiến trình: ${wordCount} / ${chapter.target_words} từ`}
          >
            <Target size={12} className="text-accent" />
            <span className="font-semibold text-primary">
              {wordCount.toLocaleString()}{' '}
              <span className="text-muted font-normal">
                / {chapter.target_words.toLocaleString()} từ
              </span>
            </span>
            <div className="w-14 bg-canvas rounded-full h-1.5 overflow-hidden border border-border/60">
              <div
                className="bg-accent h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <button
            onClick={() => setExpanded(!expanded)}
            className={`p-1.5 rounded-lg border transition-colors ${
              expanded
                ? 'bg-elevated border-accent text-primary'
                : 'bg-elevated/60 border-border text-muted hover:text-primary'
            }`}
            title="Cấu hình chi tiết YAML Frontmatter của chương"
          >
            <SlidersHorizontal size={13} />
          </button>
        </div>
      </div>

      {/* Collapsible Full YAML Metadata Drawer */}
      {expanded && (
        <div
          className="mt-3 p-3.5 rounded-xl border grid grid-cols-1 md:grid-cols-3 gap-3 text-xs animate-in fade-in duration-150"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-muted">
              Mục tiêu số từ chương (target_words):
            </label>
            <input
              type="number"
              step={500}
              value={chapter.target_words}
              onChange={(e) =>
                updateChapterMetadata(chapter.id, {
                  target_words: Math.max(500, Number(e.target.value) || 3000),
                })
              }
              className="bg-canvas border border-border rounded-lg px-2.5 py-1.5 text-primary font-mono focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-muted">
              Đường dẫn tệp Markdown:
            </label>
            <input
              type="text"
              disabled
              value={chapter.file_path}
              className="bg-canvas/60 border border-border rounded-lg px-2.5 py-1.5 text-muted font-mono"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-muted">
              ID kỹ thuật của chương (dùng cho tab, đề xuất, SQLite):
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={idDraft}
                onChange={(e) => setIdDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyIdChange();
                }}
                className="flex-1 bg-canvas border border-border rounded-lg px-2.5 py-1.5 text-primary font-mono focus:outline-none focus:border-accent"
              />
              <button
                onClick={applyIdChange}
                disabled={!idDraft.trim() || idDraft.trim() === chapter.id}
                className="px-2.5 py-1.5 rounded-lg border border-border bg-canvas text-[11px] font-semibold text-primary disabled:opacity-40"
              >
                Đổi ID
              </button>
              <button
                onClick={() => {
                  const fromName = chapterIdFromFileName(
                    chapter.file_path.split('/').pop() ?? chapter.file_path
                  );
                  if (fromName) setIdDraft(fromName);
                }}
                disabled={
                  !chapterIdFromFileName(
                    chapter.file_path.split('/').pop() ?? chapter.file_path
                  )
                }
                title="Lấy ID kỹ thuật từ tên tệp hiện tại"
                className="px-2.5 py-1.5 rounded-lg border border-border bg-canvas text-[11px] font-semibold text-primary disabled:opacity-40"
              >
                Lấy ID từ tên tệp
              </button>
            </div>
            <p className="text-[10px] text-muted leading-snug">
              Tên tệp Markdown theo quy ước{' '}
              <code className="font-mono">&lt;id&gt;-&lt;slug tiêu đề&gt;.md</code> —
              đổi ID sẽ đổi luôn tên tệp.
            </p>
          </div>

          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer text-primary font-medium">
              <input
                type="checkbox"
                checked={chapter.is_flashback}
                onChange={(e) =>
                  updateChapterMetadata(chapter.id, {
                    is_flashback: e.target.checked,
                  })
                }
                className="accent-emerald-600 rounded w-3.5 h-3.5"
              />
              <span>Đánh dấu toàn chương là Hồi tưởng (Flashback)</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
