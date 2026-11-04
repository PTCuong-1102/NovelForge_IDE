'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useWorkspaceStore, OpenWorkbenchTab } from '@/stores/useWorkspaceStore';
import { TabBar } from './TabBar';
import { NovelEditor } from '../editor/NovelEditor';
import { CharacterSheet } from '../lorebook/CharacterSheet';
import { LoreDatabaseView } from '../lorebook/LoreDatabaseView';
import { RelationshipGraph } from '../lorebook/RelationshipGraph';

export const DockLayout: React.FC = () => {
  const {
    openTabs,
    activePrimaryTabId,
    activeSecondaryTabId,
    splitView,
    toggleSplitView,
    setActiveTab,
    closeTab,
    chapters,
    entities,
  } = useWorkspaceStore();

  const [primaryWidthPercent, setPrimaryWidthPercent] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const primaryTabs = openTabs.filter(
    (t) => t.pane === 'primary' || !splitView
  );
  const secondaryTabs = openTabs.filter((t) => t.pane === 'secondary');

  const activePrimaryTab =
    primaryTabs.find((t) => t.id === activePrimaryTabId) || primaryTabs[0];

  const activeSecondaryTab =
    secondaryTabs.find((t) => t.id === activeSecondaryTabId) ||
    secondaryTabs[0] ||
    primaryTabs[1];

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const offset = e.clientX - rect.left;
      const totalWidth = rect.width;
      const percentage = Math.min(80, Math.max(20, (offset / totalWidth) * 100));
      setPrimaryWidthPercent(percentage);
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const renderTabContent = (tab?: OpenWorkbenchTab) => {
    if (!tab) {
      return (
        <div className="flex-1 flex items-center justify-center text-xs text-muted">
          Không có tab nào được mở. Bấm Ctrl+P để mở nhanh.
        </div>
      );
    }

    switch (tab.type) {
      case 'chapter': {
        const chapter =
          chapters.find((c) => c.id === tab.targetId) || chapters[0];
        return <NovelEditor key={chapter.id} chapter={chapter} />;
      }
      case 'lore-entity': {
        const entity =
          entities.find((e) => e.id === tab.targetId) || entities[0];
        return <CharacterSheet key={entity.id} entity={entity} />;
      }
      case 'lore-database': {
        return <LoreDatabaseView key="lore-database" />;
      }
      case 'relationship-graph': {
        return <RelationshipGraph key="relationship-graph" />;
      }
      default:
        return null;
    }
  };

  return (
    <div
      ref={containerRef}
      className={`flex-1 h-full flex overflow-hidden ${
        isDragging ? 'select-none cursor-col-resize' : ''
      }`}
    >
      {/* Primary Pane */}
      <div
        className="h-full flex flex-col min-w-0"
        style={{
          width: splitView ? `${primaryWidthPercent}%` : '100%',
        }}
      >
        <TabBar
          pane="primary"
          tabs={primaryTabs}
          activeTabId={activePrimaryTab?.id || null}
          onSelectTab={(id) => setActiveTab(id, 'primary')}
          onCloseTab={closeTab}
          onToggleSplit={toggleSplitView}
        />
        <div className="flex-1 overflow-hidden flex flex-col">
          {renderTabContent(activePrimaryTab)}
        </div>
      </div>

      {/* Resizable Divider Handle */}
      {splitView && (
        <div
          onMouseDown={handleMouseDown}
          className="w-1.5 h-full hover:bg-emerald-500 cursor-col-resize flex items-center justify-center transition-colors group z-20"
          style={{ backgroundColor: 'var(--border-color)' }}
          title="Kéo thả để thay đổi tỉ lệ phân tách màn hình"
        >
          <div className="w-0.5 h-8 bg-muted group-hover:bg-white rounded-full transition-colors" />
        </div>
      )}

      {/* Secondary Split Pane */}
      {splitView && (
        <div
          className="h-full flex flex-col min-w-0 animate-in slide-in-from-right-4 duration-150"
          style={{
            width: `${100 - primaryWidthPercent}%`,
          }}
        >
          <TabBar
            pane="secondary"
            tabs={secondaryTabs.length > 0 ? secondaryTabs : [activeSecondaryTab]}
            activeTabId={activeSecondaryTab?.id || null}
            onSelectTab={(id) => setActiveTab(id, 'secondary')}
            onCloseTab={closeTab}
          />
          <div className="flex-1 overflow-hidden flex flex-col">
            {renderTabContent(activeSecondaryTab)}
          </div>
        </div>
      )}
    </div>
  );
};
