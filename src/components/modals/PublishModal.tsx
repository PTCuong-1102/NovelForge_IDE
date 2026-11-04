'use client';

import React, { useState } from 'react';
import {
  UploadCloud,
  FileCheck,
  Book,
  Download,
  X,
  CheckCircle,
  FileText,
  Printer,
  Sparkles,
} from 'lucide-react';
import { useEditorStore } from '@/stores/useEditorStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { countVietnameseAndLatinWords } from '@/lib/tauri-bridge';

export const PublishModal: React.FC = () => {
  const { publishModalOpen, setPublishModalOpen } = useEditorStore();
  const { chapters, entities, projectName } = useWorkspaceStore();

  const [exportFormat, setExportFormat] = useState<'epub' | 'docx' | 'pdf'>('epub');
  const [stripAuthorNotes, setStripAuthorNotes] = useState(true);
  const [includeLoreGlossary, setIncludeLoreGlossary] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportedFileName, setExportedFileName] = useState<string | null>(null);

  if (!publishModalOpen) return null;

  const totalWords = chapters.reduce(
    (acc, c) => acc + countVietnameseAndLatinWords(c.paragraphs.join(' ')),
    0
  );

  const sortedChapters = [...chapters].sort((a, b) => a.order - b.order);

  // Compiles chapters into clean publication-ready text
  const compileManuscript = () => {
    let content = `# ${projectName.toUpperCase()}\n\n`;
    content += `*Tác giả: NovelForge Author*\n*Tổng số từ: ${totalWords.toLocaleString()} từ*\n*Ngày biên dịch: ${new Date().toLocaleDateString('vi-VN')}*\n\n---\n\n`;

    let currentAct = '';
    sortedChapters.forEach((ch) => {
      if (ch.act_title && ch.act_title !== currentAct) {
        currentAct = ch.act_title;
        content += `\n# ${currentAct.toUpperCase()}\n\n`;
      }

      content += `## ${ch.title}\n`;
      content += `*Góc nhìn (POV): ${ch.pov_character_name} | Bối cảnh: ${ch.story_date} | ${ch.location_tag}*\n\n`;

      ch.paragraphs.forEach((para) => {
        if (stripAuthorNotes && para.startsWith('> [!GHI_CHÚ_TÁC_GIẢ]')) {
          return;
        }
        content += `${para}\n\n`;
      });

      content += `\n---\n\n`;
    });

    if (includeLoreGlossary) {
      content += `# PHỤ LỤC: THẾ GIỚI QUAN & HỒ SƠ NHÂN VẬT\n\n`;
      const characters = entities.filter((e) => e.entity_type === 'character');
      const locations = entities.filter((e) => e.entity_type === 'location');

      content += `### 1. Nhân Vật\n`;
      characters.forEach((char) => {
        content += `- **${char.title}** (${char.aliases.join(', ') || 'Chính'}): ${
          char.role || ''
        } - ${char.summary || char.personality || ''}\n`;
      });

      content += `\n### 2. Địa Danh & Bối Cảnh\n`;
      locations.forEach((loc) => {
        content += `- **${loc.title}**: ${loc.summary || ''}\n`;
      });
    }

    return content;
  };

  const handleExport = () => {
    setIsExporting(true);

    setTimeout(() => {
      const compiledText = compileManuscript();

      if (exportFormat === 'pdf') {
        // Trigger browser print for PDF export
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>${projectName} - Bản In Chuẩn</title>
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
                h1 { text-align: center; font-size: 24pt; margin-bottom: 8px; }
                h2 { margin-top: 40px; page-break-before: always; font-size: 18pt; border-bottom: 1px solid #ccc; padding-bottom: 8px; }
                p { text-indent: 1.5em; margin-bottom: 0.8em; font-size: 12pt; text-align: justify; }
                .meta { text-align: center; font-style: italic; color: #666; margin-bottom: 30px; font-size: 10pt; }
                @media print {
                  h2 { page-break-before: always; }
                }
              </style>
            </head>
            <body>
              ${compiledText
                .split('\n\n')
                .map((block) => {
                  if (block.startsWith('# ')) return `<h1>${block.replace('# ', '')}</h1>`;
                  if (block.startsWith('## ')) return `<h2>${block.replace('## ', '')}</h2>`;
                  if (block.startsWith('### ')) return `<h3>${block.replace('### ', '')}</h3>`;
                  if (block.startsWith('*') && block.endsWith('*'))
                    return `<div class="meta">${block.replace(/\*/g, '')}</div>`;
                  if (block.trim() === '---') return '<hr />';
                  return `<p>${block}</p>`;
                })
                .join('')}
            </body>
            </html>
          `);
          printWindow.document.close();
          printWindow.focus();
          printWindow.print();
        }
      } else {
        // Generate downloaded file for EPUB/HTML or DOCX/Markdown
        const mimeType =
          exportFormat === 'epub' ? 'text/html;charset=utf-8' : 'text/markdown;charset=utf-8';
        const fileExt = exportFormat === 'epub' ? 'html' : 'md';
        const filename = `${projectName.toLowerCase().replace(/\s+/g, '-')}.${fileExt}`;

        let exportPayload = compiledText;
        if (exportFormat === 'epub') {
          exportPayload = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>${projectName}</title>
  <style>
    body { font-family: 'Literata', Georgia, serif; line-height: 1.8; max-width: 68ch; margin: 40px auto; padding: 20px; color: #2C2623; background: #FBF8F1; }
    h1, h2, h3 { font-family: 'Inter', sans-serif; color: #0F172A; }
    p { text-indent: 1.5em; margin-bottom: 1em; }
    hr { border: 0; border-top: 1px dashed #DDD4C3; margin: 30px 0; }
  </style>
</head>
<body>
  ${compiledText
    .split('\n\n')
    .map((b) => `<p>${b}</p>`)
    .join('\n')}
</body>
</html>`;
        }

        const blob = new Blob([exportPayload], { type: mimeType });
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

      setIsExporting(false);
    }, 600);
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
              <div className="font-semibold text-primary">{projectName}</div>
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
                onClick={() => setExportFormat('epub')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 font-semibold transition-all ${
                  exportFormat === 'epub'
                    ? 'border-accent bg-accent/15 text-accent shadow-sm'
                    : 'border-border bg-elevated text-muted hover:text-primary'
                }`}
              >
                <Book size={18} />
                <span>EPUB 3 / HTML Reader</span>
              </button>

              <button
                onClick={() => setExportFormat('docx')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 font-semibold transition-all ${
                  exportFormat === 'docx'
                    ? 'border-accent bg-accent/15 text-accent shadow-sm'
                    : 'border-border bg-elevated text-muted hover:text-primary'
                }`}
              >
                <FileCheck size={18} />
                <span>DOCX / Manuscript</span>
              </button>

              <button
                onClick={() => setExportFormat('pdf')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 font-semibold transition-all ${
                  exportFormat === 'pdf'
                    ? 'border-accent bg-accent/15 text-accent shadow-sm'
                    : 'border-border bg-elevated text-muted hover:text-primary'
                }`}
              >
                <Printer size={18} />
                <span>PDF Print View</span>
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

          {exportedFileName && (
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle size={14} />
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
