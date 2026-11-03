'use client';

import React, { useState } from 'react';
import {
  Share2,
  Clock,
  Info,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronRight,
} from 'lucide-react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

export const RelationshipGraph: React.FC = () => {
  const { entities, relations, openTab } = useWorkspaceStore();
  const [chapterFilter, setChapterFilter] = useState(8);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    'char_linh_001'
  );

  const characters = entities.filter((e) => e.entity_type === 'character');
  const selectedEntity = characters.find((c) => c.id === selectedNodeId);

  // Active relations for the given chapter timeline position
  const activeRelations = relations.filter(
    (r) =>
      r.min_chapter <= chapterFilter &&
      (!r.max_chapter || r.max_chapter >= chapterFilter)
  );

  return (
    <div
      className="flex-1 h-full flex flex-col select-none overflow-hidden"
      style={{ backgroundColor: 'var(--bg-canvas)' }}
    >
      {/* Top Controls Bar */}
      <div
        className="p-3 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-xs"
        style={{
          backgroundColor: 'var(--bg-panel)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="flex items-center gap-2">
          <Share2 size={16} className="text-purple-400" />
          <span className="font-bold text-primary">
            Sơ Đồ Mối Quan Hệ Nhân Vật Theo Tiến Trình Cốt Truyện
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/15 text-purple-400 font-semibold">
            React Flow Canvas
          </span>
        </div>

        {/* Timeline Slider */}
        <div className="flex items-center gap-3 bg-elevated px-3 py-1.5 rounded-xl border border-border">
          <Clock size={13} className="text-muted" />
          <span className="text-muted font-medium">Trục thời gian:</span>
          <span className="font-bold text-accent">Chương {chapterFilter}</span>
          <input
            type="range"
            min={1}
            max={20}
            value={chapterFilter}
            onChange={(e) => setChapterFilter(Number(e.target.value))}
            className="w-32 accent-emerald-500 cursor-pointer"
          />
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 relative flex">
        {/* Node Canvas Simulator */}
        <div className="flex-1 relative p-8 flex items-center justify-center overflow-auto bg-[radial-gradient(#262B36_1px,transparent_1px)] [background-size:16px_16px]">
          {/* Circular Graph Layout */}
          <div className="relative w-[500px] h-[500px] rounded-full border border-dashed border-border/60 flex items-center justify-center">
            {/* Center Node (Lâm Vũ Linh) */}
            <div
              onClick={() => setSelectedNodeId('char_linh_001')}
              className={`absolute cursor-pointer p-4 rounded-2xl shadow-xl border-2 flex flex-col items-center gap-1 transition-all ${
                selectedNodeId === 'char_linh_001'
                  ? 'border-emerald-500 scale-110 shadow-emerald-500/20'
                  : 'border-border/80 hover:border-emerald-400'
              }`}
              style={{ backgroundColor: 'var(--bg-elevated)' }}
            >
              <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm">
                LVL
              </div>
              <span className="font-bold text-xs text-primary">Lâm Vũ Linh</span>
              <span className="text-[9px] text-muted">Protagonist</span>
            </div>

            {/* Surrounding Nodes */}
            {characters
              .filter((c) => c.id !== 'char_linh_001')
              .map((char, idx) => {
                const angle = (idx * (360 / (characters.length - 1)) * Math.PI) / 180;
                const radius = 190;
                const left = 250 + radius * Math.cos(angle) - 55;
                const top = 250 + radius * Math.sin(angle) - 45;

                const isSelected = selectedNodeId === char.id;

                return (
                  <div
                    key={char.id}
                    onClick={() => setSelectedNodeId(char.id)}
                    className={`absolute cursor-pointer p-3 rounded-xl shadow-lg border-2 flex flex-col items-center gap-1 transition-all w-28 ${
                      isSelected
                        ? 'border-accent scale-110 shadow-accent/20'
                        : 'border-border hover:border-muted'
                    }`}
                    style={{
                      left: `${left}px`,
                      top: `${top}px`,
                      backgroundColor: 'var(--bg-elevated)',
                    }}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white ${
                        char.status === 'dead' ? 'bg-red-500' : 'bg-blue-500'
                      }`}
                    >
                      {char.title.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-semibold text-[11px] text-primary truncate max-w-[90px]">
                      {char.title}
                    </span>
                    <span
                      className={`text-[9px] px-1 rounded ${
                        char.status === 'dead'
                          ? 'bg-red-500/15 text-red-400'
                          : 'bg-emerald-500/15 text-emerald-400'
                      }`}
                    >
                      {char.status === 'dead' ? 'Đã chết' : 'Còn sống'}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Right Info Drawer for Selected Character */}
        {selectedEntity && (
          <div
            className="w-80 h-full border-l p-4 flex flex-col justify-between text-xs select-text overflow-y-auto"
            style={{
              backgroundColor: 'var(--bg-panel)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  Thông Tin Liên Kết
                </span>
                <button
                  onClick={() =>
                    openTab({
                      id: `tab-char-${selectedEntity.id}`,
                      title: selectedEntity.title,
                      type: 'lore-entity',
                      targetId: selectedEntity.id,
                    })
                  }
                  className="text-accent hover:underline flex items-center gap-1 font-semibold"
                >
                  Mở hồ sơ <ChevronRight size={12} />
                </button>
              </div>

              <h2 className="text-base font-bold text-primary">
                {selectedEntity.title}
              </h2>
              <div className="text-muted text-[11px] mt-0.5">
                {selectedEntity.role}
              </div>

              <div className="space-y-2 mt-4 text-[11px] text-muted">
                <div>
                  <strong className="text-primary">Trạng thái tại Ch.{chapterFilter}:</strong>{' '}
                  <span
                    className={
                      selectedEntity.status === 'dead'
                        ? 'text-red-400 font-semibold'
                        : 'text-emerald-400 font-semibold'
                    }
                  >
                    {selectedEntity.status === 'dead' ? 'Đã tử vong' : 'Còn sống'}
                  </span>
                </div>
                <div>
                  <strong className="text-primary">Ngoại hình:</strong>{' '}
                  {selectedEntity.appearance}
                </div>
                <div>
                  <strong className="text-primary">Tổ chức:</strong>{' '}
                  {selectedEntity.faction}
                </div>
              </div>

              {/* Active Relations */}
              <div className="mt-5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-2">
                  Các Mối Quan Hệ (Tại Chương {chapterFilter}):
                </span>
                <div className="space-y-2">
                  {activeRelations
                    .filter(
                      (r) =>
                        r.source_id === selectedEntity.id ||
                        r.target_id === selectedEntity.id
                    )
                    .map((rel) => {
                      const otherId =
                        rel.source_id === selectedEntity.id
                          ? rel.target_id
                          : rel.source_id;
                      const other = characters.find((c) => c.id === otherId);

                      return (
                        <div
                          key={rel.id}
                          className="p-2 rounded-lg bg-elevated/60 border border-border flex items-center justify-between"
                        >
                          <span className="font-semibold text-primary">
                            {other?.title || 'Ẩn'}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              rel.relation_type === 'enemy'
                                ? 'bg-red-500/15 text-red-400'
                                : rel.relation_type === 'mentor'
                                ? 'bg-purple-500/15 text-purple-400'
                                : rel.relation_type === 'betrayal'
                                ? 'bg-amber-500/15 text-amber-400'
                                : 'bg-emerald-500/15 text-emerald-400'
                            }`}
                          >
                            {rel.label}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            <div className="p-2 rounded bg-elevated/40 text-[10px] text-muted leading-relaxed">
              Kéo thanh trượt thời gian để quan sát sự thay đổi đồng minh, phản bội và sinh tử qua từng hồi truyện.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
