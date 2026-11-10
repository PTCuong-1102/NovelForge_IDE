'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Terminal,
  Cpu,
  Pin,
  Send,
  Play,
  CheckCircle,
} from 'lucide-react';
import { useAgentStore } from '@/stores/useAgentStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { isTauri, invokeSafe } from '@/lib/ipc';

export const RightDock: React.FC = () => {
  const {
    activeRightTab,
    setActiveRightTab,
    selectedModel,
    setSelectedModel,
    pinnedContextIds,
    togglePinnedContext,
    composerMessages,
    sendComposerPrompt,
    mcpLogs,
    triggerMcpToolSimulation,
  } = useAgentStore();

  const { chapters, entities, rootPath, isDemoData } = useWorkspaceStore();
  const { activeChapterId, focusedParagraphIndex } = useEditorStore();

  const [promptInput, setPromptInput] = useState('');

  const currentChapter =
    chapters.find((c) => c.id === activeChapterId) || chapters[0];
  const currentParagraphText =
    currentChapter?.paragraphs[focusedParagraphIndex] || '';

  // MCP tools run for real over IPC only when a disk-backed project is open
  // in the desktop build; otherwise buttons log clearly-labelled simulations.
  const canRunRealMcp = isTauri() && !!rootPath && !isDemoData;

  const handleToolRun = async (
    toolName:
      | 'novel_search_lore'
      | 'novel_get_chapter_context'
      | 'novel_check_continuity'
      | 'novel_propose_edit',
    args: Record<string, unknown>,
    callSummary: string
  ) => {
    if (canRunRealMcp && rootPath) {
      const res = await invokeSafe<{ status: string; payload?: unknown }>(
        'mcp_execute_tool',
        { projectRoot: rootPath, toolName, arguments: args }
      );
      const payloadText = res.ok
        ? `status=${res.data.status} · ${JSON.stringify(
            res.data.payload ?? null
          )}`
        : `ERROR · ${res.error}`;
      triggerMcpToolSimulation(
        toolName,
        'NovelForge MCP (local)',
        callSummary,
        payloadText.slice(0, 300)
      );
      return;
    }
    triggerMcpToolSimulation(
      toolName,
      'Cline',
      `[SIMULATED — không phải MCP thật] ${callSummary}`,
      'SIMULATED — không phải kết quả MCP thật'
    );
  };

  const handleSendPrompt = (text?: string) => {
    const toSend = text || promptInput;
    if (!toSend.trim()) return;

    sendComposerPrompt(
      toSend,
      currentChapter.id,
      focusedParagraphIndex,
      currentParagraphText
    );
    setPromptInput('');
  };

  return (
    <aside
      className="w-[380px] h-full flex flex-col select-none border-l text-xs z-20"
      style={{
        backgroundColor: 'var(--bg-panel)',
        borderColor: 'var(--border-color)',
      }}
    >
      {/* Top Tabs */}
      <div
        className="flex items-center justify-between border-b px-2 h-9"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveRightTab('composer')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition-colors ${
              activeRightTab === 'composer'
                ? 'bg-elevated text-primary shadow-sm border border-border/80'
                : 'text-muted hover:text-primary'
            }`}
          >
            <Sparkles size={13} className="semantic-success-text" />
            <span>Composer</span>
          </button>

          <button
            onClick={() => setActiveRightTab('agents')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition-colors ${
              activeRightTab === 'agents'
                ? 'bg-elevated text-primary shadow-sm border border-border/80'
                : 'text-muted hover:text-primary'
            }`}
          >
            <Terminal size={13} className="semantic-info-text" />
            <span>Agent Bridge</span>
          </button>

          <button
            onClick={() => setActiveRightTab('mcp')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition-colors ${
              activeRightTab === 'mcp'
                ? 'bg-elevated text-primary shadow-sm border border-border/80'
                : 'text-muted hover:text-primary'
            }`}
          >
            <Cpu size={13} className="semantic-warning-text" />
            <span>MCP Tools</span>
          </button>
        </div>
      </div>

      {/* 1. TAB: STORY COMPOSER (NATIVE) */}
      {activeRightTab === 'composer' && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden">
          {/* Model Selector & Context Pill Tray */}
          <div
            className="p-3 border-b flex flex-col gap-2.5"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Mô hình sáng tác:
              </span>
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded border semantic-warning-box text-[10px]"
                  title="Story Composer chạy bằng mẫu văn bản cục bộ, không gọi mô hình AI."
                >
                  Mô phỏng (Local Template)
                </span>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="bg-elevated text-primary font-medium px-2 py-1 rounded-lg border border-border text-xs focus:outline-none"
                >
                  <option value="Claude 3.7 Sonnet (MCP Bridge)">
                    Claude 3.7 Sonnet (MCP)
                  </option>
                  <option value="Gemini 2.5 Flash / Pro (Local Bridge)">
                    Gemini 2.5 Flash (MCP)
                  </option>
                  <option value="Ollama / Qwen-2.5-32B (Local-first)">
                    Ollama Qwen-2.5 (Local)
                  </option>
                </select>
              </div>
            </div>

            {/* Context Pill Tray */}
            <div>
              <div className="flex items-center justify-between text-[11px] text-muted mb-1.5 font-semibold">
                <span className="flex items-center gap-1">
                  <Pin size={11} className="semantic-success-text" />
                  Ngữ cảnh nạp tự động vào Prompt:
                </span>
                <span className="semantic-success-text font-mono font-bold">
                  {pinnedContextIds.length} mục
                </span>
              </div>

              <div className="flex flex-wrap gap-1">
                {entities.map((e) => {
                  const isPinned = pinnedContextIds.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      onClick={() => togglePinnedContext(e.id)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-colors ${
                        isPinned
                          ? 'semantic-success-box'
                          : 'bg-elevated text-muted hover:text-primary border-border'
                      }`}
                    >
                      {e.entity_type === 'location' ? '#' : '@'}
                      {e.title}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Chat Message Feed (Adaptive High-Contrast Across All 3 Themes) */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 select-text">
            {composerMessages.map((msg) => (
              <div
                key={msg.id}
                className={`p-3 rounded-xl text-xs flex flex-col gap-1.5 leading-relaxed border ${
                  msg.role === 'user'
                    ? 'bg-elevated border-border ml-4 text-primary'
                    : 'semantic-success-box mr-4 text-primary'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-muted">
                  <span className="text-primary">
                    {msg.role === 'user' ? 'Bạn (Tác giả)' : msg.agent}
                  </span>
                  <span className="font-mono">{msg.timestamp}</span>
                </div>
                <p className="whitespace-pre-wrap text-primary font-medium">
                  {msg.content}
                </p>
                {msg.attachedDiffId && (
                  <div className="mt-1 pt-1.5 border-t border-border/60 text-[11px] semantic-success-text font-bold flex items-center gap-1">
                    <CheckCircle size={12} /> Đã đẩy Inline Diff lên trình soạn
                    thảo
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Quick Prompts & Input Area */}
          <div
            className="p-3 border-t flex flex-col gap-2"
            style={{
              backgroundColor: 'var(--bg-panel)',
              borderColor: 'var(--border-color)',
            }}
          >
            {/* Quick action chips */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              <button
                onClick={() =>
                  handleSendPrompt(
                    'Viết tiếp cảnh đối đầu nhưng giữ nhịp độ dồn dập, tăng chi tiết hành động cận chiến.'
                  )
                }
                className="px-2.5 py-1 bg-elevated hover:opacity-90 rounded-lg text-[11px] font-semibold text-primary whitespace-nowrap border border-border transition-colors"
              >
                ✍️ Viết tiếp dồn dập
              </button>
              <button
                onClick={() =>
                  handleSendPrompt(
                    "Chuyển đoạn này sang kỹ thuật Show Don't Tell, tăng chi tiết ngũ quan âm thanh đêm mưa."
                  )
                }
                className="px-2.5 py-1 bg-elevated hover:opacity-90 rounded-lg text-[11px] font-semibold text-primary whitespace-nowrap border border-border transition-colors"
              >
                👁️ Show, Don&apos;t Tell
              </button>
              <button
                onClick={() =>
                  handleSendPrompt(
                    'Kiểm tra lại tính nhất quán của các nhân vật trong phân cảnh này với Lorebook.'
                  )
                }
                className="px-2.5 py-1 bg-elevated hover:opacity-90 rounded-lg text-[11px] font-semibold text-primary whitespace-nowrap border border-border transition-colors"
              >
                🔍 Check Continuity
              </button>
            </div>

            <div className="relative">
              <textarea
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendPrompt();
                  }
                }}
                rows={3}
                placeholder="Nhập yêu cầu sáng tác hoặc gõ / để mở gợi ý..."
                className="w-full bg-elevated border border-border rounded-xl p-2.5 pr-10 text-primary placeholder:text-muted text-xs focus:outline-none focus:border-accent resize-none"
              />
              <button
                onClick={() => handleSendPrompt()}
                disabled={!promptInput.trim()}
                className="absolute right-2.5 bottom-3.5 p-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg transition-colors"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. TAB: EXTERNAL AGENTS BRIDGE (CLINE / OPENCODE / ANTIGRAVITY) */}
      {activeRightTab === 'agents' && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden p-3 space-y-3 select-text">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-primary flex items-center gap-1.5">
                <Terminal size={14} className="semantic-info-text" />
                External Agent Subprocesses
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold">
                Chưa kích hoạt
              </span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              NovelForge chưa tích hợp sidecar subsystem để spawn agent CLI từ
              bên trong IDE. Không có tiến trình nào đang chạy nền ở đây.
              Agent bên ngoài kết nối qua stdio MCP bridge:{' '}
              <code className="font-mono font-bold text-primary">
                novelforge-ide mcp [project_root]
              </code>
            </p>
          </div>

          {/* How to connect an external agent today */}
          <div className="p-3 rounded-xl border border-border bg-elevated space-y-2">
            <div className="text-xs font-semibold text-primary">
              Kết nối agent bên ngoài hôm nay
            </div>
            <ol className="text-[11px] text-muted leading-relaxed list-decimal pl-4 space-y-1">
              <li>Mở thư mục project trong bản desktop.</li>
              <li>
                Chạy{' '}
                <code className="font-mono text-primary">
                  novelforge-ide mcp .
                </code>{' '}
                như stdio MCP server (cwd = project root).
              </li>
              <li>
                Cấu hình Claude Desktop / Cline / OpenCode trỏ tới binary
                đó — 4 tool: novel_search_lore, novel_get_chapter_context,
                novel_check_continuity, novel_propose_edit.
              </li>
            </ol>
          </div>

          <div className="flex-1 overflow-y-auto p-3 bg-canvas rounded-xl border border-border font-mono text-[10px] text-muted leading-relaxed">
            <div className="text-primary font-semibold">
              # ví dụ cấu hình Claude Desktop
            </div>
            <div>{'{ "novelforge": { "command": "novelforge-ide",'}</div>
            <div>{'  "args": ["mcp", "D:/Project/MyNovel"] } }'}</div>
            <div className="mt-2">
              # novel_propose_edit KHÔNG ghi đè file — lưu đề xuất tại
              .novelforge/proposals/*.json để bạn duyệt.
            </div>
          </div>
        </div>
      )}

      {/* 3. TAB: EMBEDDED MCP SERVER INSPECTOR */}
      {activeRightTab === 'mcp' && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden p-3 space-y-3 select-text">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-primary flex items-center gap-1.5">
                <Cpu size={14} className="semantic-info-text" />
                NovelForge Embedded MCP Server
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full border semantic-info-box font-semibold">
                v1.0.0 Standard
              </span>
            </div>
            <div
              className={`text-[10px] leading-snug px-2.5 py-1.5 rounded-lg border ${
                canRunRealMcp
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
              }`}
              role="status"
            >
              {canRunRealMcp
                ? 'Đang kết nối MCP server cục bộ qua IPC (project thật trên đĩa).'
                : 'Chế độ mô phỏng (SIM) — mở thư mục project trong bản desktop để gọi MCP thật qua IPC, hoặc dùng: novelforge-ide mcp [project_root].'}
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Cung cấp 4 công cụ chuẩn hóa cho Cline, Claude Desktop, Antigravity
              và OpenCode truy vấn trực tiếp vào bộ nhớ tiểu thuyết.
            </p>
          </div>

          {/* Tools List */}
          <div className="space-y-2 overflow-y-auto max-h-56">
            <div className="p-2.5 rounded-xl bg-elevated border border-border flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <code className="semantic-success-text font-mono text-xs font-bold">
                  novel_search_lore
                </code>
                <button
                  onClick={() =>
                    handleToolRun(
                      'novel_search_lore',
                      { query: 'Kiều Hạ My', entity_type: 'character' },
                      'query="Kiều Hạ My", entity_type="character"'
                    )
                  }
                  className="px-2 py-0.5 border semantic-success-box rounded-md text-[11px] font-semibold flex items-center gap-1"
                >
                  <Play size={10} /> {canRunRealMcp ? 'Chạy MCP thật' : 'Mô phỏng'}
                </button>
              </div>
              <p className="text-[11px] text-muted">
                Tìm kiếm hồ sơ nhân vật/bối cảnh bằng Hybrid Search (BM25 +
                sqlite-vec).
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-elevated border border-border flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <code className="semantic-success-text font-mono text-xs font-bold">
                  novel_get_chapter_context
                </code>
                <button
                  onClick={() =>
                    handleToolRun(
                      'novel_get_chapter_context',
                      {
                        chapter_id: currentChapter?.id ?? 'ch_08',
                        window_size: 1,
                      },
                      `chapter_id="${currentChapter?.id ?? 'ch_08'}", window_size=1`
                    )
                  }
                  className="px-2 py-0.5 border semantic-success-box rounded-md text-[11px] font-semibold flex items-center gap-1"
                >
                  <Play size={10} /> {canRunRealMcp ? 'Chạy MCP thật' : 'Mô phỏng'}
                </button>
              </div>
              <p className="text-[11px] text-muted">
                Lấy nội dung chương hiện tại kèm tóm tắt chương trước và sau.
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-elevated border border-border flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <code className="semantic-success-text font-mono text-xs font-bold">
                  novel_check_continuity
                </code>
                <button
                  onClick={() =>
                    handleToolRun(
                      'novel_check_continuity',
                      {
                        draft_text:
                          currentChapter?.paragraphs.join('\n\n') ??
                          'Lâm Vũ Linh đứng giữa cơn mưa axit ở Bến Cảng Đông.',
                        chapter_id: currentChapter?.id ?? 'ch_08',
                      },
                      `chapter_id="${currentChapter?.id ?? 'ch_08'}", draft_text=<${currentChapter?.paragraphs.length ?? 0} đoạn>`
                    )
                  }
                  className="px-2 py-0.5 border semantic-success-box rounded-md text-[11px] font-semibold flex items-center gap-1"
                >
                  <Play size={10} /> {canRunRealMcp ? 'Chạy MCP thật' : 'Mô phỏng'}
                </button>
              </div>
              <p className="text-[11px] text-muted">
                Tự động chạy Linter trên đoạn văn vừa sáng tác để bẫy lỗ hổng
                logic.
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-elevated border border-border flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <code className="semantic-success-text font-mono text-xs font-bold">
                  novel_propose_edit
                </code>
                <button
                  onClick={() =>
                    handleToolRun(
                      'novel_propose_edit',
                      {
                        file_path:
                          currentChapter?.file_path ??
                          'manuscript/act-01/ch-08-dem-mua-ben-cang.md',
                        start_line: 1,
                        end_line: 1,
                        new_content: '(đề xuất ví dụ từ nút Chạy thử)',
                        rationale: 'Đề xuất thử — không áp dụng tự động',
                      },
                      `file_path="${currentChapter?.file_path ?? 'manuscript/act-01/ch-08-dem-mua-ben-cang.md'}", line=1`
                    )
                  }
                  className="px-2 py-0.5 border semantic-success-box rounded-md text-[11px] font-semibold flex items-center gap-1"
                >
                  <Play size={10} /> {canRunRealMcp ? 'Chạy MCP thật' : 'Mô phỏng'}
                </button>
              </div>
              <p className="text-[11px] text-muted">
                Đẩy đề xuất chỉnh sửa trực tiếp vào giao diện Diff của IDE.
              </p>
            </div>
          </div>

          {/* MCP Execution Logs */}
          <div className="flex-1 overflow-y-auto p-3 bg-canvas rounded-xl border border-border text-[11px] font-mono space-y-1.5">
            <span className="text-muted font-bold block mb-1">
              Nhật Ký Gọi MCP Tools (Real-time):
            </span>
            {mcpLogs.map((log) => (
              <div key={log.id} className="border-b border-border/50 pb-1.5">
                <div className="flex items-center justify-between text-muted">
                  <span className="text-primary font-bold">
                    [{log.agent_name}]
                  </span>
                  <span>
                    {log.timestamp} ({log.latency_ms}ms)
                  </span>
                </div>
                <div className="semantic-success-text font-semibold">
                  &gt; {log.tool_name}({log.args_summary})
                </div>
                <div className="text-muted truncate">
                  &lt; {log.result_summary}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
