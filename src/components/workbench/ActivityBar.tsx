'use client';

import React from 'react';
import {
  BookOpen,
  Dna,
  Search,
  GitBranch,
  ShieldAlert,
  Settings,
  Sparkles,
} from 'lucide-react';
import { LeftActivityView, useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { runContinuityLinterEngine } from '@/lib/tauri-bridge';

interface ActivityItem {
  id: LeftActivityView;
  label: string;
  icon: React.ElementType;
  shortcut: string;
  badge?: number;
}

export const ActivityBar: React.FC = () => {
  const { activeActivity, setActiveActivity, theme, setTheme, chapters, entities } =
    useWorkspaceStore();
  const { openCommandPalette, ignoredIssueIds } = useEditorStore();

  const totalIssues = chapters.reduce(
    (acc, ch) =>
      acc + runContinuityLinterEngine(ch, entities, ignoredIssueIds).length,
    0
  );

  const activities: ActivityItem[] = [
    {
      id: 'explorer',
      label: 'Manuscript Explorer',
      icon: BookOpen,
      shortcut: 'Ctrl+Shift+E',
    },
    {
      id: 'lorebook',
      label: 'Lorebook & World-building',
      icon: Dna,
      shortcut: 'Ctrl+Shift+L',
    },
    {
      id: 'search',
      label: 'Global Search & Find Usages',
      icon: Search,
      shortcut: 'Ctrl+Shift+F',
    },
    {
      id: 'git',
      label: 'Story Timeline & Snapshots',
      icon: GitBranch,
      shortcut: 'Ctrl+Shift+G',
    },
    {
      id: 'inspector',
      label: 'Continuity Inspector',
      icon: ShieldAlert,
      shortcut: 'Ctrl+Shift+M',
      badge: totalIssues,
    },
  ];

  const cycleTheme = () => {
    const nextTheme =
      theme === 'obsidian'
        ? 'parchment'
        : theme === 'parchment'
        ? 'daylight'
        : 'obsidian';
    setTheme(nextTheme);
  };

  return (
    <aside
      className="w-12 h-full flex flex-col justify-between items-center py-2.5 select-none border-r z-30"
      style={{
        backgroundColor: 'var(--bg-panel)',
        borderColor: 'var(--border-color)',
      }}
      aria-label="Activity Bar"
    >
      {/* Top Icons */}
      <div className="flex flex-col items-center gap-1.5 w-full">
        {activities.map((act) => {
          const Icon = act.icon;
          const isActive = activeActivity === act.id;

          return (
            <button
              key={act.id}
              onClick={() => setActiveActivity(act.id)}
              title={`${act.label} (${act.shortcut})`}
              className={`relative w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                isActive
                  ? 'bg-elevated text-primary font-semibold shadow-sm'
                  : 'text-muted hover:text-primary hover:bg-elevated/50'
              }`}
              style={{
                borderLeft: isActive
                  ? '2.5px solid var(--accent-color)'
                  : '2.5px solid transparent',
              }}
            >
              <Icon size={18} />
              {act.badge !== undefined && act.badge > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-red-600 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                  {act.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Icons: Theme toggle & Settings */}
      <div className="flex flex-col items-center gap-1.5 w-full">
        <button
          onClick={cycleTheme}
          title={`Chuyển giao diện: Hiện tại là ${theme} (Bấm để đổi Obsidian / Parchment / Daylight)`}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-elevated/60 transition-colors"
        >
          <Sparkles size={17} />
        </button>

        <button
          onClick={() => openCommandPalette('commands')}
          title="Thiết lập & Lệnh (Ctrl+Shift+P)"
          className="w-10 h-10 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-elevated/60 transition-colors"
        >
          <Settings size={18} />
        </button>
      </div>
    </aside>
  );
};
