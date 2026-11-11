import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { ContinuityIssue, LoreEntity } from '@/lib/tauri-bridge';
import { findWholeWordOccurrences } from '@/lib/word-boundary';

export interface EntityHighlighterOptions {
  getEntities: () => LoreEntity[];
  getIssues: () => ContinuityIssue[];
  onEntityClick?: (entity: LoreEntity, event: MouseEvent) => void;
  onIssueClick?: (issue: ContinuityIssue, event: MouseEvent) => void;
  onParagraphFocusChange?: (paragraphIndex: number) => void;
}

export const entityHighlighterPluginKey = new PluginKey('novelforgeEntityHighlighter');

interface PatternSpec {
  token: string;
  entity: LoreEntity;
}

export const EntityAndLinterExtension = Extension.create<EntityHighlighterOptions>({
  name: 'entityAndLinterHighlighter',

  addOptions() {
    return {
      getEntities: () => [],
      getIssues: () => [],
      onEntityClick: undefined,
      onIssueClick: undefined,
      onParagraphFocusChange: undefined,
    };
  },

  addProseMirrorPlugins() {
    const extOptions = this.options;

    return [
      new Plugin({
        key: entityHighlighterPluginKey,

        props: {
          decorations(state) {
            const entities = extOptions.getEntities() || [];
            const issues = extOptions.getIssues() || [];
            const decorations: Decoration[] = [];

            const patterns: PatternSpec[] = [];
            for (const ent of entities) {
              if (ent.entity_type === 'chapter') continue;
              if (ent.title.trim()) {
                patterns.push({
                  token: ent.title.trim(),
                  entity: ent,
                });
              }
              for (const alias of ent.aliases || []) {
                if (alias.trim()) {
                  patterns.push({
                    token: alias.trim(),
                    entity: ent,
                  });
                }
              }
            }
            // Match longest entity names first (e.g. "Lâm Vũ Linh" before "Linh")
            patterns.sort((a, b) => b.token.length - a.token.length);

            let blockIndex = 0;

            state.doc.descendants((node, pos) => {
              if (!node.isTextblock) return true;

              const currentParaIdx = blockIndex;
              blockIndex += 1;

              const text = node.textContent;
              if (!text) return false;

              const trimmed = text.trim();

              // 1. Decorate special literary blocks (Author Note & Scene Break)
              if (trimmed.startsWith('> [!GHI_CHÚ_TÁC_GIẢ]')) {
                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    class: 'semantic-info-box rounded-xl px-3.5 py-2.5 my-2 border-l-4 font-sans text-xs',
                    style: 'text-indent: 0;',
                  })
                );
              } else if (trimmed === '***' || trimmed === '* * *') {
                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    class: 'text-center my-3 tracking-[0.5em] text-muted font-bold select-none',
                    style: 'text-indent: 0;',
                  })
                );
              }

              const occupiedRanges: [number, number][] = [];

              // 2. Decorate Continuity Linter issues in this paragraph first
              const paraIssues = issues.filter((iss) => iss.paragraph_index === currentParaIdx);
              for (const iss of paraIssues) {
                const needle = iss.matched_text.trim();
                if (!needle) continue;

                for (const [idx, endIdx] of findWholeWordOccurrences(text, needle, true)) {
                  const fromPos = pos + 1 + idx;
                  const toPos = pos + 1 + endIdx;

                  if (toPos <= pos + node.nodeSize) {
                    occupiedRanges.push([idx, endIdx]);
                    decorations.push(
                      Decoration.inline(fromPos, toPos, {
                        class:
                          iss.severity === 'error'
                            ? 'linter-squiggly-error'
                            : 'linter-squiggly-warning',
                        'data-issue-id': iss.id,
                        title: `${iss.message} (Nhấp để mở giải pháp nhanh)`,
                      })
                    );
                  }
                }
              }

              // 3. Decorate Lorebook Entities (@Character, #Location, @Item)
              for (const pat of patterns) {
                for (const [idx, endIdx] of findWholeWordOccurrences(text, pat.token, true)) {
                  const overlaps = occupiedRanges.some(
                    ([s, e]) => !(endIdx <= s || idx >= e)
                  );
                  if (overlaps) continue;

                  const fromPos = pos + 1 + idx;
                  const toPos = pos + 1 + endIdx;
                  if (toPos > pos + node.nodeSize) continue;

                  occupiedRanges.push([idx, endIdx]);
                  const isLoc = pat.entity.entity_type === 'location';
                  decorations.push(
                    Decoration.inline(fromPos, toPos, {
                      class: isLoc ? 'lore-location-pill' : 'entity-mention-pill',
                      'data-entity-id': pat.entity.id,
                      title: `Lorebook: ${pat.entity.title} — Nhấp để xem hồ sơ nhanh`,
                    })
                  );
                }
              }

              return false;
            });

            return DecorationSet.create(state.doc, decorations);
          },

          handleDOMEvents: {
            click(_view, event) {
              const target = event.target as HTMLElement | null;
              if (!target) return false;

              const issueEl = target.closest('[data-issue-id]') as HTMLElement | null;
              if (issueEl && extOptions.onIssueClick) {
                const issueId = issueEl.getAttribute('data-issue-id');
                const foundIssue = extOptions
                  .getIssues()
                  .find((i) => i.id === issueId);
                if (foundIssue) {
                  event.stopPropagation();
                  extOptions.onIssueClick(foundIssue, event);
                  return true;
                }
              }

              const entityEl = target.closest('[data-entity-id]') as HTMLElement | null;
              if (entityEl && extOptions.onEntityClick) {
                const entityId = entityEl.getAttribute('data-entity-id');
                const foundEntity = extOptions
                  .getEntities()
                  .find((e) => e.id === entityId);
                if (foundEntity) {
                  event.stopPropagation();
                  extOptions.onEntityClick(foundEntity, event);
                  return true;
                }
              }

              return false;
            },
          },
        },
      }),
    ];
  },
});

