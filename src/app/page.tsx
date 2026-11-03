'use client';

import React, { useEffect } from 'react';
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

export default function WorkbenchPage() {
  const {
    theme,
    leftSidebarOpen,
    rightDockOpen,
    zenMode,
    toggleLeftSidebar,
    toggleRightDock,
    toggleSplitView,
    toggleZenMode,
    createGitSnapshot,
  } = useWorkspaceStore();

  const {
    openCommandPalette,
    openRefactorModal,
    activeChapterId,
    setPublishModalOpen,
  } = useEditorStore();

  // Synchronize document data-theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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
        openRefactorModal('char_linh_001');
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

      // 6. Save & Git Snapshot (Ctrl+S)
      if (isCmdOrCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        createGitSnapshot('Lưu nhanh qua phím tắt Ctrl+S');
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
  ]);

  return (
    <div
      className="w-screen h-screen flex flex-col overflow-hidden text-primary"
      style={{ backgroundColor: 'var(--bg-canvas)' }}
    >
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

      {/* Floating Global Modals */}
      <CommandPalette />
      <RefactorRenameModal />
      <PublishModal />
    </div>
  );
}
