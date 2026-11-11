'use client';

import React from 'react';
import {
  GitBranch,
  Cpu,
  AlertTriangle,
  XCircle,
  FileCheck,
  Maximize2,
  Minimize2,
  UploadCloud,
} from 'lucide-react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useEditorStore } from '@/stores/useEditorStore';
import {
  countVietnameseAndLatinWords,
  runContinuityLinterEngine,
} from '@/lib/tauri-bridge';
import { isTauri } from '@/lib/ipc';

export const StatusBar: React.FC = () => {
  const {
    activeBranch,
    saveStatus,
    zenMode,
    toggleZenMode,
    chapters,
    entities,
    setActiveActivity,
    isDemoData,
    rootPath,
  } = useWorkspaceStore();

  const { activeChapterId, ignoredIssueIds, setPublishModalOpen } =
    useEditorStore();

  const currentChapter =
    chapters.find((c) => c.id === activeChapterId) || chapters[0];

  const currentWords = currentChapter
    ? countVietnameseAndLatinWords(currentChapter.paragraphs.join(' '))
    : 0;

  const totalWords = chapters.reduce(
    (acc, c) => acc + countVietnameseAndLatinWords(c.paragraphs.join(' ')),
    0
  );

  const issues = currentChapter
    ? runContinuityLinterEngine(currentChapter, entities, ignoredIssueIds)
    : [];

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  return (
    <footer
      className="h-7 w-full flex items-center justify-between px-3 text-xs select-none border-t z-30"
      style={{
        backgroundColor: 'var(--bg-panel)',
        borderColor: 'var(--border-color)',
        color: 'var(--text-muted)',
      }}
    >
      {/* Left items: Workspace Mode, Git Branch, Save Status, Core Status */}
      <div className="flex items-center gap-3">
        {isDemoData ? (
          <span
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border semantic-warning-box font-semibold"
            title="Đang chạy ở chế độ Dữ liệu mẫu (Demo) trong trình duyệt"
          >
            ● Demo
          </span>
        ) : (
          <span
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border semantic-success-box font-semibold"
            title={`Thư mục dự án: ${rootPath || 'Cục bộ'}`}
          >
            ● Local
          </span>
        )}

        <button
          onClick={() => setActiveActivity('git')}
          className="flex items-center gap-1.5 text-primary hover:text-accent font-medium cursor-pointer"
          title="Nhánh cốt truyện hiện tại (Bấm để mở Story Timeline)"
        >
          <GitBranch size={13} className="semantic-success-text" />
          <span>{activeBranch}</span>
        </button>

        <div className="flex items-center gap-1 text-primary font-medium">
          {saveStatus === 'unsaved' ? (
            <>
              <AlertTriangle size={13} className="semantic-error-text" />
              <span className="semantic-error-text">Lỗi lưu file</span>
            </>
          ) : (
            <>
              <FileCheck size={13} className="semantic-success-text" />
              <span>
                {saveStatus === 'saving'
                  ? 'Đang lưu...'
                  : isDemoData
                  ? 'Đã lưu (Bộ nhớ)'
                  : 'Đã lưu'}
              </span>
            </>
          )}
        </div>

        <div className="hidden md:flex items-center gap-1.5 text-muted text-[11px]">
          <Cpu size={12} className="semantic-info-text" />
          <span>{isTauri() ? 'IPC Native' : 'Web Runtime'}</span>
        </div>
      </div>

      {/* Right items: Errors/Warnings, Word Count, Zen Mode, Publish */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setActiveActivity('inspector')}
          className="flex items-center gap-2 hover:opacity-85 transition-opacity"
          title="Bấm để mở Continuity Inspector"
        >
          {errorCount > 0 && (
            <span className="flex items-center gap-1 semantic-error-text font-bold">
              <XCircle size={12} /> {errorCount} Lỗi
            </span>
          )}
          {warningCount > 0 && (
            <span className="flex items-center gap-1 semantic-warning-text font-bold">
              <AlertTriangle size={12} /> {warningCount} Cảnh báo
            </span>
          )}
          {errorCount === 0 && warningCount === 0 && (
            <span className="semantic-success-text font-semibold">
              ✓ Cốt truyện nhất quán
            </span>
          )}
        </button>

        <div className="text-primary font-semibold font-mono text-[11px]">
          <span>{currentWords.toLocaleString()} từ chương</span>
          <span className="text-muted font-normal ml-1.5">
            / {totalWords.toLocaleString()} tổng
          </span>
        </div>

        <button
          onClick={() => setPublishModalOpen(true)}
          className="flex items-center gap-1 text-primary hover:text-accent font-semibold px-2 py-0.5 rounded-md hover:bg-elevated transition-colors"
          title="Xuất bản sách điện tử (EPUB 3, DOCX, PDF)"
        >
          <UploadCloud size={13} />
          <span>Xuất bản</span>
        </button>

        <button
          onClick={toggleZenMode}
          className="flex items-center gap-1 text-primary hover:text-accent font-semibold px-2 py-0.5 rounded-md hover:bg-elevated transition-colors"
          title="Bật/Tắt Zen Focus Mode (Ctrl+Shift+Z)"
        >
          {zenMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          <span>{zenMode ? 'Thoát Zen' : 'Zen'}</span>
        </button>
      </div>
    </footer>
  );
};
