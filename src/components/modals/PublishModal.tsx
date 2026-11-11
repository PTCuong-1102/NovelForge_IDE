'use client';

import React, { useState } from 'react';
import {
  UploadCloud,
  FileCheck,
  Book,
  Download,
  X,
  CheckCircle,
  AlertCircle,
  Printer,
} from 'lucide-react';
import { useEditorStore } from '@/stores/useEditorStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { countVietnameseAndLatinWords } from '@/lib/tauri-bridge';
import { compileManuscript } from '@/lib/publish/compile-manuscript';
import { buildEpub } from '@/lib/publish/epub';
import { buildDocx } from '@/lib/publish/docx';
import { escapeHtml } from '@/lib/publish/escape-html';

export const PublishModal: React.FC = () => {
  const { publishModalOpen, setPublishModalOpen } = useEditorStore();
  const { chapters, entities, projectName } = useWorkspaceStore();

  const [exportFormat, setExportFormat] = useState<'epub' | 'docx' | 'pdf'>('epub');
  const [stripAuthorNotes, setStripAuthorNotes] = useState(true);
  const [includeLoreGlossary, setIncludeLoreGlossary] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportedFileName, setExportedFileName] = useState<string | null>(null);

  if (!publishModalOpen) return null;

  const totalWords = chapters.reduce(
    (acc, c) =>
      acc +
      countVietnameseAndLatinWords(
        c.paragraphs && c.paragraphs.length > 0
          ? c.paragraphs.join(' ')
          : ''
      ),
    0
  );

  const sortedChapters = [...chapters].sort(
    (a, b) => (a.act_id ?? '').localeCompare(b.act_id ?? '') || a.order - b.order
  );

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    setExportedFileName(null);

    try {
      if (sortedChapters.length === 0) {
        throw new Error('EMPTY_MANUSCRIPT');
      }

      const compiled = compileManuscript({
        chapters: sortedChapters,
        projectName,
        includeLoreGlossary,
        stripAuthorNotes,
        entities
      });

      const safeBaseName = (projectName || 'tieu-thuyet')
        .toLowerCase()
        .replace(/[^a-z0-9\s-_]/gi, '')
        .trim()
        .replace(/\s+/g, '-') || 'ban-thao';

      if (exportFormat === 'pdf') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="vi">
            <head>
              <title>${escapeHtml(projectName)} - Bản In Chuẩn</title>
              <meta charset="utf-8" />
              <style>
                body {
                  font-family: 'Literata', 'Merriweather', 'Georgia', serif;
                  line-height: 1.8;
                  max-width: 720px;
                  margin: 40px auto;
                  color: #1a1a1a;
                  padding: 20px;
                }
                h1 { text-align: center; font-size: 24pt; margin-bottom: 8px; font-family: 'Inter', sans-serif; }
                h2 { margin-top: 40px; page-break-before: always; font-size: 18pt; border-bottom: 1px solid #ccc; padding-bottom: 8px; font-family: 'Inter', sans-serif; }
                p { text-indent: 1.5em; margin-bottom: 0.8em; font-size: 12pt; text-align: justify; }
                .meta { text-align: center; font-style: italic; color: #666; margin-bottom: 30px; font-size: 10pt; }
                hr { border: 0; border-top: 1px dashed #DDD4C3; margin: 30px 0; }
                @media print {
                  h2 { page-break-before: always; }
                }
              </style>
            </head>
            <body>
              ${compiled.fullHtml}
            </body>
            </html>
          `);
          printWindow.document.close();
          printWindow.focus();
          printWindow.print();
        }
      } else if (exportFormat === 'epub') {
        const blob = await buildEpub(compiled);
        const filename = `${safeBaseName}.epub`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setExportedFileName(filename);
      } else if (exportFormat === 'docx') {
        const blob = await buildDocx(compiled);
        const filename = `${safeBaseName}.docx`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setExportedFileName(filename);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'EMPTY_MANUSCRIPT') {
        setExportError('Dự án hiện chưa có chương nào để xuất bản. Vui lòng tạo ít nhất một chương.');
      } else {
        setExportError(`Lỗi khi biên dịch tác phẩm: ${err instanceof Error ? err.message : String(err)}`);
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in select-none text-xs"
      onClick={() => setPublishModalOpen(false)}
    >
      <div
        className="w-full max-w-[560px] rounded-2xl border shadow-2xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: 'var(--bg-panel)',
          borderColor: 'var(--border-color)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="p-4 border-b flex justify-between items-center"
          style={{ borderColor: 'var(--border-color)' }}
        >
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
          <div className="p-3.5 rounded-xl bg-elevated/50 border border-border flex items-center justify-between">
            <div>
              <div className="font-semibold text-primary">{projectName || 'Chưa đặt tên'}</div>
              <div className="text-[11px] text-muted">
                {sortedChapters.length} chương hoàn chỉnh đã sẵn sàng biên tập
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-accent">
                {totalWords.toLocaleString()} từ
              </span>
              <div className="text-[10px] text-muted">
                Ước tính: ~{Math.ceil(totalWords / 300)} trang tiểu thuyết
              </div>
            </div>
          </div>

          {/* Format Selection */}
          <div>
            <label className="text-[11px] font-semibold text-muted block mb-1.5">
              Chọn định dạng xuất bản chuẩn:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setExportFormat('epub')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 font-semibold transition-all ${
                  exportFormat === 'epub'
                    ? 'border-accent bg-accent/15 text-accent shadow-sm'
                    : 'border-border bg-elevated text-muted hover:text-primary'
                }`}
              >
                <Book size={18} />
                <span>EPUB 3 Chuẩn</span>
              </button>

              <button
                type="button"
                onClick={() => setExportFormat('docx')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 font-semibold transition-all ${
                  exportFormat === 'docx'
                    ? 'border-accent bg-accent/15 text-accent shadow-sm'
                    : 'border-border bg-elevated text-muted hover:text-primary'
                }`}
              >
                <FileCheck size={18} />
                <span>DOCX (Bản thảo)</span>
              </button>

              <button
                type="button"
                onClick={() => setExportFormat('pdf')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 font-semibold transition-all ${
                  exportFormat === 'pdf'
                    ? 'border-accent bg-accent/15 text-accent shadow-sm'
                    : 'border-border bg-elevated text-muted hover:text-primary'
                }`}
              >
                <Printer size={18} />
                <span>PDF (Hộp thoại in)</span>
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
              <span>Tự động loại bỏ các khối Ghi chú tác giả (`[!GHI_CHÚ_TÁC_GIẢ]`)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-primary">
              <input
                type="checkbox"
                checked={includeLoreGlossary}
                onChange={(e) => setIncludeLoreGlossary(e.target.checked)}
                className="accent-emerald-500 rounded"
              />
              <span>Đính kèm Phụ lục Hồ sơ Nhân vật & Địa danh (Lorebook Glossary) ở cuối sách</span>
            </label>
          </div>

          {exportError && (
            <div className="p-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-500 text-xs flex items-center gap-2 font-medium">
              <AlertCircle size={14} className="shrink-0" />
              <span>{exportError}</span>
            </div>
          )}

          {exportedFileName && (
            <div className="p-2.5 rounded-lg border semantic-success-box text-xs flex items-center gap-2 font-medium">
              <CheckCircle size={14} className="shrink-0" />
              <span>
                Đã tải tệp về máy thành công: <strong>{exportedFileName}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="p-3 border-t flex justify-end gap-2"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <button
            type="button"
            onClick={() => setPublishModalOpen(false)}
            className="px-3 py-1.5 rounded-lg bg-elevated hover:bg-elevated/80 text-muted hover:text-primary transition-colors font-medium"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors flex items-center gap-1.5 shadow-md"
          >
            {isExporting ? (
              <span>Đang biên dịch tệp...</span>
            ) : (
              <>
                <Download size={14} />
                <span>
                  {exportFormat === 'pdf'
                    ? 'In / Xuất PDF Ngay'
                    : 'Biên Dịch & Tải Về'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
