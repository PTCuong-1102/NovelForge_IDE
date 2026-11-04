'use client';

import React, { useState, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  Node,
  Edge,
  MarkerType,
  Handle,
  Position,
  NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Share2, Clock, ChevronRight } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { LoreEntity } from '@/lib/tauri-bridge';

interface CharacterNodeData extends Record<string, unknown> {
  entity: LoreEntity;
  isDead: boolean;
  role: string;
  faction: string;
  selected: boolean;
  onSelect: (id: string) => void;
}

const CharacterNode: React.FC<NodeProps<Node<CharacterNodeData>>> = ({
  data,
}) => {
  const { entity, isDead, role, faction, selected, onSelect } = data;

  return (
    <div
      onClick={() => onSelect(entity.id)}
      className={`relative px-4 py-3 rounded-2xl shadow-lg border-2 transition-all cursor-pointer min-w-[175px] select-none ${
        selected
          ? 'border-emerald-500 ring-2 ring-emerald-500/30 scale-105'
          : isDead
          ? 'border-red-500/70'
          : 'border-border hover:border-emerald-500'
      }`}
      style={{
        backgroundColor: 'var(--bg-paper)',
        color: 'var(--text-primary)',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-emerald-500 !w-2 !h-2"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-emerald-500 !w-2 !h-2"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-emerald-500 !w-2 !h-2"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-emerald-500 !w-2 !h-2"
      />

      <div className="flex items-center gap-2.5">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow ${
            isDead ? 'bg-red-600' : 'bg-emerald-600'
          }`}
        >
          {entity.title.slice(0, 2).toUpperCase()}
        </div>
        <div className="overflow-hidden">
          <div className="font-bold text-xs truncate max-w-[105px] text-primary">
            {entity.title}
          </div>
          <div className="text-[11px] text-muted truncate max-w-[105px]">
            {role || 'Nhân vật'}
          </div>
        </div>
      </div>

      <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between text-[10px]">
        <span className="text-muted font-medium truncate max-w-[85px]">
          {faction || 'Trung lập'}
        </span>
        <span
          className={`px-1.5 py-0.5 rounded border font-semibold ${
            isDead ? 'semantic-error-box' : 'semantic-success-box'
          }`}
        >
          {isDead ? 'Tử vong' : 'Còn sống'}
        </span>
      </div>
    </div>
  );
};

const nodeTypes = {
  characterNode: CharacterNode,
};

export const RelationshipGraph: React.FC = () => {
  const { entities, relations, openTab } = useWorkspaceStore();
  const [chapterFilter, setChapterFilter] = useState(8);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    'char_linh_001'
  );

  const characters = useMemo(
    () => entities.filter((e) => e.entity_type === 'character'),
    [entities]
  );

  const selectedEntity = characters.find((c) => c.id === selectedNodeId);

  // Filter edges according to chapter slider
  const activeRelations = useMemo(
    () =>
      relations.filter(
        (r) =>
          r.min_chapter <= chapterFilter &&
          (!r.max_chapter || r.max_chapter >= chapterFilter)
      ),
    [relations, chapterFilter]
  );

  // Position nodes in an aesthetic circular/force layout
  const nodes: Node<CharacterNodeData>[] = useMemo(() => {
    const centerIdx = characters.findIndex((c) => c.id === 'char_linh_001');
    const centerChar = characters[centerIdx] || characters[0];
    const otherChars = characters.filter((c) => c.id !== centerChar?.id);

    const result: Node<CharacterNodeData>[] = [];

    // Center protagonist
    if (centerChar) {
      result.push({
        id: centerChar.id,
        type: 'characterNode',
        position: { x: 380, y: 260 },
        data: {
          entity: centerChar,
          isDead: centerChar.status === 'dead',
          role: centerChar.role || 'Protagonist',
          faction: centerChar.faction || 'Aegis',
          selected: selectedNodeId === centerChar.id,
          onSelect: (id) => setSelectedNodeId(id),
        },
      });
    }

    // Other characters around
    const radius = 250;
    otherChars.forEach((ch, idx) => {
      const angle =
        (idx * (2 * Math.PI)) / Math.max(1, otherChars.length) - Math.PI / 2;
      const x = 380 + radius * Math.cos(angle);
      const y = 260 + radius * Math.sin(angle);

      const isDead =
        ch.status === 'dead' &&
        ch.death_chapter_order !== undefined &&
        chapterFilter >= ch.death_chapter_order;

      result.push({
        id: ch.id,
        type: 'characterNode',
        position: { x, y },
        data: {
          entity: ch,
          isDead,
          role: ch.role || '',
          faction: ch.faction || '',
          selected: selectedNodeId === ch.id,
          onSelect: (id) => setSelectedNodeId(id),
        },
      });
    });

    return result;
  }, [characters, selectedNodeId, chapterFilter]);

  // Edges mapped to React Flow specification
  const edges: Edge[] = useMemo(() => {
    return activeRelations.map((rel) => {
      const isBetrayal = rel.relation_type === 'betrayal';
      const isEnemy = rel.relation_type === 'enemy';
      const isMentor = rel.relation_type === 'mentor';

      const strokeColor = isBetrayal
        ? '#D97706'
        : isEnemy
        ? '#DC2626'
        : isMentor
        ? '#2563EB'
        : '#059669';

      return {
        id: rel.id,
        source: rel.source_id,
        target: rel.target_id,
        label: rel.label,
        type: 'smoothstep',
        animated: rel.relation_type === 'ally',
        style: {
          stroke: strokeColor,
          strokeWidth: 2,
        },
        labelStyle: {
          fill: 'var(--text-primary)',
          fontWeight: 600,
          fontSize: 11,
        },
        labelBgStyle: {
          fill: 'var(--bg-elevated)',
          fillOpacity: 0.95,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
          width: 16,
          height: 16,
        },
      };
    });
  }, [activeRelations]);

  return (
    <div
      className="flex-1 h-full flex flex-col select-none overflow-hidden"
      style={{ backgroundColor: 'var(--bg-canvas)' }}
    >
      {/* Top Controls Bar */}
      <div
        className="p-3 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-xs"
        style={{
          backgroundColor: 'var(--bg-panel)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="flex items-center gap-2">
          <Share2 size={16} className="semantic-success-text" />
          <span className="font-bold text-primary">
            Sơ Đồ Mối Quan Hệ Nhân Vật (React Flow Graph)
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-md border semantic-success-box font-semibold">
            @xyflow/react Engine
          </span>
        </div>

        {/* Timeline Slider */}
        <div className="flex items-center gap-3 bg-elevated px-3 py-1.5 rounded-xl border border-border">
          <Clock size={13} className="text-muted" />
          <span className="text-muted font-medium">Trục thời gian:</span>
          <span className="font-bold text-accent">Chương {chapterFilter}</span>
          <input
            type="range"
            min={1}
            max={20}
            value={chapterFilter}
            onChange={(e) => setChapterFilter(Number(e.target.value))}
            className="w-36 accent-emerald-600 cursor-pointer"
          />
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 relative flex">
        <div className="flex-1 h-full relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.2}
            maxZoom={2}
            className="bg-canvas"
          >
            <Background color="var(--border-color)" gap={20} size={1.5} />
            <Controls className="!bg-elevated !border-border !fill-primary [&>button]:!bg-elevated [&>button]:!border-border [&>button]:!fill-primary hover:[&>button]:!bg-canvas" />
            <MiniMap
              nodeStrokeWidth={3}
              zoomable
              pannable
              className="!bg-panel !border-border !rounded-xl overflow-hidden"
              nodeColor={(node) =>
                node.id === 'char_linh_001' ? '#10B981' : '#3B82F6'
              }
            />
          </ReactFlow>
        </div>

        {/* Right Info Drawer */}
        {selectedEntity && (
          <div
            className="w-84 h-full border-l p-4 flex flex-col justify-between text-xs select-text overflow-y-auto"
            style={{
              backgroundColor: 'var(--bg-panel)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Chi Tiết Thực Thể Đang Chọn
                </span>
                <button
                  onClick={() =>
                    openTab({
                      id: `tab-char-${selectedEntity.id}`,
                      title: selectedEntity.title,
                      type: 'lore-entity',
                      targetId: selectedEntity.id,
                    })
                  }
                  className="text-accent hover:underline flex items-center gap-1 font-bold"
                >
                  Mở hồ sơ <ChevronRight size={12} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-primary">
                  {selectedEntity.title}
                </h2>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
                    selectedEntity.status === 'dead'
                      ? 'semantic-error-box'
                      : 'semantic-success-box'
                  }`}
                >
                  {selectedEntity.status === 'dead'
                    ? 'Đã tử vong'
                    : 'Còn sống'}
                </span>
              </div>
              <div className="text-muted text-xs mt-0.5 font-medium">
                {selectedEntity.role}
              </div>

              <div className="space-y-2 mt-4 text-xs text-muted">
                <div>
                  <strong className="text-primary">Ngoại hình:</strong>{' '}
                  {selectedEntity.appearance}
                </div>
                <div>
                  <strong className="text-primary">Tính cách:</strong>{' '}
                  {selectedEntity.personality}
                </div>
                <div>
                  <strong className="text-primary">Phe phái:</strong>{' '}
                  {selectedEntity.faction}
                </div>
              </div>

              {/* Active Relations */}
              <div className="mt-5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-2">
                  Quan Hệ Tại Mốc Chương {chapterFilter}:
                </span>
                <div className="space-y-2">
                  {activeRelations
                    .filter(
                      (r) =>
                        r.source_id === selectedEntity.id ||
                        r.target_id === selectedEntity.id
                    )
                    .map((rel) => {
                      const otherId =
                        rel.source_id === selectedEntity.id
                          ? rel.target_id
                          : rel.source_id;
                      const other = characters.find((c) => c.id === otherId);

                      return (
                        <div
                          key={rel.id}
                          className="p-2.5 rounded-xl bg-elevated border border-border flex items-center justify-between"
                        >
                          <span className="font-bold text-primary">
                            {other?.title || 'Ẩn'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${
                              rel.relation_type === 'enemy'
                                ? 'semantic-error-box'
                                : rel.relation_type === 'mentor'
                                ? 'semantic-info-box'
                                : rel.relation_type === 'betrayal'
                                ? 'semantic-warning-box'
                                : 'semantic-success-box'
                            }`}
                          >
                            {rel.label}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-elevated border border-border text-[11px] text-muted leading-relaxed">
              Kéo thanh trượt thời gian để theo dõi diễn biến liên minh, đối đầu
              và sinh tử qua từng hồi truyện theo chuẩn React Flow.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
