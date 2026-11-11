'use client';

import React, { useState } from 'react';
import {
  Table,
  LayoutGrid,
  Search,
  Plus,
  ExternalLink,
  User,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { LoreEntity } from '@/lib/tauri-bridge';
import { titleSlug } from '@/lib/chapter-file-name';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

export const LoreDatabaseView: React.FC = () => {
  const { entities, openTab, createEntity } = useWorkspaceStore();
  const [viewMode, setViewMode] = useState<'table' | 'gallery'>('table');
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filtered = entities.filter((e) => {
    const matchType = filterType === 'all' || e.entity_type === filterType;
    const matchSearch =
      !search ||
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.summary.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div
      className="flex-1 h-full overflow-y-auto p-6 flex flex-col select-text"
      style={{ backgroundColor: 'var(--bg-canvas)' }}
    >
      <div className="w-full max-w-[1100px] mx-auto flex flex-col gap-5">
        {/* Top Control Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary tracking-tight">
              Cơ Sở Dữ Liệu Thế Giới Quan (Lorebook)
            </h1>
            <p className="text-xs text-muted mt-0.5">
              Quản lý toàn bộ nhân vật, địa danh, thần binh và dòng thời gian
              theo chuẩn Notion Database.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {/* View switcher */}
            <div className="flex bg-elevated rounded-lg p-0.5 border border-border">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
                  viewMode === 'table'
                    ? 'bg-paper text-primary font-semibold shadow-sm'
                    : 'text-muted hover:text-primary'
                }`}
              >
                <Table size={13} />
                <span>Bảng dữ liệu</span>
              </button>
              <button
                onClick={() => setViewMode('gallery')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
                  viewMode === 'gallery'
                    ? 'bg-paper text-primary font-semibold shadow-sm'
                    : 'text-muted hover:text-primary'
                }`}
              >
                <LayoutGrid size={13} />
                <span>Thẻ Gallery</span>
              </button>
            </div>

            <button
              onClick={() => {
                const newId = `char_new_${Date.now()}`;
                const existingPaths = new Set(entities.map((e) => e.file_path));
                let seq = entities.filter((e) => e.entity_type === 'character').length + 1;
                let newTitle = `Nhân Vật Mới ${seq}`;
                let filePath = `lorebook/characters/${titleSlug(newTitle)}.md`;
                while (existingPaths.has(filePath)) {
                  seq += 1;
                  newTitle = `Nhân Vật Mới ${seq}`;
                  filePath = `lorebook/characters/${titleSlug(newTitle)}.md`;
                }
                const newEnt: LoreEntity = {
                  id: newId,
                  entity_type: 'character',
                  title: newTitle,
                  aliases: [],
                  file_path: filePath,
                  status: 'alive',
                  tags: ['nhân vật mới'],
                  summary: 'Mô tả tóm tắt nhân vật mới...',
                  body: '# Hồ sơ nhân vật mới\n\nNội dung chi tiết...',
                  updated_at: new Date().toISOString(),
                };
                createEntity(newEnt);
                openTab({
                  id: `tab-char-${newId}`,
                  title: newEnt.title,
                  type: 'lore-entity',
                  targetId: newId,
                });
              }}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold flex items-center gap-1 transition-colors shadow-sm"
            >
              <Plus size={14} />
              <span>Thêm thực thể</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            {['all', 'character', 'location', 'item'].map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1 rounded-lg border font-semibold transition-colors ${
                  filterType === t
                    ? 'semantic-success-box'
                    : 'border-border bg-elevated text-muted hover:text-primary'
                }`}
              >
                {t === 'all'
                  ? 'Tất cả'
                  : t === 'character'
                  ? 'Nhân vật'
                  : t === 'location'
                  ? 'Địa danh'
                  : 'Vật phẩm'}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              placeholder="Lọc thực thể..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-elevated rounded-lg border border-border text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* View Mode: Table (Notion Database Table) */}
        {viewMode === 'table' ? (
          <div
            className="rounded-2xl border overflow-hidden shadow-sm"
            style={{
              backgroundColor: 'var(--bg-paper)',
              borderColor: 'var(--border-color)',
            }}
          >
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b bg-elevated text-muted font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Tên thực thể</th>
                  <th className="py-3 px-4">Phân loại</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4">Biệt danh / Aliases</th>
                  <th className="py-3 px-4">Tổ chức / Phe phái</th>
                  <th className="py-3 px-4 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtered.map((e) => (
                  <tr
                    key={e.id}
                    onClick={() =>
                      openTab({
                        id: `tab-char-${e.id}`,
                        title: e.title,
                        type: 'lore-entity',
                        targetId: e.id,
                      })
                    }
                    className="hover:bg-elevated/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-primary flex items-center gap-2">
                      {e.entity_type === 'character' ? (
                        <User size={14} className="semantic-success-text" />
                      ) : e.entity_type === 'location' ? (
                        <MapPin size={14} className="semantic-info-text" />
                      ) : (
                        <Sparkles size={14} className="semantic-warning-text" />
                      )}
                      <span>{e.title}</span>
                    </td>
                    <td className="py-3 px-4 text-muted font-medium capitalize">
                      {e.entity_type}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${
                          e.status === 'dead'
                            ? 'semantic-error-box'
                            : 'semantic-success-box'
                        }`}
                      >
                        {e.status === 'dead'
                          ? 'Tử vong'
                          : 'Còn sống / Hoạt động'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted">
                      {e.aliases && e.aliases.length > 0
                        ? e.aliases.join(', ')
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-muted font-medium">
                      {e.faction || '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-accent hover:underline flex items-center justify-end gap-1 font-semibold">
                        Mở hồ sơ <ExternalLink size={12} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* View Mode: Gallery Cards */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filtered.map((e) => (
              <div
                key={e.id}
                onClick={() =>
                  openTab({
                    id: `tab-char-${e.id}`,
                    title: e.title,
                    type: 'lore-entity',
                    targetId: e.id,
                  })
                }
                className="p-4 rounded-2xl border border-border hover:border-accent cursor-pointer transition-all hover:shadow-md flex flex-col justify-between gap-3 text-xs"
                style={{ backgroundColor: 'var(--bg-paper)' }}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
                      {e.title}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${
                        e.status === 'dead'
                          ? 'semantic-error-box'
                          : 'semantic-success-box'
                      }`}
                    >
                      {e.status === 'dead' ? 'Tử vong' : 'Còn sống'}
                    </span>
                  </div>

                  <p className="text-xs text-muted line-clamp-2 mt-2 leading-relaxed">
                    {e.summary}
                  </p>
                </div>

                <div className="pt-2.5 border-t border-border/60 flex items-center justify-between text-xs text-muted">
                  <span className="font-medium">
                    {e.faction || 'Vùng tự do'}
                  </span>
                  <span className="text-accent font-semibold flex items-center gap-1">
                    Chi tiết <ExternalLink size={11} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
