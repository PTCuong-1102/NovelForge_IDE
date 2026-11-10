'use client';

import React, { useEffect } from 'react';
import {
  Search,
  PanelLeft,
  PanelRight,
  Moon,
  ScrollText,
  Sun,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { ActivityBar } from '@/components/workbench/ActivityBar';
import { Sidebar } from '@/components/workbench/Sidebar';
import { DockLayout } from '@/components/workbench/DockLayout';
import { StatusBar } from '@/components/workbench/StatusBar';
import { RightDock } from '@/components/ai-hub/RightDock';
import { CommandPalette } from '@/components/modals/CommandPalette';
import { RefactorRenameModal } from '@/components/modals/RefactorRenameModal';
import { PublishModal } from '@/components/modals/PublishModal';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { isTauri } from '@/lib/ipc';
import { FolderOpen, FlaskConical, X } from 'lucide-react';

export default function WorkbenchPage() {
  const {
    projectName,
    theme,
    setTheme,
    leftSidebarOpen,
    rightDockOpen,
    zenMode,
    chapters,
    entities,
    toggleLeftSidebar,
    toggleRightDock,
    toggleSplitView,
    toggleZenMode,
    createGitSnapshot,
    flushAllSaves,
    isProjectLoading,
    ipcNotice,
    loadDemoProject,
    openProjectFromDialog,
    dismissIpcNotice,
    rootPath,
    isDemoData,
    reloadCurrentProjectFromDisk,
  } = useWorkspaceStore();

  const {
    openCommandPalette,
    openRefactorModal,
    activeChapterId,
  } = useEditorStore();

  const currentChapter =
    chapters.find((c) => c.id === activeChapterId) || chapters[0];

  // Synchronize document data-theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Desktop: the disk is the source of truth — re-read the project on startup.
  useEffect(() => {
    if (isTauri() && rootPath && !isDemoData && chapters.length === 0) {
      void reloadCurrentProjectFromDisk();
    }
  }, [rootPath, isDemoData, chapters.length, reloadCurrentProjectFromDisk]);

  // Global Keyboard Shortcuts (VS Code & IntelliJ Ergonomics)
  useEffect(() => {
    const handleGlobalKeydown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // 1. Quick Open (Ctrl+P)
      if (isCmdOrCtrl && e.key.toLowerCase() === 'p' && !e.shiftKey) {
        e.preventDefault();
        openCommandPalette('quick-open');
        return;
      }

      // 2. Command Palette (Ctrl+Shift+P)
      if (isCmdOrCtrl && e.key.toLowerCase() === 'p' && e.shiftKey) {
        e.preventDefault();
        openCommandPalette('commands');
        return;
      }

      // 3. Refactor Rename (Shift+F6)
      if (e.shiftKey && e.key === 'F6') {
        e.preventDefault();
        const targetId =
          entities.find((x) => x.entity_type === 'character')?.id ||
          entities[0]?.id;
        if (!targetId) {
          useWorkspaceStore.setState({
            ipcNotice:
              'Chưa có thực thể nào trong project để đổi tên. Hãy thêm nhân vật hoặc địa danh trước.',
          });
          return;
        }
        openRefactorModal(targetId);
        return;
      }

      // 4. Split Editor (Ctrl+\)
      if (isCmdOrCtrl && e.key === '\\') {
        e.preventDefault();
        toggleSplitView();
        return;
      }

      // 5. Zen Focus Mode (Ctrl+Shift+Z)
      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        toggleZenMode();
        return;
      }

      // 6. Save to disk (Ctrl+S) and Git Snapshot (Ctrl+Shift+S)
      if (isCmdOrCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          void createGitSnapshot('Điểm nhớ nhanh (Ctrl+Shift+S)');
        } else {
          void flushAllSaves();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeydown);
    return () => window.removeEventListener('keydown', handleGlobalKeydown);
  }, [
    openCommandPalette,
    openRefactorModal,
    toggleSplitView,
    toggleZenMode,
    createGitSnapshot,
    flushAllSaves,
    entities,
  ]);

  // Empty-state welcome screen: shown when no project is open.
  if (chapters.length === 0) {
    return (
      <div
        className="w-screen h-screen flex flex-col items-center justify-center overflow-hidden text-primary relative"
        style={{ backgroundColor: 'var(--bg-canvas)' }}
      >
        <div className="max-w-[560px] w-full px-6 text-center flex flex-col items-center gap-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ backgroundColor: 'var(--accent-color)' }}
          >
            <Sparkles size={30} className="text-white" />
          </div>

          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">
              NovelForge IDE
            </h1>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              IDE chuyên biệt cho tiểu thuyết gia — linter nhất quán cốt
              truyện, Lorebook thế giới quan, và quản lý phiên bản cho tác phẩm.
            </p>
          </div>

          {ipcNotice && (
            <div
              className="w-full flex items-start gap-2 px-3 py-2 rounded-lg border text-xs text-left"
              style={{
                backgroundColor: 'var(--semantic-warning-bg)',
                borderColor: 'var(--semantic-warning-border)',
                color: 'var(--semantic-warning-text)',
              }}
              role="alert"
            >
              <span className="flex-1">{ipcNotice}</span>
              <button
                onClick={dismissIpcNotice}
                aria-label="Đóng thông báo"
                className="shrink-0 opacity-70 hover:opacity-100"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div className="flex flex-col gap-3 w-full">
            {isTauri() && (
              <button
                onClick={() => void openProjectFromDialog()}
                disabled={isProjectLoading}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-white shadow-md transition-opacity disabled:opacity-60"
                style={{ backgroundColor: 'var(--accent-color)' }}
              >
                <FolderOpen size={17} />
                {isProjectLoading
                  ? 'Đang mở project...'
                  : 'Mở thư mục project…'}
              </button>
            )}
            <button
              onClick={loadDemoProject}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm border border-border bg-elevated text-primary hover:bg-canvas transition-colors"
            >
              <FlaskConical size={17} />
              Mở project demo (dữ liệu mẫu)
            </button>
          </div>

          <div className="text-[11px] text-muted leading-relaxed">
            <p className="font-semibold text-primary/80">
              Cấu trúc thư mục project
            </p>
            <code className="mt-1 inline-block px-3 py-1.5 rounded-md bg-elevated border border-border font-mono text-[10px]">
              my-novel/ ├─ manuscript/act-01/*.md └─ lorebook/characters/*.md
            </code>
            <p className="mt-2">
              File Markdown + YAML frontmatter. Thay đổi được lưu thẳng xuống
              ổ đĩa khi chạy bản desktop — không có dữ liệu nào bị gửi đi đâu.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-screen h-screen flex flex-col overflow-hidden text-primary"
      style={{ backgroundColor: 'var(--bg-canvas)' }}
    >
      {/* Top Unified Workbench Header Bar (Hidden in Zen Mode) */}
      {!zenMode && (
        <header
          className="h-10 w-full px-3 border-b flex items-center justify-between gap-3 select-none z-30 text-xs"
          style={{
            backgroundColor: 'var(--bg-panel)',
            borderColor: 'var(--border-color)',
          }}
        >
          {/* Left: Brand & Active Manuscript Breadcrumb */}
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="px-2 py-0.5 rounded-md font-bold text-xs tracking-tight text-white shadow-sm flex items-center gap-1 cursor-pointer shrink-0"
              style={{ backgroundColor: 'var(--accent-color)' }}
              onClick={() => openCommandPalette('commands')}
              title="NovelForge IDE — Bấm để mở Command Palette"
            >
              <Sparkles size={12} />
              <span>NovelForge</span>
            </div>

            <span className="font-semibold text-primary truncate hidden sm:inline">
              {projectName}
            </span>

            {currentChapter && (
              <div className="hidden lg:flex items-center gap-1 text-muted truncate">
                <ChevronRight size={13} className="shrink-0" />
                <span className="truncate">{currentChapter.act_title}</span>
                <ChevronRight size={13} className="shrink-0" />
                <span className="font-semibold text-primary truncate">
                  {currentChapter.title}
                </span>
              </div>
            )}
          </div>

          {/* Center: Universal Search & Command Trigger (Ctrl+P) */}
          <button
            onClick={() => openCommandPalette('quick-open')}
            className="flex items-center justify-between gap-4 px-3 py-1 rounded-lg border border-border bg-elevated/80 hover:bg-elevated text-muted hover:text-primary transition-colors w-full max-w-[380px]"
            title="Mở nhanh chương truyện, nhân vật hoặc chạy lệnh (Ctrl+P)"
          >
            <span className="flex items-center gap-2 truncate">
              <Search size={13} className="text-accent shrink-0" />
              <span className="truncate">
                Tìm nhanh chương, nhân vật hoặc lệnh...
              </span>
            </span>
            <kbd className="px-1.5 py-0.5 rounded bg-canvas border border-border text-[10px] font-mono text-primary shrink-0">
              Ctrl+P
            </kbd>
          </button>

          {/* Right: Explicit 3-Theme Switcher & Dock Toggles */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              className="flex items-center p-0.5 rounded-lg border border-border bg-canvas"
              role="group"
              aria-label="Chọn giao diện màu sắc"
            >
              <button
                onClick={() => setTheme('obsidian')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  theme === 'obsidian'
                    ? 'bg-elevated text-primary shadow-sm border border-border/80'
                    : 'text-muted hover:text-primary'
                }`}
                title="Obsidian Ink (Giao diện tối chuyên sâu)"
              >
                <Moon size={12} />
                <span className="hidden md:inline">Obsidian</span>
              </button>

              <button
                onClick={() => setTheme('parchment')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  theme === 'parchment'
                    ? 'bg-elevated text-primary shadow-sm border border-border/80'
                    : 'text-muted hover:text-primary'
                }`}
                title="Warm Parchment (Giấy cổ chống mỏi mắt)"
              >
                <ScrollText size={12} />
                <span className="hidden md:inline">Parchment</span>
              </button>

              <button
                onClick={() => setTheme('daylight')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  theme === 'daylight'
                    ? 'bg-elevated text-primary shadow-sm border border-border/80'
                    : 'text-muted hover:text-primary'
                }`}
                title="Daylight Paper (Trang giấy trắng thanh lịch)"
              >
                <Sun size={12} />
                <span className="hidden md:inline">Daylight</span>
              </button>
            </div>

            <div className="flex items-center gap-1 border-l border-border pl-2">
              <button
                onClick={toggleLeftSidebar}
                className={`p-1.5 rounded-lg border transition-colors ${
                  leftSidebarOpen
                    ? 'bg-elevated border-border text-primary'
                    : 'border-transparent text-muted hover:text-primary hover:bg-elevated/50'
                }`}
                title="Đóng/Mở thanh công cụ bên trái"
              >
                <PanelLeft size={14} />
              </button>
              <button
                onClick={toggleRightDock}
                className={`p-1.5 rounded-lg border transition-colors ${
                  rightDockOpen
                    ? 'bg-elevated border-border text-primary'
                    : 'border-transparent text-muted hover:text-primary hover:bg-elevated/50'
                }`}
                title="Đóng/Mở trung tâm AI & MCP bên phải"
              >
                <PanelRight size={14} />
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Main Workbench Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Activity Bar (Hidden in Zen Mode) */}
        {!zenMode && <ActivityBar />}

        {/* Collapsible Left Sidebar (Hidden in Zen Mode) */}
        {!zenMode && leftSidebarOpen && <Sidebar />}

        {/* Central Editor & Multi-tab Workbench */}
        <main className="flex-1 h-full flex flex-col min-w-0 overflow-hidden relative">
          <DockLayout />
        </main>

        {/* Right AI Hub & MCP Bridge Dock (Hidden in Zen Mode) */}
        {!zenMode && rightDockOpen && <RightDock />}
      </div>

      {/* Bottom Status Bar (Always visible or compact) */}
      {!zenMode && <StatusBar />}

      {/* IPC / persistence notice toast */}
      {ipcNotice && (
        <div
          className="fixed bottom-10 right-4 z-50 max-w-[380px] flex items-start gap-2 px-3 py-2 rounded-lg border text-xs shadow-lg"
          style={{
            backgroundColor: 'var(--semantic-warning-bg)',
            borderColor: 'var(--semantic-warning-border)',
            color: 'var(--semantic-warning-text)',
          }}
          role="alert"
        >
          <span className="flex-1">{ipcNotice}</span>
          <button
            onClick={dismissIpcNotice}
            aria-label="Đóng thông báo"
            className="shrink-0 opacity-70 hover:opacity-100"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Floating Global Modals */}
      <CommandPalette />
      <RefactorRenameModal />
      <PublishModal />
    </div>
  );
}
