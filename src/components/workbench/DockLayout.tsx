'use client';

import React from 'react';
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
    <div className="flex-1 h-full flex overflow-hidden">
      {/* Primary Pane */}
      <div className="flex-1 h-full flex flex-col min-w-0 border-r border-border/40">
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

      {/* Secondary Split Pane */}
      {splitView && (
        <div className="flex-1 h-full flex flex-col min-w-0 animate-in slide-in-from-right-4 duration-150">
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
