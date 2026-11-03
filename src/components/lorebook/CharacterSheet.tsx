'use client';

import React, { useState } from 'react';
import {
  User,
  MapPin,
  Sparkles,
  Calendar,
  Save,
  Tag,
  ExternalLink,
  Shield,
  FileCode,
} from 'lucide-react';
import { LoreEntity } from '@/lib/tauri-bridge';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useEditorStore } from '@/stores/useEditorStore';

interface CharacterSheetProps {
  entity: LoreEntity;
}

export const CharacterSheet: React.FC<CharacterSheetProps> = ({ entity }) => {
  const { updateEntity, openTab } = useWorkspaceStore();
  const { openRefactorModal, openFindUsages } = useEditorStore();

  const [title, setTitle] = useState(entity.title);
  const [aliases, setAliases] = useState(entity.aliases.join(', '));
  const [status, setStatus] = useState<
    'alive' | 'dead' | 'missing' | 'active' | 'destroyed'
  >(entity.status || 'alive');
  const [faction, setFaction] = useState(entity.faction || '');
  const [role, setRole] = useState(entity.role || '');
  const [appearance, setAppearance] = useState(entity.appearance || '');
  const [personality, setPersonality] = useState(entity.personality || '');
  const [body, setBody] = useState(entity.body || '');

  const handleSave = () => {
    updateEntity(entity.id, {
      title,
      aliases: aliases
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
      status: status as LoreEntity['status'],
      faction,
      role,
      appearance,
      personality,
      body,
    });
  };

  return (
    <div
      className="flex-1 h-full overflow-y-auto p-6 flex flex-col items-center select-text"
      style={{ backgroundColor: 'var(--bg-canvas)' }}
    >
      <div className="w-full max-w-[800px] flex flex-col gap-6">
        {/* Header Bar */}
        <div
          className="p-5 rounded-2xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
          style={{
            backgroundColor: 'var(--bg-panel)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-accent/15 text-accent flex items-center justify-center font-bold text-lg">
              {entity.entity_type === 'character' ? (
                <User size={24} />
              ) : entity.entity_type === 'location' ? (
                <MapPin size={24} />
              ) : (
                <Sparkles size={24} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-xl font-bold bg-transparent text-primary focus:outline-none focus:ring-1 focus:ring-accent rounded px-1"
                />
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    status === 'dead'
                      ? 'bg-red-500/15 text-red-400'
                      : 'bg-emerald-500/15 text-emerald-400'
                  }`}
                >
                  {status === 'dead' ? 'Tử vong' : 'Còn sống'}
                </span>
              </div>
              <div className="text-xs text-muted mt-0.5">
                Đường dẫn tệp: <code className="font-mono">{entity.file_path}</code>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => openRefactorModal(entity.id)}
              className="px-3 py-1.5 rounded-lg border border-border bg-elevated hover:bg-elevated/80 text-xs font-semibold text-primary transition-colors"
            >
              Đổi tên toàn cục (Shift+F6)
            </button>
            <button
              onClick={() => openFindUsages(entity.id)}
              className="px-3 py-1.5 rounded-lg border border-border bg-elevated hover:bg-elevated/80 text-xs font-semibold text-primary transition-colors"
            >
              Xem xuất hiện
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <Save size={13} />
              <span>Lưu hồ sơ</span>
            </button>
          </div>
        </div>

        {/* Property Grid (YAML Frontmatter Editor) */}
        <div
          className="p-5 rounded-2xl border grid grid-cols-1 md:grid-cols-2 gap-4 text-xs"
          style={{
            backgroundColor: 'var(--bg-panel)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-muted">
              Biệt danh / Tên gọi khác (aliases - phân tách bằng dấu phẩy):
            </label>
            <input
              type="text"
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
              className="bg-elevated border border-border rounded px-2.5 py-2 text-primary focus:outline-none"
              placeholder="VD: Tiểu Linh, Đặc vụ số 7"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-muted">
              Trạng thái sinh tồn (status):
            </label>
            <select
              value={status}
              onChange={(e) =>
                setStatus(
                  e.target.value as
                    | 'alive'
                    | 'dead'
                    | 'missing'
                    | 'active'
                    | 'destroyed'
                )
              }
              className="bg-elevated border border-border rounded px-2.5 py-2 text-primary focus:outline-none"
            >
              <option value="alive">Còn sống (alive)</option>
              <option value="dead">Đã tử vong (dead)</option>
              <option value="missing">Mất tích (missing)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-muted">
              Phe phái / Tổ chức (faction):
            </label>
            <input
              type="text"
              value={faction}
              onChange={(e) => setFaction(e.target.value)}
              className="bg-elevated border border-border rounded px-2.5 py-2 text-primary focus:outline-none"
              placeholder="VD: Cục An Ninh Mạng Aegis"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-muted">
              Vai trò trong cốt truyện (role):
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="bg-elevated border border-border rounded px-2.5 py-2 text-primary focus:outline-none"
              placeholder="VD: Nhân vật chính (Protagonist)"
            />
          </div>

          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-[11px] font-semibold text-muted">
              Đặc điểm ngoại hình chuẩn (Dùng cho Linter Rule 2):
            </label>
            <input
              type="text"
              value={appearance}
              onChange={(e) => setAppearance(e.target.value)}
              className="bg-elevated border border-border rounded px-2.5 py-2 text-primary focus:outline-none"
              placeholder="VD: Tóc ngắn ngang vai, vết sẹo nhỏ ở cổ tay trái"
            />
          </div>

          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-[11px] font-semibold text-muted">
              Tính cách & Điểm yếu tâm lý:
            </label>
            <input
              type="text"
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              className="bg-elevated border border-border rounded px-2.5 py-2 text-primary focus:outline-none"
              placeholder="VD: Lạnh lùng, quyết đoán, sợ không gian hẹp"
            />
          </div>
        </div>

        {/* Rich Lore Body (Markdown Editor) */}
        <div
          className="p-5 rounded-2xl border flex flex-col gap-3"
          style={{
            backgroundColor: 'var(--bg-panel)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-muted">
            <span className="flex items-center gap-1.5">
              <FileCode size={14} />
              Tiểu sử & Ghi chú thế giới quan (Markdown Body)
            </span>
            <span className="text-[11px]">Hỗ trợ định dạng Notion Markdown</span>
          </div>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            className="w-full bg-elevated/40 border border-border rounded-xl p-3 text-primary text-sm font-serif leading-relaxed focus:outline-none focus:ring-1 focus:ring-accent resize-y"
            placeholder="Viết tiểu sử chi tiết, các mối quan hệ, bảng kỹ năng..."
          />
        </div>
      </div>
    </div>
  );
};
