'use client';

import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Compass,
  User,
  Sparkles,
  ChevronDown,
  CheckCircle,
  HelpCircle,
  AlertOctagon,
  Wand2,
} from 'lucide-react';
import { ChapterDocument, LoreEntity } from '@/lib/tauri-bridge';
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
  const { updateChapterMetadata, openTab } = useWorkspaceStore();
  const [collapsed, setCollapsed] = useState(false);

  const characters = entities.filter((e) => e.entity_type === 'character');
  const locations = entities.filter((e) => e.entity_type === 'location');

  const progressPercent = Math.min(
    100,
    Math.round((wordCount / (chapter.target_words || 4000)) * 100)
  );

  return (
    <div
      className="mb-8 p-4 rounded-xl border select-none transition-all"
      style={{
        backgroundColor: 'var(--bg-panel)',
        borderColor: 'var(--border-color)',
      }}
    >
      {/* Title & Collapse Toggle */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase font-bold tracking-wider text-muted">
            Thuộc tính chương (YAML Frontmatter)
          </span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
              chapter.status === 'completed'
                ? 'bg-emerald-500/15 text-emerald-500'
                : chapter.status === 'editing'
                ? 'bg-amber-500/15 text-amber-500'
                : 'bg-blue-500/15 text-blue-500'
            }`}
          >
            {chapter.status === 'completed'
              ? 'Hoàn tất'
              : chapter.status === 'editing'
              ? 'Đang biên tập'
              : 'Bản nháp'}
          </span>
          {chapter.is_flashback && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-semibold">
              Hồi tưởng (Flashback)
            </span>
          )}
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 hover:bg-elevated rounded text-muted hover:text-primary transition-colors text-xs flex items-center gap-1"
        >
          <span>{collapsed ? 'Mở rộng' : 'Thu gọn'}</span>
          <ChevronDown
            size={14}
            className={`transition-transform ${collapsed ? '-rotate-90' : ''}`}
          />
        </button>
      </div>

      {!collapsed && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          {/* POV Selector */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted flex items-center gap-1">
              <User size={13} /> Góc nhìn (POV):
            </span>
            <select
              value={chapter.pov_character_id}
              onChange={(e) => {
                const selected = characters.find((c) => c.id === e.target.value);
                updateChapterMetadata(chapter.id, {
                  pov_character_id: e.target.value,
                  pov_character_name: selected?.title || '',
                });
              }}
              className="bg-elevated border border-border rounded px-2 py-1.5 text-primary text-xs focus:outline-none"
            >
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.aliases[0] || 'Chính'})
                </option>
              ))}
            </select>
          </div>

          {/* Story Date */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted flex items-center gap-1">
              <Calendar size={13} /> Mốc thời gian:
            </span>
            <input
              type="text"
              value={chapter.story_date}
              onChange={(e) =>
                updateChapterMetadata(chapter.id, { story_date: e.target.value })
              }
              className="bg-elevated border border-border rounded px-2 py-1.5 text-primary text-xs focus:outline-none"
              placeholder="VD: 15/10/2026"
            />
          </div>

          {/* Primary Location Tag */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted flex items-center gap-1">
              <Compass size={13} /> Địa điểm chính:
            </span>
            <select
              value={chapter.location_id}
              onChange={(e) => {
                const loc = locations.find((l) => l.id === e.target.value);
                updateChapterMetadata(chapter.id, {
                  location_id: e.target.value,
                  location_tag: `#${loc?.title.replace(/\s+/g, '_') || ''}`,
                });
              }}
              className="bg-elevated border border-border rounded px-2 py-1.5 text-primary text-xs focus:outline-none"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </div>

          {/* Word Count Goal */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center text-[11px]">
              <span className="font-medium text-muted">Tiến trình số từ:</span>
              <span className="font-bold text-accent">
                {wordCount} / {chapter.target_words} từ ({progressPercent}%)
              </span>
            </div>
            <div className="w-full bg-elevated rounded-full h-2 overflow-hidden mt-1">
              <div
                className="bg-accent h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
