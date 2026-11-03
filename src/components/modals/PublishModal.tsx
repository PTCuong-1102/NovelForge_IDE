'use client';

import React, { useState } from 'react';
import {
  UploadCloud,
  FileCheck,
  Book,
  Download,
  X,
  CheckCircle,
} from 'lucide-react';
import { useEditorStore } from '@/stores/useEditorStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { countVietnameseAndLatinWords } from '@/lib/tauri-bridge';

export const PublishModal: React.FC = () => {
  const { publishModalOpen, setPublishModalOpen } = useEditorStore();
  const { chapters, projectName } = useWorkspaceStore();

  const [exportFormat, setExportFormat] = useState<'epub' | 'docx' | 'pdf'>('epub');
  const [stripAuthorNotes, setStripAuthorNotes] = useState(true);
  const [includeLoreGlossary, setIncludeLoreGlossary] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  if (!publishModalOpen) return null;

  const totalWords = chapters.reduce(
    (acc, c) => acc + countVietnameseAndLatinWords(c.paragraphs.join(' ')),
    0
  );

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setExportSuccess(true);
      setTimeout(() => {
        setExportSuccess(false);
        setPublishModalOpen(false);
      }, 1500);
    }, 1200);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in select-none text-xs"
      onClick={() => setPublishModalOpen(false)}
    >
      <div
        className="w-full max-w-[540px] rounded-2xl border shadow-2xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: 'var(--bg-panel)',
          borderColor: 'var(--border-color)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-2">
            <UploadCloud size={18} className="text-emerald-500" />
            <span className="font-bold text-sm text-primary">
              Biên Dịch & Xuất Bản Tác Phẩm (Publishing Compiler)
            </span>
          </div>
          <button
            onClick={() => setPublishModalOpen(false)}
            className="p-1 text-muted hover:text-primary rounded hover:bg-elevated"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="p-3 rounded-xl bg-elevated/50 border border-border flex items-center justify-between">
            <div>
              <div className="font-semibold text-primary">{projectName}</div>
              <div className="text-[11px] text-muted">
                {chapters.length} chương bản thảo hoàn tất
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-accent">
                {totalWords.toLocaleString()} từ
              </span>
              <div className="text-[10px] text-muted">Ước tính: ~{Math.ceil(totalWords / 300)} trang sách</div>
            </div>
          </div>

          {/* Format Selection */}
          <div>
            <label className="text-[11px] font-semibold text-muted block mb-1.5">
              Định dạng xuất bản chuẩn:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setExportFormat('epub')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1 font-semibold transition-colors ${
                  exportFormat === 'epub'
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-border bg-elevated text-muted hover:text-primary'
                }`}
              >
                <Book size={18} />
                <span>EPUB 3</span>
              </button>

              <button
                onClick={() => setExportFormat('docx')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1 font-semibold transition-colors ${
                  exportFormat === 'docx'
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-border bg-elevated text-muted hover:text-primary'
                }`}
              >
                <FileCheck size={18} />
                <span>DOCX Manuscript</span>
              </button>

              <button
                onClick={() => setExportFormat('pdf')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1 font-semibold transition-colors ${
                  exportFormat === 'pdf'
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-border bg-elevated text-muted hover:text-primary'
                }`}
              >
                <Download size={18} />
                <span>PDF Print</span>
              </button>
            </div>
          </div>

          {/* Compiler Options */}
          <div className="space-y-2 pt-2 border-t border-border/40">
            <label className="flex items-center gap-2 cursor-pointer text-primary">
              <input
                type="checkbox"
                checked={stripAuthorNotes}
                onChange={(e) => setStripAuthorNotes(e.target.checked)}
                className="accent-emerald-500 rounded"
              />
              <span>Tự động loại bỏ các khối Ghi chú tác giả (Author Notes)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-primary">
              <input
                type="checkbox"
                checked={includeLoreGlossary}
                onChange={(e) => setIncludeLoreGlossary(e.target.checked)}
                className="accent-emerald-500 rounded"
              />
              <span>Đính kèm Phụ lục Nhân vật & Địa danh (Lorebook Glossary) ở cuối sách</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t flex justify-end gap-2" style={{ borderColor: 'var(--border-color)' }}>
          <button
            onClick={() => setPublishModalOpen(false)}
            className="px-3 py-1.5 rounded-lg bg-elevated hover:bg-elevated/80 text-muted hover:text-primary transition-colors font-medium"
          >
            Đóng
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors flex items-center gap-1.5 shadow-md"
          >
            {exportSuccess ? (
              <>
                <CheckCircle size={14} />
                <span>Đã xuất thành công!</span>
              </>
            ) : isExporting ? (
              <span>Đang biên dịch tệp...</span>
            ) : (
              <>
                <Download size={14} />
                <span>Bắt đầu biên dịch</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
