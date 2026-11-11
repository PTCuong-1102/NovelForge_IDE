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
import { Share2, Clock, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { CharacterRelationEdge, LoreEntity } from '@/lib/tauri-bridge';

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
  const {
    chapters,
    entities,
    relations,
    openTab,
    addRelation,
    removeRelation,
  } = useWorkspaceStore();

  const maxChapter = useMemo(
    () =>
      Math.max(
        1,
        chapters.reduce((max, c) => Math.max(max, c.order), chapters.length),
        relations.reduce(
          (max, r) => Math.max(max, r.max_chapter ?? r.min_chapter),
          1
        )
      ),
    [chapters, relations]
  );

  const [chapterFilter, setChapterFilter] = useState(() =>
    Math.min(8, maxChapter)
  );
  const effectiveChapterFilter = Math.min(chapterFilter, maxChapter);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [newTargetId, setNewTargetId] = useState('');
  const [newRelationType, setNewRelationType] =
    useState<CharacterRelationEdge['relation_type']>('ally');
  const [newRelationLabel, setNewRelationLabel] = useState('');

  const characters = useMemo(
    () => entities.filter((e) => e.entity_type === 'character'),
    [entities]
  );

  // The graph protagonist is the first character of the project, never a fixed id.
  const centerCharacterId = characters[0]?.id;

  const selectedEntity =
    characters.find((c) => c.id === selectedNodeId) || characters[0];

  // Filter edges according to chapter slider
  const activeRelations = useMemo(
    () =>
      relations.filter(
        (r) =>
          r.min_chapter <= effectiveChapterFilter &&
          (!r.max_chapter || r.max_chapter >= effectiveChapterFilter)
      ),
    [relations, effectiveChapterFilter]
  );

  // Position nodes in an aesthetic circular/force layout
  const nodes: Node<CharacterNodeData>[] = useMemo(() => {
    const centerChar =
      characters.find((c) => c.id === centerCharacterId) || characters[0];
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
        effectiveChapterFilter >= ch.death_chapter_order;

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
  }, [characters, centerCharacterId, selectedNodeId, effectiveChapterFilter]);

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
          <span className="font-bold text-accent">
            Chương {effectiveChapterFilter} / {maxChapter}
          </span>
          <input
            type="range"
            min={1}
            max={maxChapter}
            value={effectiveChapterFilter}
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
                node.id === centerCharacterId ? '#10B981' : '#3B82F6'
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
                  Quan Hệ Tại Mốc Chương {effectiveChapterFilter}:
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
                          className="p-2.5 rounded-xl bg-elevated border border-border flex items-center justify-between gap-2"
                        >
                          <span className="font-bold text-primary truncate">
                            {other?.title || 'Ẩn'}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
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
                            <button
                              onClick={() => removeRelation(rel.id)}
                              title="Xóa mối quan hệ này"
                              className="p-1 rounded hover:bg-canvas text-muted hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Add Relation Form */}
                {characters.filter((c) => c.id !== selectedEntity.id).length >
                  0 && (
                  <div className="mt-4 pt-3 border-t border-border space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
                      Thêm Quan Hệ Mới:
                    </span>
                    <select
                      value={newTargetId}
                      onChange={(e) => setNewTargetId(e.target.value)}
                      className="w-full bg-elevated border border-border rounded-lg px-2 py-1.5 text-primary text-xs focus:outline-none focus:border-accent"
                    >
                      <option value="">-- Chọn nhân vật đích --</option>
                      {characters
                        .filter((c) => c.id !== selectedEntity.id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                    </select>
                    <div className="flex gap-1.5">
                      <select
                        value={newRelationType}
                        onChange={(e) =>
                          setNewRelationType(
                            e.target.value as CharacterRelationEdge['relation_type']
                          )
                        }
                        className="bg-elevated border border-border rounded-lg px-2 py-1.5 text-primary text-xs focus:outline-none focus:border-accent"
                      >
                        <option value="ally">Đồng minh</option>
                        <option value="enemy">Kẻ thù</option>
                        <option value="mentor">Sư phụ / Tiền bối</option>
                        <option value="betrayal">Phản bội</option>
                        <option value="romance">Tình cảm</option>
                      </select>
                      <input
                        type="text"
                        value={newRelationLabel}
                        onChange={(e) => setNewRelationLabel(e.target.value)}
                        placeholder="Nhãn (VD: Đồng đội)"
                        className="flex-1 min-w-0 bg-elevated border border-border rounded-lg px-2 py-1.5 text-primary text-xs focus:outline-none focus:border-accent"
                      />
                    </div>
                    <button
                      onClick={() => {
                        const target =
                          newTargetId ||
                          characters.find((c) => c.id !== selectedEntity.id)?.id;
                        if (!target) return;
                        const defaultLabels: Record<
                          CharacterRelationEdge['relation_type'],
                          string
                        > = {
                          ally: 'Đồng minh',
                          enemy: 'Kẻ thù',
                          mentor: 'Tiền bối',
                          betrayal: 'Phản bội',
                          romance: 'Tình cảm',
                        };
                        addRelation({
                          source_id: selectedEntity.id,
                          target_id: target,
                          relation_type: newRelationType,
                          label:
                            newRelationLabel.trim() ||
                            defaultLabels[newRelationType],
                          min_chapter: 1,
                          max_chapter: Math.max(20, maxChapter),
                        });
                        setNewRelationLabel('');
                      }}
                      disabled={!newTargetId}
                      className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                    >
                      <Plus size={13} />
                      <span>Thêm liên kết</span>
                    </button>
                  </div>
                )}
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
