import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { ChapterDocument, LoreEntity } from '@/lib/tauri-bridge';

export interface AiGhostTextOptions {
  isEnabled: () => boolean;
  getSuggestion: (paragraphText: string, paragraphIndex: number) => string | null;
  onAcceptSuggestion?: (suggestion: string, paragraphIndex: number) => void;
  onCycleSuggestion?: () => void;
  onDismissSuggestion?: () => void;
}

export const aiGhostTextPluginKey = new PluginKey('novelforgeAiGhostText');

/**
 * Synthesizes a context-aware literary continuation (Ghost Text) grounded in the active
 * chapter's POV character, location, and Lorebook entities.
 */
export function buildContextualGhostSuggestion(
  paragraphText: string,
  chapter: ChapterDocument,
  entities: LoreEntity[],
  variantIndex = 0
): string {
  const trimmed = paragraphText.trim();
  if (!trimmed || trimmed === '***' || trimmed.startsWith('> [!GHI_CHÚ_TÁC_GIẢ]')) {
    return '';
  }

  const lower = trimmed.toLowerCase();
  const povName = chapter.pov_character_name || 'nhân vật chính';
  const locName = chapter.location_tag?.replace(/^#/, '') || 'bối cảnh hiện tại';

  // Detect mentioned Lorebook entities in the current paragraph for grounded RAG context
  const mentionedChar = entities.find(
    (e) =>
      e.entity_type === 'character' &&
      (lower.includes(e.title.toLowerCase()) ||
        e.aliases?.some((a) => lower.includes(a.toLowerCase())))
  );
  const mentionedItem = entities.find(
    (e) =>
      e.entity_type === 'item' &&
      (lower.includes(e.title.toLowerCase()) ||
        e.aliases?.some((a) => lower.includes(a.toLowerCase())))
  );

  const candidates: string[] = [];

  if (mentionedItem) {
    candidates.push(
      ` Ánh sáng lam lạnh từ ${mentionedItem.title} khẽ nhấp nháy, phản chiếu lên đôi mắt cảnh giác của ${povName}.`,
      ` Tín hiệu mã hóa từ ${mentionedItem.title} bất ngờ rung lên từng hồi gấp gáp giữa không gian tĩnh lặng của ${locName}.`,
      ` ${povName} siết chặt ${mentionedItem.title} trong lòng bàn tay, cảm nhận luồng nhiệt lượng tử đang tăng dần.`
    );
  } else if (mentionedChar && mentionedChar.title !== povName) {
    candidates.push(
      ` ${mentionedChar.title} khẽ nghiêng đầu, ánh nhìn sắc lạnh xuyên qua màn sương mờ đặc quánh của ${locName}.`,
      ` Trước thái độ dè chừng của ${mentionedChar.title}, ${povName} lập tức lùi nửa bước về phía góc khuất hành lang.`,
      ` Giọng nói trầm đục của ${mentionedChar.title} vang vọng như một lời cảnh báo không thể khước từ.`
    );
  } else if (trimmed.startsWith('—') || trimmed.startsWith('"') || trimmed.startsWith('“')) {
    candidates.push(
      ` — Câu nói vừa dứt, chỉ còn tiếng mưa axit gõ nhịp đều đặn lên mái vòm kim loại của ${locName}.`,
      ` ${povName} khẽ mím môi, ngón tay vô thức chạm vào vòng giải mã nơi cổ tay trái.`,
      ` Không một ai lên tiếng đáp lại; bầu không khí tại ${locName} như đặc quánh lại dưới ánh đèn neon nhợt nhạt.`
    );
  } else {
    candidates.push(
      ` Giữa màn sương ẩm lạnh của ${locName}, ${povName} nhận ra từng dấu vết đều dẫn về mật thất ngầm bên dưới tháp điều khiển.`,
      ` Một cơn gió lạnh thổi ngược từ phía vịnh cảng mang theo mùi rỉ sét và nhịp rung âm ỉ của hệ thống máy chủ ngầm.`,
      ` ${povName} hít sâu một hơi, điều chỉnh lại thị kính chiến thuật trước khi bước qua vạch ranh giới cuối cùng.`
    );
  }

  const chosen = candidates[Math.abs(variantIndex) % candidates.length];
  return chosen;
}

export const AiGhostTextExtension = Extension.create<AiGhostTextOptions>({
  name: 'aiGhostText',

  addOptions() {
    return {
      isEnabled: () => true,
      getSuggestion: () => null,
      onAcceptSuggestion: undefined,
      onCycleSuggestion: undefined,
      onDismissSuggestion: undefined,
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        if (!this.options.isEnabled()) return false;

        const { state } = editor;
        const { selection } = state;
        if (!selection.empty) return false;

        const $pos = selection.$from;
        const parentNode = $pos.parent;
        if (!parentNode.isTextblock) return false;

        // Determine current paragraph index
        let paraIdx = 0;
        let foundIdx = 0;
        state.doc.descendants((node, pos) => {
          if (!node.isTextblock) return true;
          if (pos < $pos.pos && $pos.pos <= pos + node.nodeSize) {
            foundIdx = paraIdx;
          }
          paraIdx += 1;
          return false;
        });

        const suggestion = this.options.getSuggestion(parentNode.textContent, foundIdx);
        if (!suggestion) return false;

        const endOfBlockPos = $pos.end();
        editor.commands.insertContentAt(endOfBlockPos, suggestion);
        this.options.onAcceptSuggestion?.(suggestion, foundIdx);
        return true;
      },

      'Alt-\\': () => {
        if (!this.options.isEnabled()) return false;
        this.options.onCycleSuggestion?.();
        return true;
      },

      Escape: () => {
        if (!this.options.isEnabled()) return false;
        this.options.onDismissSuggestion?.();
        return false;
      },
    };
  },

  addProseMirrorPlugins() {
    const extOptions = this.options;

    return [
      new Plugin({
        key: aiGhostTextPluginKey,

        props: {
          decorations(state) {
            if (!extOptions.isEnabled()) return DecorationSet.empty;

            const { selection } = state;
            if (!selection.empty) return DecorationSet.empty;

            const $pos = selection.$from;
            const parent = $pos.parent;
            if (!parent.isTextblock || !parent.textContent.trim()) {
              return DecorationSet.empty;
            }

            let paraIdx = 0;
            let activeParaIdx = 0;
            state.doc.descendants((node, pos) => {
              if (!node.isTextblock) return true;
              if (pos < $pos.pos && $pos.pos <= pos + node.nodeSize) {
                activeParaIdx = paraIdx;
              }
              paraIdx += 1;
              return false;
            });

            const suggestion = extOptions.getSuggestion(parent.textContent, activeParaIdx);
            if (!suggestion) return DecorationSet.empty;

            const widgetPos = $pos.end();
            const widget = Decoration.widget(
              widgetPos,
              (view) => {
                const span = document.createElement('span');
                span.className = 'ai-ghost-text-widget select-none pointer-events-auto';
                span.setAttribute('data-ghost-text', 'true');
                span.textContent = suggestion;

                const badge = document.createElement('kbd');
                badge.className = 'ai-ghost-text-badge';
                badge.textContent = 'Tab ↵';
                badge.title = 'Nhấn Tab hoặc nhấp vào đây để chèn gợi ý AI';
                badge.onmousedown = (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (view) {
                    const insertPos = view.state.selection.$from.end();
                    view.dispatch(view.state.tr.insertText(suggestion, insertPos));
                  }
                  extOptions.onAcceptSuggestion?.(suggestion, activeParaIdx);
                };

                span.appendChild(badge);
                return span;
              },
              { side: 1 }
            );

            return DecorationSet.create(state.doc, [widget]);
          },
        },
      }),
    ];
  },
});

