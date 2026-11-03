'use client';

import React from 'react';
import {
  FileText,
  User,
  Table,
  Share2,
  Calendar,
  X,
  Columns,
} from 'lucide-react';
import {
  CenterTabType,
  OpenWorkbenchTab,
  useWorkspaceStore,
} from '@/stores/useWorkspaceStore';

interface TabBarProps {
  pane: 'primary' | 'secondary';
  tabs: OpenWorkbenchTab[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onToggleSplit?: () => void;
}

const getTabIcon = (type: CenterTabType) => {
  switch (type) {
    case 'chapter':
      return <FileText size={14} className="text-amber-500" />;
    case 'lore-entity':
      return <User size={14} className="text-emerald-500" />;
    case 'lore-database':
      return <Table size={14} className="text-blue-500" />;
    case 'relationship-graph':
      return <Share2 size={14} className="text-purple-500" />;
    case 'timeline-board':
      return <Calendar size={14} className="text-indigo-500" />;
  }
};

export const TabBar: React.FC<TabBarProps> = ({
  pane,
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onToggleSplit,
}) => {
  return (
    <div
      className="flex items-center justify-between border-b select-none h-9 text-xs"
      style={{
        backgroundColor: 'var(--bg-panel)',
        borderColor: 'var(--border-color)',
      }}
    >
      {/* Scrollable Tab List */}
      <div className="flex items-center h-full overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`group flex items-center gap-1.5 px-3 h-full cursor-pointer border-r transition-colors ${
                isActive
                  ? 'bg-canvas text-primary font-medium border-t-2 border-t-accent'
                  : 'text-muted hover:text-primary hover:bg-elevated/40'
              }`}
              style={{
                borderColor: 'var(--border-color)',
              }}
            >
              {getTabIcon(tab.type)}
              <span className="truncate max-w-[160px]">{tab.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-elevated text-muted hover:text-primary transition-opacity"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Pane Controls */}
      {pane === 'primary' && onToggleSplit && (
        <div className="flex items-center px-2">
          <button
            onClick={onToggleSplit}
            title="Chia đôi màn hình song song (Ctrl+\)"
            className="p-1 hover:bg-elevated rounded text-muted hover:text-primary transition-colors"
          >
            <Columns size={15} />
          </button>
        </div>
      )}
    </div>
  );
};
