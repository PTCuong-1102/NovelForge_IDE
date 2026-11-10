import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('MCP edit proposal sync guard tests', () => {
  const rootDir = process.cwd();
  const read = (rel: string) =>
    fs.readFileSync(path.join(rootDir, rel), 'utf8');

  it('1. The Rust core exposes the edit proposal commands', () => {
    const aiCmd = read('src-tauri/src/commands/ai_cmd.rs');
    assert(
      aiCmd.includes('pub async fn list_edit_proposals'),
      'ai_cmd must expose list_edit_proposals'
    );
    assert(
      aiCmd.includes('pub async fn dismiss_edit_proposal'),
      'ai_cmd must expose dismiss_edit_proposal'
    );

    const lib = read('src-tauri/src/lib.rs');
    assert(
      lib.includes('ai_cmd::list_edit_proposals'),
      'lib.rs must register list_edit_proposals'
    );
    assert(
      lib.includes('ai_cmd::dismiss_edit_proposal'),
      'lib.rs must register dismiss_edit_proposal'
    );
  });

  it('2. The MCP inspector can load the proposals stored on disk', () => {
    const rightDock = read('src/components/ai-hub/RightDock.tsx');
    assert(
      rightDock.includes('list_edit_proposals'),
      'RightDock must call list_edit_proposals'
    );
    assert(
      rightDock.includes('Đồng bộ đề xuất từ .novelforge/proposals'),
      'RightDock must offer the proposal sync button'
    );
    assert(
      rightDock.includes('addDiffProposal'),
      'RightDock must feed the proposals into the diff review flow'
    );
  });

  it('3. The MCP stdio bridge answers malformed JSON with the parse error code', () => {
    const mcp = read('src-tauri/src/ai_bridge/mcp_stdio.rs');
    assert(
      mcp.includes('-32700'),
      'the JSON-RPC parse error code must be used'
    );
  });
});
