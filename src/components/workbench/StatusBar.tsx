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

export const StatusBar: React.FC = () => {
  const {
    activeBranch,
    saveStatus,
    zenMode,
    toggleZenMode,
    chapters,
    entities,
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
      className="h-6 w-full flex items-center justify-between px-3 text-[11px] select-none border-t z-30"
      style={{
        backgroundColor: 'var(--bg-panel)',
        borderColor: 'var(--border-color)',
        color: 'var(--text-muted)',
      }}
    >
      {/* Left items: Git Branch, Save Status, MCP Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-primary hover:text-accent cursor-pointer">
          <GitBranch size={13} className="text-emerald-500" />
          <span>{activeBranch}</span>
        </div>

        <div className="flex items-center gap-1 text-primary">
          <FileCheck size={13} className="text-emerald-500" />
          <span>{saveStatus === 'saved' ? 'Đã lưu' : 'Đang lưu...'}</span>
        </div>

        <div className="flex items-center gap-1 text-primary">
          <Cpu size={13} className="text-purple-400" />
          <span>MCP: 3 Agents Connected (Cline, Antigravity, OpenCode)</span>
        </div>
      </div>

      {/* Right items: Errors/Warnings, Word Count, Zen Mode, Publish */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          {errorCount > 0 && (
            <span className="flex items-center gap-1 text-red-400 font-semibold">
              <XCircle size={12} /> {errorCount} Lỗi
            </span>
          )}
          {warningCount > 0 && (
            <span className="flex items-center gap-1 text-amber-400 font-semibold">
              <AlertTriangle size={12} /> {warningCount} Cảnh báo
            </span>
          )}
          {errorCount === 0 && warningCount === 0 && (
            <span className="text-emerald-500 font-medium">
              ✓ Cốt truyện nhất quán
            </span>
          )}
        </div>

        <div className="text-primary font-medium">
          <span>{currentWords.toLocaleString()} từ chương</span>
          <span className="text-muted ml-1.5">
            / {totalWords.toLocaleString()} tổng
          </span>
        </div>

        <button
          onClick={() => setPublishModalOpen(true)}
          className="flex items-center gap-1 text-primary hover:text-accent font-medium px-1.5 py-0.5 rounded hover:bg-elevated transition-colors"
          title="Xuất bản sách điện tử (EPUB, DOCX, PDF)"
        >
          <UploadCloud size={13} />
          <span>Xuất bản</span>
        </button>

        <button
          onClick={toggleZenMode}
          className="flex items-center gap-1 text-primary hover:text-accent font-medium px-1.5 py-0.5 rounded hover:bg-elevated transition-colors"
          title="Bật/Tắt Zen Focus Mode (Ctrl+Shift+Z)"
        >
          {zenMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          <span>{zenMode ? 'Thoát Zen' : 'Zen'}</span>
        </button>
      </div>
    </footer>
  );
};
