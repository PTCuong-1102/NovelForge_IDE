'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  FileText,
  User,
  Sparkles,
  Columns,
  Share2,
  Table,
  UploadCloud,
  Maximize2,
  GitBranch,
} from 'lucide-react';
import { useEditorStore } from '@/stores/useEditorStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

export const CommandPalette: React.FC = () => {
  const {
    commandPaletteOpen,
    commandPaletteMode,
    closeCommandPalette,
    openRefactorModal,
    setPublishModalOpen,
  } = useEditorStore();

  const {
    chapters,
    entities,
    openTab,
    toggleSplitView,
    toggleZenMode,
    createGitSnapshot,
  } = useWorkspaceStore();

  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && commandPaletteOpen) {
        closeCommandPalette();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, closeCommandPalette]);

  if (!commandPaletteOpen) return null;

  // Filter items based on mode
  const chapterMatches = chapters.filter(
    (c) =>
      !query ||
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      c.pov_character_name.toLowerCase().includes(query.toLowerCase())
  );

  const entityMatches = entities.filter(
    (e) =>
      !query ||
      e.title.toLowerCase().includes(query.toLowerCase()) ||
      e.aliases.some((a) => a.toLowerCase().includes(query.toLowerCase()))
  );

  const commands = [
    {
      id: 'cmd-refactor',
      label: 'Refactor Rename: Đổi tên nhân vật/địa danh toàn dự án',
      shortcut: 'Shift+F6',
      action: () => {
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
      },
    },
    {
      id: 'cmd-split',
      label: 'View: Chia đôi màn hình song song',
      shortcut: 'Ctrl+\\',
      action: () => toggleSplitView(),
    },
    {
      id: 'cmd-zen',
      label: 'View: Bật/Tắt chế độ Zen Focus Mode',
      shortcut: 'Ctrl+Shift+Z',
      action: () => toggleZenMode(),
    },
    {
      id: 'cmd-snapshot',
      label: 'Git: Tạo điểm nhớ (Snapshot) cốt truyện tức thì',
      shortcut: 'Ctrl+Shift+S',
      action: () => createGitSnapshot('Điểm nhớ thủ công từ Command Palette'),
    },
    {
      id: 'cmd-publish',
      label: 'Publish: Xuất bản sách điện tử (EPUB, DOCX, PDF)',
      shortcut: 'Ctrl+E',
      action: () => setPublishModalOpen(true),
    },
    {
      id: 'cmd-graph',
      label: 'Lore: Mở Sơ đồ quan hệ nhân vật (React Flow Graph)',
      shortcut: '',
      action: () =>
        openTab({
          id: 'tab-rel-graph',
          title: 'Sơ Đồ Quan Hệ',
          type: 'relationship-graph',
          targetId: 'graph-all',
        }),
    },
  ].filter((c) => !query || c.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm animate-in fade-in select-none"
      onClick={closeCommandPalette}
    >
      <div
        className="w-full max-w-[620px] rounded-2xl border shadow-2xl overflow-hidden flex flex-col text-xs"
        style={{
          backgroundColor: 'var(--bg-panel)',
          borderColor: 'var(--border-color)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input bar */}
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <Search size={16} className="text-muted ml-1" />
          <input
            type="text"
            autoFocus
            placeholder={
              commandPaletteMode === 'quick-open'
                ? 'Mở nhanh chương truyện hoặc hồ sơ nhân vật (Ctrl+P)...'
                : 'Nhập lệnh hoặc thiết lập cần thực thi (Ctrl+Shift+P)...'
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-primary text-sm focus:outline-none placeholder:text-muted"
          />
          <kbd className="px-2 py-0.5 rounded bg-elevated text-muted text-[10px] font-mono border border-border">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto p-2 space-y-3">
          {/* Commands mode or matching commands */}
          {commands.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                Lệnh hệ thống
              </div>
              {commands.map((cmd) => (
                <div
                  key={cmd.id}
                  onClick={() => {
                    cmd.action();
                    closeCommandPalette();
                  }}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-elevated cursor-pointer text-primary transition-colors"
                >
                  <span className="font-medium">{cmd.label}</span>
                  {cmd.shortcut && (
                    <kbd className="px-1.5 py-0.5 rounded bg-canvas text-muted text-[10px] font-mono border border-border">
                      {cmd.shortcut}
                    </kbd>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Quick Open: Chapters */}
          {commandPaletteMode === 'quick-open' && chapterMatches.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                Chương truyện
              </div>
              {chapterMatches.map((ch) => (
                <div
                  key={ch.id}
                  onClick={() => {
                    openTab({
                      id: `tab-${ch.id}`,
                      title: ch.title,
                      type: 'chapter',
                      targetId: ch.id,
                    });
                    closeCommandPalette();
                  }}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-elevated cursor-pointer text-primary transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-amber-500" />
                    <span className="font-medium">{ch.title}</span>
                  </div>
                  <span className="text-[10px] text-muted">
                    POV: {ch.pov_character_name}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Quick Open: Lore Entities */}
          {commandPaletteMode === 'quick-open' && entityMatches.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                Hồ sơ Thế giới quan (Lorebook)
              </div>
              {entityMatches.map((ent) => (
                <div
                  key={ent.id}
                  onClick={() => {
                    openTab({
                      id: `tab-char-${ent.id}`,
                      title: ent.title,
                      type: 'lore-entity',
                      targetId: ent.id,
                    });
                    closeCommandPalette();
                  }}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-elevated cursor-pointer text-primary transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-emerald-500" />
                    <span className="font-medium">{ent.title}</span>
                    {ent.aliases.length > 0 && (
                      <span className="text-[10px] text-muted">
                        ({ent.aliases.join(', ')})
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted capitalize">
                    {ent.entity_type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
