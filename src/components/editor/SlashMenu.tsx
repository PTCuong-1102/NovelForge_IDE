'use client';

import React from 'react';
import {
  User,
  MapPin,
  Sparkles,
  HelpCircle,
  Eye,
  Wand2,
} from 'lucide-react';

interface SlashMenuProps {
  onInsertSceneBreak: () => void;
  onInsertAuthorNote: () => void;
  onInsertFlashback: () => void;
  onInsertCharacter: () => void;
  onInsertLocation: () => void;
  onAiContinue: () => void;
  onAiShowDontTell: () => void;
  onClose: () => void;
}

export const SlashMenu: React.FC<SlashMenuProps> = ({
  onInsertSceneBreak,
  onInsertAuthorNote,
  onInsertFlashback,
  onInsertCharacter,
  onInsertLocation,
  onAiContinue,
  onAiShowDontTell,
}) => {
  return (
    <div
      className="w-76 rounded-xl shadow-2xl border p-2 select-none animate-in fade-in zoom-in-95 duration-100 text-xs"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        borderColor: 'var(--border-color)',
        color: 'var(--text-primary)',
      }}
    >
      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">
        Cấu trúc Văn học & Phân cảnh
      </div>

      <button
        onClick={onInsertSceneBreak}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-canvas text-left transition-colors"
      >
        <span className="font-mono semantic-warning-text font-bold">***</span>
        <div>
          <div className="font-semibold text-primary">
            Phân cảnh mới (Scene Break)
          </div>
          <div className="text-[11px] text-muted">
            Chèn dấu ngắt cảnh ba sao
          </div>
        </div>
      </button>

      <button
        onClick={onInsertFlashback}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-canvas text-left transition-colors"
      >
        <Eye size={14} className="semantic-info-text shrink-0" />
        <div>
          <div className="font-semibold text-primary">
            Đoạn Hồi tưởng [Flashback Block]
          </div>
          <div className="text-[11px] text-muted">
            Miễn trừ kiểm tra nhân vật đã chết
          </div>
        </div>
      </button>

      <button
        onClick={onInsertAuthorNote}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-canvas text-left transition-colors"
      >
        <HelpCircle size={14} className="semantic-info-text shrink-0" />
        <div>
          <div className="font-semibold text-primary">
            Ghi chú tác giả (Author Note)
          </div>
          <div className="text-[11px] text-muted">
            Khối callout ẩn khi xuất bản
          </div>
        </div>
      </button>

      <div className="px-2 py-1 mt-1.5 text-[10px] font-bold uppercase tracking-wider text-muted border-t border-border/60">
        Liên kết Thế giới quan
      </div>

      <button
        onClick={onInsertCharacter}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-canvas text-left transition-colors"
      >
        <User size={14} className="semantic-success-text shrink-0" />
        <div>
          <div className="font-semibold text-primary">Chèn Nhân vật (@)</div>
          <div className="text-[11px] text-muted">
            Gợi ý từ Lorebook SQLite
          </div>
        </div>
      </button>

      <button
        onClick={onInsertLocation}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-canvas text-left transition-colors"
      >
        <MapPin size={14} className="semantic-info-text shrink-0" />
        <div>
          <div className="font-semibold text-primary">Chèn Địa danh (#)</div>
          <div className="text-[11px] text-muted">
            Liên kết bản đồ & bối cảnh
          </div>
        </div>
      </button>

      <div className="px-2 py-1 mt-1.5 text-[10px] font-bold uppercase tracking-wider text-muted border-t border-border/60">
        Trợ lý AI Tại chỗ (Composer)
      </div>

      <button
        onClick={onAiContinue}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-canvas text-left transition-colors semantic-success-text font-semibold"
      >
        <Sparkles size={14} className="shrink-0" />
        <div>
          <div>Viết tiếp cảnh này</div>
          <div className="text-[11px] text-muted font-normal">
            Duy trì ngữ cảnh nhân vật & bối cảnh
          </div>
        </div>
      </button>

      <button
        onClick={onAiShowDontTell}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-canvas text-left transition-colors semantic-info-text font-semibold"
      >
        <Wand2 size={14} className="shrink-0" />
        <div>
          <div>Miêu tả ngũ quan (Show, Don&apos;t Tell)</div>
          <div className="text-[11px] text-muted font-normal">
            Tăng chi tiết thính giác, thị giác, xúc giác
          </div>
        </div>
      </button>
    </div>
  );
};
