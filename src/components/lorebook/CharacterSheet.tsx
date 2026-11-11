'use client';

import React, { useState, useEffect } from 'react';
import {
  User,
  MapPin,
  Sparkles,
  Save,
  FileCode,
} from 'lucide-react';
import { LoreEntity } from '@/lib/tauri-bridge';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useEditorStore } from '@/stores/useEditorStore';

interface CharacterSheetProps {
  entity: LoreEntity;
}

export const CharacterSheet: React.FC<CharacterSheetProps> = ({ entity }) => {
  const { updateEntity } = useWorkspaceStore();
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
  const [idDraft, setIdDraft] = useState(entity.id);

  useEffect(() => {
    setIdDraft(entity.id);
  }, [entity.id]);

  // Changing the technical id re-points every reference to this entity.
  const applyIdChange = () => {
    const next = idDraft.trim();
    if (!next || next === entity.id) return;
    const confirmed = window.confirm(
      `Đổi ID thực thể từ "${entity.id}" sang "${next}"?\n\nTab đang mở, quan hệ nhân vật và chỉ mục SQLite sẽ được cập nhật theo.`
    );
    if (!confirmed) return;
    updateEntity(entity.id, { id: next });
  };

  // Re-sync the form when the entity is replaced or renamed from the outside
  // (tab switch, Refactor Rename) — a stale form would overwrite the new values.
  useEffect(() => {
    setTitle(entity.title);
    setAliases(entity.aliases.join(', '));
    setStatus(entity.status || 'alive');
    setFaction(entity.faction || '');
    setRole(entity.role || '');
    setAppearance(entity.appearance || '');
    setPersonality(entity.personality || '');
    setBody(entity.body || '');
  }, [entity.id, entity.updated_at]);

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
      <div className="w-full max-w-[820px] flex flex-col gap-6">
        {/* Header Bar */}
        <div
          className="p-5 rounded-2xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
          style={{
            backgroundColor: 'var(--bg-paper)',
            borderColor: 'var(--border-color)',
            boxShadow: 'var(--shadow-paper)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl border semantic-success-box flex items-center justify-center font-bold text-lg">
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
                  className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${
                    status === 'dead'
                      ? 'semantic-error-box'
                      : 'semantic-success-box'
                  }`}
                >
                  {status === 'dead' ? 'Tử vong' : 'Còn sống'}
                </span>
              </div>
              <div className="text-xs text-muted mt-0.5">
                Đường dẫn tệp:{' '}
                <code className="font-mono text-primary">
                  {entity.file_path}
                </code>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => openRefactorModal(entity.id)}
              className="px-3 py-1.5 rounded-lg border border-border bg-elevated hover:opacity-90 text-xs font-semibold text-primary transition-colors"
            >
              Đổi tên toàn cục (Shift+F6)
            </button>
            <button
              onClick={() => openFindUsages(entity.id)}
              className="px-3 py-1.5 rounded-lg border border-border bg-elevated hover:opacity-90 text-xs font-semibold text-primary transition-colors"
            >
              Xem xuất hiện
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
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
            backgroundColor: 'var(--bg-paper)',
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
              className="bg-elevated border border-border rounded-lg px-2.5 py-2 text-primary font-medium focus:outline-none focus:border-accent"
              placeholder="VD: Tiểu Linh, Đặc vụ số 7"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-muted">
              ID kỹ thuật (dùng cho tab, quan hệ và chỉ mục SQLite):
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={idDraft}
                onChange={(e) => setIdDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyIdChange();
                }}
                className="flex-1 bg-elevated border border-border rounded-lg px-2.5 py-2 text-primary font-mono focus:outline-none focus:border-accent"
              />
              <button
                onClick={applyIdChange}
                disabled={!idDraft.trim() || idDraft.trim() === entity.id}
                className="px-2.5 py-2 rounded-lg border border-border bg-elevated text-[11px] font-semibold text-primary disabled:opacity-40"
              >
                Đổi ID
              </button>
            </div>
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
              className="bg-elevated border border-border rounded-lg px-2.5 py-2 text-primary font-medium focus:outline-none focus:border-accent"
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
              className="bg-elevated border border-border rounded-lg px-2.5 py-2 text-primary font-medium focus:outline-none focus:border-accent"
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
              className="bg-elevated border border-border rounded-lg px-2.5 py-2 text-primary font-medium focus:outline-none focus:border-accent"
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
              className="bg-elevated border border-border rounded-lg px-2.5 py-2 text-primary font-medium focus:outline-none focus:border-accent"
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
              className="bg-elevated border border-border rounded-lg px-2.5 py-2 text-primary font-medium focus:outline-none focus:border-accent"
              placeholder="VD: Lạnh lùng, quyết đoán, sợ không gian hẹp"
            />
          </div>
        </div>

        {/* Rich Lore Body (Markdown Editor) */}
        <div
          className="p-5 rounded-2xl border flex flex-col gap-3"
          style={{
            backgroundColor: 'var(--bg-paper)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-muted">
            <span className="flex items-center gap-1.5 text-primary font-bold">
              <FileCode size={14} className="text-accent" />
              Tiểu sử & Ghi chú thế giới quan (Markdown Body)
            </span>
            <span className="text-[11px]">
              Hỗ trợ định dạng Notion Markdown
            </span>
          </div>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            className="w-full bg-elevated/50 border border-border rounded-xl p-3.5 text-primary text-sm font-serif leading-relaxed focus:outline-none focus:border-accent resize-y"
            placeholder="Viết tiểu sử chi tiết, các mối quan hệ, bảng kỹ năng..."
          />
        </div>
      </div>
    </div>
  );
};
