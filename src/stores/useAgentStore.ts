import { create } from 'zustand';
import { InlineDiffProposal, McpToolExecutionLog } from '@/lib/tauri-bridge';

export interface ComposerChatMessage {
  id: string;
  role: 'user' | 'assistant';
  agent: 'Story Composer' | 'Cline' | 'OpenCode' | 'Antigravity';
  content: string;
  timestamp: string;
  attachedDiffId?: string;
}

interface AgentStoreState {
  activeRightTab: 'composer' | 'agents' | 'mcp';
  selectedModel: string;
  pinnedContextIds: string[];
  apiKey: string;
  ollamaEndpoint: string;
  agentWritingLock: boolean;
  agentLockTarget: string | null;

  diffProposals: InlineDiffProposal[];
  composerMessages: ComposerChatMessage[];
  mcpLogs: McpToolExecutionLog[];

  // Actions
  setActiveRightTab: (tab: 'composer' | 'agents' | 'mcp') => void;
  setSelectedModel: (model: string) => void;
  setApiKey: (key: string) => void;
  setOllamaEndpoint: (endpoint: string) => void;
  togglePinnedContext: (id: string) => void;
  clearMessages: () => void;
  addDiffProposal: (proposal: InlineDiffProposal) => void;
  resolveDiffProposal: (proposalId: string, decision: 'accepted' | 'rejected') => void;
  resolveAllDiffsForChapter: (
    chapterId: string,
    decision: 'accepted' | 'rejected'
  ) => void;
  sendComposerPrompt: (
    prompt: string,
    chapterId: string,
    targetParagraphIdx: number,
    currentParagraphText: string
  ) => void;
  triggerMcpToolSimulation: (
    toolName: McpToolExecutionLog['tool_name'],
    agentName: McpToolExecutionLog['agent_name'],
    argsSummary: string,
    resultSummary: string
  ) => void;
}

export const useAgentStore = create<AgentStoreState>((set) => ({
  activeRightTab: 'composer',
  selectedModel: 'Claude 3.7 Sonnet (MCP Bridge)',
  pinnedContextIds: ['char_linh_001', 'loc_cang_dong', 'ch_07'],
  apiKey: '',
  ollamaEndpoint: 'http://localhost:11434',
  agentWritingLock: false,
  agentLockTarget: null,

  diffProposals: [
    {
      id: 'diff-init-ch08-p2',
      agent_name: 'Antigravity',
      chapter_id: 'ch_08',
      paragraph_index: 2,
      original_text:
        'Cô bước lùi lại phía sau thùng hàng, cố giữ nhịp thở ổn định trong khi tín hiệu từ Ổ Khóa Lượng Tử Thần Nông bắt đầu phát sáng dưới lớp áo khoác.',
      proposed_text:
        'Linh lách người nấp sau thùng hàng rỉ sét, hơi thở dồn dập hòa vào tiếng mưa quất trên mái tôn trong khi Ổ Khóa Lượng Tử Thần Nông rung lên từng nhịp đỏ rực dưới lớp áo khoác chống thấm.',
      rationale:
        'Tăng nhịp độ dồn dập (Show, Don\'t Tell), bổ sung chi tiết xúc giác & thính giác phù hợp bối cảnh đêm mưa tại Bến Cảng Đông.',
      created_at: '23:54',
      status: 'pending',
    },
  ],

  composerMessages: [
    {
      id: 'msg-1',
      role: 'user',
      agent: 'OpenCode',
      content:
        'Viết tiếp cảnh đối đầu tại Bến Cảng Đông nhưng giữ nhịp độ dồn dập, ít mô tả rườm rà và kiểm tra tính nhất quán với Chương 5.',
      timestamp: '23:53',
    },
    {
      id: 'msg-2',
      role: 'assistant',
      agent: 'Antigravity',
      content:
        'Đã tra cứu Lorebook (`@Lâm Vũ Linh`, `#Bến_Cảng_Đông`) và chạy `novel_check_continuity`: Phát hiện **Trần Hạo** đã tử vong ở Chương 5 (12/10/2026). Tôi cũng đã đẩy 1 đề xuất chỉnh sửa Inline Diff tại đoạn 3 để tăng nhịp độ kịch tính.',
      timestamp: '23:54',
      attachedDiffId: 'diff-init-ch08-p2',
    },
  ],

  mcpLogs: [
    {
      id: 'mcp-log-1',
      timestamp: '23:52:10',
      agent_name: 'Antigravity',
      tool_name: 'novel_search_lore',
      args_summary: 'query="Lâm Vũ Linh, Trần Hạo", entity_type="character"',
      result_summary: 'Returned 2 character profiles (Hybrid BM25 + sqlite-vec score 0.96)',
      latency_ms: 4,
    },
    {
      id: 'mcp-log-2',
      timestamp: '23:53:02',
      agent_name: 'OpenCode',
      tool_name: 'novel_get_chapter_context',
      args_summary: 'chapter_id="ch_08", window_size=2',
      result_summary: 'Loaded Ch.08 + summaries of Ch.05 & Ch.07',
      latency_ms: 6,
    },
    {
      id: 'mcp-log-3',
      timestamp: '23:53:48',
      agent_name: 'Cline',
      tool_name: 'novel_check_continuity',
      args_summary: 'chapter_id="ch_08", draft_text="...Trần Hạo lại xuất hiện..."',
      result_summary: '1 Error (DEAD_CHARACTER: Trần Hạo died in Ch.05), 1 Warning (Repetition)',
      latency_ms: 2,
    },
    {
      id: 'mcp-log-4',
      timestamp: '23:54:05',
      agent_name: 'Antigravity',
      tool_name: 'novel_propose_edit',
      args_summary: 'file_path="manuscript/act-01/ch-08-dem-mua-ben-cang.md", line=3',
      result_summary: 'Inline Diff queued in TipTap Editor (diff-init-ch08-p2)',
      latency_ms: 3,
    },
  ],

  setActiveRightTab: (tab) => set({ activeRightTab: tab }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setApiKey: (apiKey) => set({ apiKey }),
  setOllamaEndpoint: (ollamaEndpoint) => set({ ollamaEndpoint }),

  togglePinnedContext: (id) =>
    set((state) => ({
      pinnedContextIds: state.pinnedContextIds.includes(id)
        ? state.pinnedContextIds.filter((item) => item !== id)
        : [...state.pinnedContextIds, id],
    })),

  clearMessages: () => set({ composerMessages: [] }),

  addDiffProposal: (proposal) =>
    set((state) => ({
      diffProposals: [proposal, ...state.diffProposals],
    })),

  resolveDiffProposal: (proposalId, decision) =>
    set((state) => ({
      diffProposals: state.diffProposals.map((d) =>
        d.id === proposalId ? { ...d, status: decision } : d
      ),
    })),

  resolveAllDiffsForChapter: (chapterId, decision) =>
    set((state) => ({
      diffProposals: state.diffProposals.map((d) =>
        d.chapter_id === chapterId && d.status === 'pending'
          ? { ...d, status: decision }
          : d
      ),
    })),

  sendComposerPrompt: (
    prompt,
    chapterId,
    targetParagraphIdx,
    currentParagraphText
  ) =>
    set((state) => {
      const userMsg: ComposerChatMessage = {
        id: `msg-u-${Date.now()}`,
        role: 'user',
        agent: 'Story Composer',
        content: prompt,
        timestamp: new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      const newDiffId = `diff-${Date.now()}`;
      const lower = prompt.toLowerCase();

      // Advanced Literary Heuristic Generator tailored to prompt intent
      let proposedText = '';
      let rationale = '';

      if (lower.includes('show') || lower.includes('ngũ quan') || lower.includes('miêu tả')) {
        proposedText = currentParagraphText
          ? `${currentParagraphText} Lớp sương muối mặn chát đọng trên gò má, từng giọt nước buốt lạnh nhỏ từ gọng kính trượt xuống khóe môi. Tiếng sóng vỗ ầm ầm vào chân cầu tàu rỉ sét át đi tiếng lên đạn lách cách đằng sau thùng gỗ mun.`
          : 'Mùi rỉ sét nồng nặc bốc lên từ các khớp nối cẩu trục cũ kỹ. Gió quất từng cơn buốt nhói vào sống mũi, tiếng dây cáp thép va đập leng keng trong bóng tối như nhịp đếm ngược của một vụ nổ ngầm.';
        rationale = 'Áp dụng kỹ thuật Show, Don\'t Tell: Bổ sung chi tiết thị giác, thính giác, xúc giác (vị mặn, sương buốt, tiếng kim loại va đập) để tăng độ chân thực cho phân cảnh.';
      } else if (lower.includes('đối thoại') || lower.includes('thoại') || lower.includes('nói')) {
        proposedText = currentParagraphText
          ? `${currentParagraphText}\n\n"Cô nghĩ mình thoát được khỏi Cảng Đông sao, Tiểu Linh?" Giọng nói khàn đặc vang lên sau màn mưa, kèm theo tiếng chốt an toàn kim loại bật mở dứt khoát.`
          : '"Giao Lõi Thần Nông ra đây," bóng người trong áo măng tô xám lạnh lùng cất tiếng. "Cô không thể chạy đua với toàn bộ mạng lưới truy kích của Aegis."';
        rationale = 'Tạo nhịp đối thoại sắc sảo, đe dọa trực diện, phù hợp phong cách tiểu thuyết trinh thám hình sự cyberpunk.';
      } else if (lower.includes('check') || lower.includes('kiểm tra') || lower.includes('continuity')) {
        proposedText = currentParagraphText;
        rationale = 'Đã quét toàn bộ thực thể trong phân cảnh: Đảm bảo nhân vật chính Lâm Vũ Linh giữ đúng góc nhìn POV, các thực thể địa danh và vật phẩm hoàn toàn ăn khớp với hồ sơ thế giới quan.';
      } else {
        // Fast-paced action
        proposedText = currentParagraphText
          ? `${currentParagraphText} Ánh đèn pha từ tàu tuần tra bất ngờ quét ngang mặt nước đen ngòm. Lâm Vũ Linh lộn một vòng trên mặt bê tông ướt sũng, khóa chốt an toàn và ném thiết bị gây nhiễu sóng về phía chân cầu tàu số 9.`
          : 'Tiếng bước chân dồn dập vang vọng giữa hai dãy container số 14. Lâm Vũ Linh nín thở, ngón trỏ đặt hờ lên cò súng giảm thanh khi bóng người mặc áo choàng đen dừng lại cách cô chưa đầy năm bước chân.';
        rationale = `Phản hồi yêu cầu: "${prompt}" — Bổ sung nhịp điệu hành động dồn dập, xử lý dứt khoát theo góc nhìn POV của Lâm Vũ Linh.`;
      }

      const newDiff: InlineDiffProposal = {
        id: newDiffId,
        agent_name: 'Story Composer',
        chapter_id: chapterId,
        paragraph_index: targetParagraphIdx,
        original_text: currentParagraphText,
        proposed_text: proposedText,
        rationale,
        created_at: new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        status: 'pending',
      };

      const assistantMsg: ComposerChatMessage = {
        id: `msg-a-${Date.now() + 1}`,
        role: 'assistant',
        agent: 'Story Composer',
        content: `[Mô phỏng mẫu cục bộ] Đã phân tích yêu cầu sáng tác cùng ${state.pinnedContextIds.length} thực thể đang ghim. Tôi vừa tạo đề xuất **Inline Diff** tại đoạn ${
          targetParagraphIdx + 1
        }:\n\n> *"${rationale}"*\n\nBạn có thể bấm **[Chấp nhận (Tab)]** hoặc **[Từ chối (Esc)]** ngay trên trình soạn thảo.`,
        timestamp: new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        attachedDiffId: newDiffId,
      };

      // No fabricated MCP log: the Composer is a local template, not an MCP call.
      return {
        composerMessages: [...state.composerMessages, userMsg, assistantMsg],
        diffProposals: [newDiff, ...state.diffProposals],
      };
    }),

  triggerMcpToolSimulation: (toolName, agentName, argsSummary, resultSummary) =>
    set((state) => ({
      mcpLogs: [
        {
          id: `mcp-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('vi-VN'),
          agent_name: agentName,
          tool_name: toolName,
          args_summary: argsSummary,
          result_summary: resultSummary,
          latency_ms: Math.floor(Math.random() * 5) + 2,
        },
        ...state.mcpLogs,
      ],
    })),
}));
