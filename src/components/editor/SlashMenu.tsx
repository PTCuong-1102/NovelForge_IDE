'use client';

import React from 'react';
import {
  FileText,
  User,
  MapPin,
  Sparkles,
  HelpCircle,
  Eye,
  CornerDownLeft,
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
  onClose,
}) => {
  return (
    <div
      className="absolute z-50 w-72 rounded-xl shadow-2xl border p-1.5 select-none animate-in fade-in zoom-in-95 duration-100 text-xs"
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
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-canvas text-left transition-colors"
      >
        <span className="font-mono text-amber-500 font-bold">***</span>
        <div>
          <div className="font-medium">Phân cảnh mới (Scene Break)</div>
          <div className="text-[10px] text-muted">Chèn dấu ngắt cảnh ba sao</div>
        </div>
      </button>

      <button
        onClick={onInsertFlashback}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-canvas text-left transition-colors"
      >
        <Eye size={14} className="text-purple-400" />
        <div>
          <div className="font-medium">Đoạn Hồi tưởng [Flashback Block]</div>
          <div className="text-[10px] text-muted">
            Miễn trừ kiểm tra nhân vật đã chết
          </div>
        </div>
      </button>

      <button
        onClick={onInsertAuthorNote}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-canvas text-left transition-colors"
      >
        <HelpCircle size={14} className="text-blue-400" />
        <div>
          <div className="font-medium">Ghi chú tác giả (Author Note)</div>
          <div className="text-[10px] text-muted">
            Khối callout ẩn khi xuất bản
          </div>
        </div>
      </button>

      <div className="px-2 py-1 mt-1 text-[10px] font-bold uppercase tracking-wider text-muted border-t border-border/40">
        Liên kết Thế giới quan
      </div>

      <button
        onClick={onInsertCharacter}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-canvas text-left transition-colors"
      >
        <User size={14} className="text-emerald-500" />
        <div>
          <div className="font-medium">Chèn Nhân vật (@)</div>
          <div className="text-[10px] text-muted">Gợi ý từ Lorebook SQLite</div>
        </div>
      </button>

      <button
        onClick={onInsertLocation}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-canvas text-left transition-colors"
      >
        <MapPin size={14} className="text-blue-500" />
        <div>
          <div className="font-medium">Chèn Địa danh (#)</div>
          <div className="text-[10px] text-muted">Liên kết bản đồ & bối cảnh</div>
        </div>
      </button>

      <div className="px-2 py-1 mt-1 text-[10px] font-bold uppercase tracking-wider text-muted border-t border-border/40">
        Trợ lý AI Tại chỗ (Composer)
      </div>

      <button
        onClick={onAiContinue}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-canvas text-left transition-colors text-accent font-medium"
      >
        <Sparkles size={14} />
        <div>
          <div>Viết tiếp cảnh này</div>
          <div className="text-[10px] text-muted">
            Duy trì ngữ cảnh nhân vật & bối cảnh
          </div>
        </div>
      </button>

      <button
        onClick={onAiShowDontTell}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-canvas text-left transition-colors text-purple-400 font-medium"
      >
        <Wand2 size={14} />
        <div>
          <div>Miêu tả ngũ quan (Show, Don&apos;t Tell)</div>
          <div className="text-[10px] text-muted">
            Tăng chi tiết thính giác, thị giác, xúc giác
          </div>
        </div>
      </button>
    </div>
  );
};
