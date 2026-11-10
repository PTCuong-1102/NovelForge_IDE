# NovelForge IDE — Kế Hoạch Fix & Nâng Cấp Chi Tiết (planfix_02)

> **For agentic workers:** REQUIRED SUB-SKILL: dùng `superpowers:subagent-driven-development` (khuyến nghị) hoặc `superpowers:executing-plans` để thực thi tuần tự từng task. Mỗi task kết thúc bằng một deliverable kiểm thử độc lập. Dùng checkbox `- [ ]` để tracking.

**Goal:** Sửa triệt để 20 lỗi phát hiện sau giai đoạn MVP (`planfix_01`) — chặn mất dữ liệu `# Heading` và YAML Frontmatter khi lưu chương, xóa race condition giữa `Ctrl+S` và Git Snapshot/Restore, bỏ lưu trữ nặng trong `localStorage`, sửa lỗi ghi đè chéo nhân vật ở `CharacterSheet`, gắn nhãn minh bạch mọi tính năng mô phỏng, nâng cấp Linter/Refactor hỗ trợ ranh giới từ tiếng Việt Unicode, xuất bản đầy đủ block Markdown (`***`, `>`, `**bold**`, `*italic*`), và nối luồng duyệt đề xuất MCP (`.novelforge/proposals/*.json`) lên giao diện IDE.

**Architecture:** Giữ nguyên kiến trúc local-first 2 lớp (Next.js 15 static export ↔ Tauri v2 IPC ↔ Rust core + SQLite + libgit2). Không thêm server ngoài. Các module thuần tính toán ở Rust (`core_engine`, `ai_bridge`, `vcs`) có thể kiểm thử độc lập; đĩa cứng là nguồn sự thật duy nhất khi mở project thật (`rootPath !== null && !isDemoData`).

**Tech Stack:** Next.js 15 (`output: 'export'`), React 19, TipTap, Zustand, Dockview, `@xyflow/react`; Rust/Tauri v2, `rusqlite` (bundled), `aho-corasick`, `git2`, `similar`; Node `node:test` + `tsx` cho test frontend.

**Spec:** `.docs/prd-technical-architecture.md`, `.docs/master-execution-plan.md`, `.docs/ui-ux-specification.md`, `.docs/architecture-decisions.md`, `AGENTS.md`.

**Ngày lập:** 2026-11-11 | **Trạng thái code đầu vào:** commit `e7470ab` (nhánh `main`)

---

## 0. Bảng tổng hợp 20 phát hiện kiểm toán (đã xác minh trên code)

| Mã | Mức độ | Phát hiện | Vị trí (`file:line`) |
|---|---|---|---|
| **F2.01** | Must Fix | Mất sạch tiêu đề `# Heading` khi mở và lưu chương trên Desktop vì `doc.paragraphs` loại bỏ heading | `src-tauri/src/core_engine/parser.rs:172-202`, `src/lib/project-io.ts:50-58,228-239` |
| **F2.02** | Must Fix | Mất trường YAML Frontmatter tùy chỉnh (`pov`, custom keys), đảo thứ tự key mỗi lần lưu, và mất trắng frontmatter nếu YAML lỗi cú pháp nhẹ | `src-tauri/src/commands/fs_cmd.rs:100-116`, `src-tauri/src/core_engine/parser.rs:228-234`, `src/lib/project-io.ts:104-121,154-173` |
| **F2.03** | Must Fix | Race condition: `flushAllChapterSaves()` không `await` trước khi gọi `create_snapshot` / `restore_snapshot`; `Ctrl+S` tạo Git commit liên tục | `src/stores/useWorkspaceStore.ts:182-199,459-492,523-568`, `src/app/page.tsx:73-79` |
| **F2.04** | Must Fix | Zustand `persist` lưu toàn bộ `chapters`/`entities` vào `localStorage` gây đè file đĩa khi mở lại app, tràn 5MB quota, và kẹt `saveStatus: 'saving'` ở chế độ Web/Demo | `src/stores/useWorkspaceStore.ts:137-155,301-323,805-824` |
| **F2.05** | Must Fix | `create_snapshot` dùng thẳng `.git/index` (gom nhầm staged files ngoài `manuscript/`/`lorebook/`), thiếu `index.update_all` (sót chương bị xóa), và `Repository::discover` leo lên repo cha | `src-tauri/src/vcs/snapshot.rs:62-69,108-123` |
| **F2.06** | Must Fix | Vi phạm quy ước gắn nhãn "Mô phỏng": Story Composer, Ghost Text, What-If Branch chạy văn mẫu/in-memory không nhãn; `Shift+F6` và `SlashMenu` hardcode `'char_linh_001'` / `'Lâm Vũ Linh'` | `src/stores/useAgentStore.ts:195-263`, `src/components/editor/extensions/ghost-text.ts:20-95`, `src/components/editor/NovelEditor.tsx:1142-1164`, `src/app/page.tsx:96`, `src/components/modals/CommandPalette.tsx:71`, `src/components/workbench/Sidebar.tsx:488-526,614` |
| **F2.07** | Must Fix | Chế độ Raw Markdown trong `NovelEditor` tự ghi đè lại `<textarea>` sau mỗi phím gõ làm nhảy con trỏ và mất dòng trống | `src/components/editor/NovelEditor.tsx:254-260,497-515` |
| **F2.08** | Must Fix | Đổi tab giữa các nhân vật (`CharacterSheet`) hoặc mở `RefactorRenameModal` giữ nguyên state của nhân vật cũ, gây ghi đè nhầm hồ sơ | `src/components/lorebook/CharacterSheet.tsx:23-33`, `src/components/workbench/DockLayout.tsx:68-75`, `src/components/modals/RefactorRenameModal.tsx:22-28` |
| **F2.09** | Should Fix | Refactor Rename thay thế substring trần (`split/join`, `replace`) không kiểm tra ranh giới từ (`"An"` làm hỏng `"An toàn"`, `"Công an"`) | `src-tauri/src/core_engine/refactor.rs:31-34`, `src/lib/tauri-bridge.ts:502-506`, `src/stores/useWorkspaceStore.ts:418-420` |
| **F2.10** | Should Fix | SQLite Index không đồng bộ sau khi save file, không bọc Transaction, không xóa thực thể mồ côi, và văng lỗi `UNIQUE constraint failed: entities.file_path` khi đổi `id` | `src-tauri/src/core_engine/storage.rs:150-365`, `src-tauri/src/core_engine/indexer.rs:96-115`, `src/stores/useWorkspaceStore.ts:146-175` |
| **F2.11** | Should Fix | `canonical_within` chưa chặn ghi vào `.git/` (Git hooks) và chưa `canonicalize` tổ tiên gần nhất khi thư mục cha chưa tồn tại; `novel_propose_edit` đọc được file ngoài `manuscript/`/`lorebook/` | `src-tauri/src/core_engine/paths.rs:26-82`, `src-tauri/src/ai_bridge/mcp_stdio.rs:415-422` |
| **F2.12** | Should Fix | Linter `AhoCorasick` chỉ `ascii_case_insensitive` (bỏ sót chữ hoa tiếng Việt có dấu như `"LÂM VŨ LINH"`), `storage.rs` truyền `attributes` rỗng, và `scanImplicitEntities` (TS) thiếu kiểm tra word boundary | `src-tauri/src/core_engine/linter.rs:65-71`, `src-tauri/src/core_engine/storage.rs:285`, `src/lib/tauri-bridge.ts:221-250` |
| **F2.13** | Should Fix | Xuất bản EPUB/DOCX/PDF không nhận diện dấu ngắt cảnh `***`, trích dẫn `>`, inline `**bold**`/`*italic*`; CSP trong `tauri.conf.json` chặn Google Fonts của `layout.tsx` | `src/lib/publish/escape-html.ts:23-44`, `src/lib/publish/docx.ts:72-95`, `src-tauri/tauri.conf.json:25`, `src/app/layout.tsx:19-28` |
| **F2.14** | Should Fix | `Sidebar.tsx` cố định tên `"Hồi 1: Tín Hiệu Từ Đáy Biển"`; `reorderChapters` không cập nhật trường `order`; `createChapter` có thể trùng `file_path` | `src/components/workbench/Sidebar.tsx:109-169`, `src/stores/useWorkspaceStore.ts:343-395` |
| **F2.15** | Should Fix | `closeTab` bỏ quên `activeSecondaryTabId`; `toggleSplitView` trỏ tới `'tab-lore-db'` khi tab đó chưa có trong `openTabs` | `src/stores/useWorkspaceStore.ts:247-292` |
| **F2.16** | Should Fix | Đề xuất chỉnh sửa từ MCP (`novel_propose_edit` → `.novelforge/proposals/*.json`) chưa có lệnh IPC đọc/duyệt trên UI | `src-tauri/src/ai_bridge/mcp_stdio.rs:452-470`, `src-tauri/src/commands/ai_cmd.rs`, `src/components/ai-hub/RightDock.tsx` |
| **F2.17** | Nice to Have | Trên Linux thiếu hướng dẫn/gói `libgtk-3-dev` + `libwebkit2gtk-4.1-dev` khiến `cargo test` bị chặn bởi `gdk-sys`; `next.config.mjs` đang tắt ESLint khi build | `RELEASING.md`, `next.config.mjs:7-9` |
| **F2.18** | Nice to Have | `mcp_stdio.rs` im lặng khi gặp JSON lỗi (thiếu mã `-32700`) và `tool_check_continuity` chưa normalize `\r\n` khi tách đoạn | `src-tauri/src/ai_bridge/mcp_stdio.rs:51-53,372-376` |
| **F2.19** | Nice to Have | `NovelEditor` biên dịch lại `RegExp` trên từng đoạn văn mỗi lần render; `Sidebar` chạy lại Linter toàn cục không `useMemo` | `src/components/editor/NovelEditor.tsx:1239-1270`, `src/components/workbench/Sidebar.tsx:76-78` |
| **F2.20** | Nice to Have | `count_words_in_dir` (`snapshot.rs`) đếm luôn cả YAML frontmatter; `is_sqlite_vec_virtual_table_active` là dead code | `src-tauri/src/vcs/snapshot.rs:39-54`, `src-tauri/src/core_engine/indexer.rs:118-138` |

---

## 1. Global Constraints

1. **Không thêm server backend ngoài.** Local-first 100%.
2. **Đĩa cứng là nguồn sự thật duy nhất** cho project Desktop (`rootPath !== null && !isDemoData`). Không bao giờ lấy nội dung chương cũ trong `localStorage` ghi đè lên file `.md` trên đĩa.
3. **Demo fallback phải luôn có nhãn** (`"Mô phỏng"` / `"Demo"` / `"Local Template"`) — tuyệt đối không tạo log MCP giả mạo khi chạy tính năng mẫu.
4. **Bảo toàn dữ liệu (Lossless Round-trip):** Mở một file `.md` và bấm lưu (không sửa hoặc sửa 1 từ) không được làm mất `# Heading`, `***`, `> blockquote`, trường YAML Frontmatter tùy chỉnh, hay thứ tự các khóa YAML.
5. **UTF-8 + CRLF safe:** Mọi parser/splitter phải xử lý được cả `\n` và `\r\n`; chạy `npm run verify:utf8` xanh sau mỗi milestone.
6. **Tất cả kiểm thử phải xanh trước khi đóng milestone:** `npm test`, `npm run typecheck`, `npm run build`, `npm run verify:utf8`, và `cargo test` (sau khi cài đủ gói hệ thống ở M0).

---

## 2. Review Focus — 6 kịch bản biên bắt buộc có test ghim

| # | Kịch bản | Hành vi đúng | Task sở hữu + test ghim |
|---|---|---|---|
| **RF1** | Mở chương có `# Chương 1: Mở đầu`, `## Cảnh 1`, YAML key lạ `weather: "Mưa axit"` → sửa 1 đoạn → lưu đĩa | File sau khi lưu giữ nguyên `# Chương 1: Mở đầu`, `## Cảnh 1`, `weather: "Mưa axit"` và đúng thứ tự key YAML | Task 1.1 — `parser.rs` + `project-io.test.ts` |
| **RF2** | Gõ chữ mới vào chương → bấm tạo Snapshot (hoặc Restore) ngay lập tức khi timer debounce 1000ms chưa hết | Hàm flush lưu đĩa chạy xong (`await`) trước khi Git đọc đĩa; không bao giờ commit thiếu chữ vừa gõ hoặc ghi đè sau khi Restore | Task 1.2 — `workspace-persistence.test.ts` |
| **RF3** | User đã `git add secret.txt` ngoài terminal hoặc vừa xóa `manuscript/ch-02.md` → bấm tạo Snapshot trong IDE | Snapshot chỉ ghi nhận thay đổi (kể cả xóa file) trong `manuscript/` và `lorebook/`, giữ nguyên `secret.txt` ở trạng thái staged nhưng không đưa vào snapshot commit nếu có thể hoặc cảnh báo rõ; không bao giờ commit vào repo cha | Task 2.1 — `snapshot.rs` tests |
| **RF4** | Gọi `write_markdown_file` với `relative_path = ".git/hooks/post-commit"` hoặc symlink trỏ ra ngoài `project_root` | `canonical_within` trả `Err(FsError::OutsideProjectRoot)` ngay lập tức | Task 2.2 — `paths.rs` tests |
| **RF5** | Refactor Rename nhân vật `"An"` → `"Bình"` trên đoạn văn `"An bước đi trong đêm an toàn cùng Công an."` | Chỉ từ độc lập `"An"` đổi thành `"Bình"`, giữ nguyên `"an toàn"` và `"Công an"` | Task 4.1 — `refactor.rs` + `novel-engine.test.ts` |
| **RF6** | Đổi `id` của hồ sơ nhân vật trong `lorebook/characters/linh.md` từ `char_01` sang `char_linh_01` rồi chạy `sync_project_sqlite` | SQLite cập nhật bản ghi mượt mà, không văng lỗi `UNIQUE constraint failed: entities.file_path` | Task 4.2 — `storage.rs` test |

---

## 3. File Structure (Các file tạo mới & chỉnh sửa)

**Tạo mới:**
- `src/lib/__tests__/project-io.test.ts` — kiểm thử round-trip `parsedToChapter` ↔ `chapterToFrontmatter` + bảo toàn `# Heading` và custom YAML keys.
- `src/lib/word-boundary.ts` — hàm tiện ích `isUnicodeWordBoundary(text, start, end)` và `replaceWholeWordUnicode(text, from, to)` dùng chung cho Linter và Refactor ở frontend.

**Chỉnh sửa:**
- `src-tauri/src/core_engine/parser.rs` — giữ `# Heading`, `***`, `> ...` trong chuỗi khối văn bản cho editor; thêm fallback bảo toàn `raw_frontmatter` khi YAML lỗi.
- `src-tauri/src/commands/fs_cmd.rs` — `write_markdown_file` nhận thêm `ordered_keys: Option<Vec<String>>` và dùng `serialize_markdown_with_ordered_frontmatter`.
- `src-tauri/src/core_engine/paths.rs` — chặn thành phần `.git` và `canonicalize` tổ tiên gần nhất tồn tại.
- `src-tauri/src/core_engine/storage.rs` — bọc Transaction khi sync SQLite, dọn bản ghi mồ côi/đổi `id`, nạp `attributes` cho `LoreCharacterSpec`.
- `src-tauri/src/core_engine/indexer.rs` — xử lý xung đột `file_path` khi đổi `id` trong `upsert_entity_record`, xóa dead code `is_sqlite_vec_virtual_table_active`.
- `src-tauri/src/core_engine/linter.rs` — hỗ trợ tìm kiếm không phân biệt hoa-thường tiếng Việt Unicode và kiểm tra `attributes` tổng quát.
- `src-tauri/src/core_engine/refactor.rs` — kiểm tra ranh giới từ (`is_valid_word_boundary`) khi preview/replace.
- `src-tauri/src/vcs/snapshot.rs` — kiểm tra `workdir` khớp `project_root`, thêm `index.update_all`, dùng `parse_markdown_with_frontmatter` khi đếm từ.
- `src-tauri/src/ai_bridge/mcp_stdio.rs` & `src-tauri/src/commands/ai_cmd.rs` — chuẩn hóa lỗi `-32700`, chặn đọc file ngoài `manuscript/`/`lorebook/`, thêm IPC `list_edit_proposals` và `resolve_edit_proposal`.
- `src-tauri/src/lib.rs` — đăng ký `ai_cmd::list_edit_proposals` và `ai_cmd::resolve_edit_proposal`.
- `src-tauri/tauri.conf.json` — cập nhật CSP cho phép tải font hoặc dùng font cục bộ.
- `src/lib/project-io.ts` — bảo toàn `# Heading`, `extra_frontmatter`, `frontmatter_keys_order` khi đọc/lưu chương và thực thể.
- `src/lib/tauri-bridge.ts` — cập nhật kiểu `ChapterDocument`, `LoreEntity`, dùng `word-boundary.ts` trong `scanImplicitEntities` và `buildRefactorRenamePreview`.
- `src/stores/useWorkspaceStore.ts` — `async` flush saves, bỏ persist dữ liệu nặng khi mở project thật, sửa `saveStatus` ở chế độ Demo, sửa `closeTab`/`toggleSplitView`/`reorderChapters`/`createChapter`, gọi `sync_project_sqlite` sau khi lưu.
- `src/stores/useAgentStore.ts` & `src/components/ai-hub/RightDock.tsx` — gắn nhãn `[Mô phỏng]` cho Story Composer, không tạo log MCP giả, thêm nút tải/duyệt đề xuất từ `.novelforge/proposals/`.
- `src/components/editor/NovelEditor.tsx`, `src/components/editor/extensions/ghost-text.ts` — sửa lỗi nhảy con trỏ ở chế độ Raw Markdown, gắn nhãn mẫu cho Ghost Text, bỏ hardcode `'Lâm Vũ Linh'` trong Slash Menu, memoize regex thực thể.
- `src/components/workbench/DockLayout.tsx`, `src/components/lorebook/CharacterSheet.tsx`, `src/components/modals/RefactorRenameModal.tsx` — thêm `key` theo ID và `useEffect` đồng bộ state khi đổi thực thể.
- `src/components/workbench/Sidebar.tsx`, `src/app/page.tsx`, `src/components/modals/CommandPalette.tsx` — nhóm Hồi truyện động, tách `Ctrl+S` (lưu đĩa) và `Ctrl+Shift+S` (tạo Snapshot), bỏ hardcode `'char_linh_001'`, dùng `useMemo` cho Linter.
- `src/lib/publish/escape-html.ts`, `src/lib/publish/docx.ts`, `src/lib/__tests__/publish.test.ts` — hỗ trợ `***`, `> blockquote`, và inline `**bold**` / `*italic*` khi xuất bản.
- `RELEASING.md` — bổ sung hướng dẫn cài đặt thư viện hệ thống trên Linux.

---

## 4. Lộ trình Milestone & Task Chi Tiết

Thứ tự thực thi: **M0 → M1 → M2 → M3 → M4 → M5**.

---

### Milestone 0 — Chuẩn hóa Toolchain Đa Nền Tảng (Linux & Windows)

#### Task 0.1: Cài đặt thư viện hệ thống Linux & Xác nhận Baseline `cargo test`

**Files:**
- Modify: `RELEASING.md`

- [ ] **Step 1: Kiểm tra và cài đặt gói phát triển GTK3/WebKit2GTK trên Linux (nếu đang chạy trên Linux)**

Run:
```bash
pkg-config --exists gdk-3.0 webkit2gtk-4.1 || sudo apt-get update && sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf
```
Expected: `pkg-config --exists gdk-3.0` trả về exit code `0`. (Nếu môi trường không có quyền `sudo`, ghi nhận vào mục Verification và kiểm tra cú pháp thông qua `cargo check` cho các module độc lập).

- [ ] **Step 2: Chạy `cargo test` và `npm test` để xác nhận baseline**

Run:
```bash
npm test && npm run typecheck && npm run verify:utf8 && (cd src-tauri && cargo test)
```
Expected: `npm test` 31/31 PASS, `cargo test` 11/11 PASS.

- [ ] **Step 3: Cập nhật `RELEASING.md` bổ sung mục Prerequisites cho Linux (Ubuntu/Debian)**

Thêm khối lệnh `apt-get install` cho `libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev` vào `RELEASING.md`.

- [ ] **Step 4: Commit**

```bash
git add RELEASING.md
git commit -m "docs(releasing): document Linux GTK/WebKit2GTK build prerequisites"
```

---

### Milestone 1 — Bảo Toàn Dữ Liệu File Markdown, YAML & Store Persistence (F2.01, F2.02, F2.03, F2.04)

#### Task 1.1: Bảo toàn `# Heading`, `***`, `> ...` và thứ tự/trường YAML Frontmatter tùy chỉnh khi đọc & lưu

**Files:**
- Modify: `src-tauri/src/core_engine/parser.rs:145-255`
- Modify: `src-tauri/src/commands/fs_cmd.rs:99-116`
- Modify: `src/lib/tauri-bridge.ts:7-47`
- Modify: `src/lib/project-io.ts:11-174,228-252`
- Create: `src/lib/__tests__/project-io.test.ts`

**Interfaces:**
- Produces in `src/lib/tauri-bridge.ts`:
  - `ChapterDocument` thêm `extra_frontmatter?: Record<string, unknown>` và `frontmatter_keys_order?: string[]`
  - `LoreEntity` thêm `extra_frontmatter?: Record<string, unknown>` và `frontmatter_keys_order?: string[]`
- Produces in `src-tauri/src/commands/fs_cmd.rs`:
  - `pub async fn write_markdown_file(project_root: String, relative_path: String, frontmatter: HashMap<String, serde_json::Value>, ordered_keys: Option<Vec<String>>, body: String) -> Result<(), String>`

- [ ] **Step 1: Viết failing tests trong `src/lib/__tests__/project-io.test.ts` và `src-tauri/src/core_engine/parser.rs`**

Tạo `src/lib/__tests__/project-io.test.ts`:
```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsedToChapter,
  chapterToFrontmatter,
  parsedToEntity,
  entityToFrontmatter,
} from '../project-io';

describe('Project IO Lossless Round-trip Tests', () => {
  it('1. preserves markdown headings, scene breaks, and custom frontmatter keys on chapter round-trip', () => {
    const rawDoc = {
      frontmatter: {
        id: 'ch_01',
        title: 'Bóng Ma Bên Bến Cảng',
        act_id: 'act_01',
        order: 1,
        pov: 'Lâm Vũ Linh',
        weather: 'Mưa axit',
      },
      frontmatter_keys_order: ['id', 'title', 'act_id', 'order', 'pov', 'weather'],
      body: '# Chương 1: Bóng Ma Bên Bến Cảng\n\nMưa rơi tầm tã.\n\n***\n\n## Phân cảnh 2\n\nĐoạn kết.',
      blocks: [
        { kind: 'heading' as const, level: 1, text: 'Chương 1: Bóng Ma Bên Bến Cảng' },
        { kind: 'paragraph' as const, text: 'Mưa rơi tầm tã.', is_flashback: false },
        { kind: 'scene_break' as const },
        { kind: 'heading' as const, level: 2, text: 'Phân cảnh 2' },
        { kind: 'paragraph' as const, text: 'Đoạn kết.', is_flashback: false },
      ],
    };

    const ch = parsedToChapter('manuscript/act-01/ch-01.md', rawDoc);
    assert.deepEqual(ch.paragraphs, [
      '# Chương 1: Bóng Ma Bên Bến Cảng',
      'Mưa rơi tầm tã.',
      '***',
      '## Phân cảnh 2',
      'Đoạn kết.',
    ]);

    const fm = chapterToFrontmatter(ch);
    assert.equal(fm.pov, 'Lâm Vũ Linh');
    assert.equal(fm.weather, 'Mưa axit');
    assert.deepEqual(ch.frontmatter_keys_order, [
      'id',
      'title',
      'act_id',
      'order',
      'pov',
      'weather',
    ]);
  });

  it('2. preserves custom frontmatter keys on entity round-trip', () => {
    const rawDoc = {
      frontmatter: {
        id: 'char_linh_001',
        type: 'character',
        title: 'Lâm Vũ Linh',
        weapon: 'Súng lục giảm thanh',
      },
      frontmatter_keys_order: ['id', 'type', 'title', 'weapon'],
      body: '# Tiểu sử\n\nĐặc vụ Aegis.',
    };
    const ent = parsedToEntity('lorebook/characters/linh.md', rawDoc);
    const fm = entityToFrontmatter(ent);
    assert.equal(fm.weapon, 'Súng lục giảm thanh');
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `npm test`
Expected: FAIL tại `Project IO Lossless Round-trip Tests` vì `# Chương 1...` bị lọc mất và `fm.pov` / `fm.weather` là `undefined`.

- [ ] **Step 3: Implement logic bảo toàn blocks và custom frontmatter**

1. Trong `src/lib/project-io.ts`:
   - Mở rộng `ParsedDocument` gồm `frontmatter_keys_order?: string[]` và `blocks?: Array<{ kind: string; level?: number; text?: string }>`.
   - Trong `bodyToParagraphs(doc)`: nếu `doc.blocks && doc.blocks.length > 0`, chuyển từng block về chuỗi Markdown (`heading` → `${'#'.repeat(level)} ${text}`, `scene_break` → `'***'`, `author_note` → `'> [!GHI_CHÚ_TÁC_GIẢ] ' + text`, `block_quote` → `'> ' + text`, `paragraph` → `text`). Nếu không có `doc.blocks`, tách `doc.body` theo `/\r?\n\s*\r?\n/` và **giữ nguyên** các dòng bắt đầu bằng `#`.
   - Trong `parsedToChapter` / `parsedToEntity`: lưu toàn bộ các key trong `doc.frontmatter` không nằm trong danh sách trường chuẩn vào `extra_frontmatter`, lưu `frontmatter_keys_order: doc.frontmatter_keys_order`. Ngoài ra `pov_character_name: str(fm.pov_character_name, str(fm.pov))`.
   - Trong `chapterToFrontmatter` / `entityToFrontmatter`: spread `...(c.extra_frontmatter ?? {})` trước các trường chuẩn, và truyền `orderedKeys: c.frontmatter_keys_order ?? null` vào `invokeSafe('write_markdown_file', ...)`.
2. Trong `src-tauri/src/commands/fs_cmd.rs`:
   - Thêm tham số `ordered_keys: Option<Vec<String>>` vào `write_markdown_file`, gọi `serialize_markdown_with_ordered_frontmatter(&frontmatter, ordered_keys.as_deref().unwrap_or(&[]), &body)`.

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `npm test && npm run typecheck`
Expected: PASS (33/33 tests).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/fs_cmd.rs src/lib/tauri-bridge.ts src/lib/project-io.ts src/lib/__tests__/project-io.test.ts
git commit -m "fix(io): preserve markdown headings and custom YAML frontmatter on save"
```

---

#### Task 1.2: Xóa Race Condition giữa Lưu đĩa (`flushAllSaves`) và Git Snapshot/Restore; tách `Ctrl+S` khỏi `Ctrl+Shift+S`

**Files:**
- Modify: `src/stores/useWorkspaceStore.ts:83-107,137-200,301-335,459-568,612-635,741-756`
- Modify: `src/app/page.tsx:73-84`
- Modify: `src/components/modals/CommandPalette.tsx:86-90`

**Interfaces:**
- Produces in `WorkspaceState` (`src/stores/useWorkspaceStore.ts`):
  - `flushAllSaves: () => Promise<void>`
  - `createGitSnapshot: (label: string) => Promise<void>`
  - `restoreSnapshot: (snapshotId: string) => Promise<void>`

- [ ] **Step 1: Viết failing test trong `src/lib/__tests__/ipc-fallback.test.ts`**

Thêm test kiểm tra: ở chế độ Demo/Web, gọi `updateChapterParagraphs` chuyển `saveStatus` về `'saved'` (không bị kẹt ở `'saving'`), và `flushAllSaves()` trả về một `Promise` hoàn tất.

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `npm test`
Expected: FAIL vì `flushAllSaves` chưa tồn tại trên store và `saveStatus` vẫn là `'saving'` ở chế độ Web/Demo.

- [ ] **Step 3: Implement `flushAllSaves(): Promise<void>` và cập nhật luồng `Ctrl+S` / Snapshot / Restore**

1. Trong `src/stores/useWorkspaceStore.ts`:
   - Khi `!isTauri() || s.isDemoData || !s.rootPath`: `persistChapter` đặt ngay `useWorkspaceStore.setState({ saveStatus: 'saved' })` rồi return.
   - Sửa `flushChapterSave(chapterId): Promise<void>` và `flushEntitySave(entityId): Promise<void>` trả về `Promise` của `saveChapterToDisk` / `saveEntityToDisk`.
   - Thêm action `flushAllSaves: async () => { await Promise.all([...]); }` thực thi mọi timer đang chờ của cả chương và thực thể, sau đó đặt `saveStatus: 'saved'`.
   - Trong `createGitSnapshot`, `restoreSnapshot`, `openProjectFromDialog`, `closeProject`: `await get().flushAllSaves()` trước khi gọi IPC tiếp theo.
2. Trong `src/app/page.tsx`:
   - `Ctrl+S` (không giữ `Shift`): gọi `await useWorkspaceStore.getState().flushAllSaves()`.
   - `Ctrl+Shift+S`: gọi `createGitSnapshot('Điểm nhớ nhanh (Ctrl+Shift+S)')`.
   - Cập nhật nhãn phím tắt tương ứng trong `CommandPalette.tsx:88` thành `'Ctrl+Shift+S'`.

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/useWorkspaceStore.ts src/app/page.tsx src/components/modals/CommandPalette.tsx src/lib/__tests__/ipc-fallback.test.ts
git commit -m "fix(store): await pending disk saves before git snapshot/restore and fix demo saveStatus"
```

---

#### Task 1.3: Ngăn `localStorage` ghi đè file trên đĩa và tràn bộ nhớ khi mở Project thật

**Files:**
- Modify: `src/stores/useWorkspaceStore.ts:805-826`
- Modify: `src/app/page.tsx:57-61`

- [ ] **Step 1: Viết test kiểm tra `partialize` không lưu mảng `chapters`/`entities` khi `rootPath` khác `null` và `!isDemoData`**

Thêm test vào `src/lib/__tests__/ipc-fallback.test.ts` kiểm tra dữ liệu lưu xuống `localStorage` khi `isDemoData === false && rootPath === '/tmp/my-novel'` có `chapters: []` và `entities: []`.

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `npm test`
Expected: FAIL vì `partialize` hiện lưu toàn bộ `state.chapters`.

- [ ] **Step 3: Sửa `partialize` và thêm tự động nạp lại từ đĩa khi mở app Desktop**

1. Trong `src/stores/useWorkspaceStore.ts` (`partialize` ở dòng 809):
   ```typescript
   partialize: (state) => ({
     projectName: state.projectName,
     theme: state.theme,
     chapters: state.isDemoData ? state.chapters : [],
     entities: state.isDemoData ? state.entities : [],
     relations: state.isDemoData ? state.relations : [],
     snapshots: state.isDemoData ? state.snapshots : [],
     activeBranch: state.activeBranch,
     availableBranches: state.availableBranches,
     isDemoData: state.isDemoData,
     rootPath: state.rootPath,
     openTabs: state.openTabs,
     activePrimaryTabId: state.activePrimaryTabId,
     activeSecondaryTabId: state.activeSecondaryTabId,
   }),
   ```
2. Thêm action `reloadCurrentProjectFromDisk: () => Promise<void>` vào `useWorkspaceStore.ts` và gọi một lần trong `useEffect` khởi động ở `src/app/page.tsx` nếu `isTauri() && rootPath && !isDemoData && chapters.length === 0`.

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/useWorkspaceStore.ts src/app/page.tsx src/lib/__tests__/ipc-fallback.test.ts
git commit -m "fix(storage): avoid persisting disk-backed chapters in localStorage and reload from disk on startup"
```

---

### Milestone 2 — An Toàn Git Snapshot & Gia Cố Bảo Mật Đường Dẫn (F2.05, F2.11, F2.20)

#### Task 2.1: Sửa `snapshot.rs` — Chặn commit vào repo cha, ghi nhận file bị xóa (`update_all`), và đếm từ chính xác

**Files:**
- Modify: `src-tauri/src/vcs/snapshot.rs:39-135,344-409`

- [ ] **Step 1: Viết 2 failing Rust tests trong `src-tauri/src/vcs/snapshot.rs`**

1. `create_snapshot_records_deleted_chapter`: tạo 2 file `manuscript/ch-01.md` và `manuscript/ch-02.md`, chụp snapshot 1 → xóa `manuscript/ch-02.md` trên đĩa → chụp snapshot 2 → tạo lại `ch-02.md` rác → `restore_snapshot` về snapshot 2 phải không còn nội dung cũ của `ch-02.md` trong commit tree của snapshot 2.
2. `create_snapshot_excludes_frontmatter_from_word_count`: file `manuscript/ch-01.md` có 10 từ trong YAML frontmatter và 4 từ trong body → `snap.total_words == 4`.

- [ ] **Step 2: Chạy `cargo test` để xác nhận FAIL**

Run: `cd src-tauri && cargo test vcs::snapshot::tests`
Expected: FAIL (`total_words` đếm cả YAML frontmatter; `index.add_all` không xóa `ch-02.md` khỏi index).

- [ ] **Step 3: Implement trong `src-tauri/src/vcs/snapshot.rs`**

1. Trong `open_repo(project_root: &str)`: dùng `Repository::open(Path::new(project_root))` thay vì `Repository::discover` (để không vô tình mở repo `.git` ở thư mục cha khi thư mục con chưa `git init`).
2. Trong `create_snapshot`: trước `index.add_all(["manuscript", "lorebook"].iter(), IndexAddOption::DEFAULT, None)`, gọi `index.update_all(["manuscript", "lorebook"].iter(), None)` để mọi file đã xóa khỏi đĩa cũng được xóa khỏi Git index.
3. Trong `count_words_in_dir`: gọi `crate::core_engine::parser::parse_markdown_with_frontmatter(&content).word_count` thay vì `content.split_whitespace().count()`.

- [ ] **Step 4: Chạy `cargo test` để xác nhận PASS**

Run: `cd src-tauri && cargo test vcs::snapshot::tests`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/vcs/snapshot.rs
git commit -m "fix(vcs): stage deleted files in snapshots, scope to direct repo, and exclude YAML from word count"
```

---

#### Task 2.2: Gia cố `canonical_within` (chặn `.git/`, giải quyết symlink tổ tiên) và giới hạn phạm vi `novel_propose_edit`

**Files:**
- Modify: `src-tauri/src/core_engine/paths.rs:26-113`
- Modify: `src-tauri/src/ai_bridge/mcp_stdio.rs:395-435`

- [ ] **Step 1: Viết failing tests trong `src-tauri/src/core_engine/paths.rs`**

```rust
#[test]
fn test_rejects_dot_git_directory_access() {
    let temp = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(temp.path().join(".git/hooks")).unwrap();
    let res = canonical_within(temp.path(), Path::new(".git/hooks/pre-commit"));
    assert_eq!(res, Err(FsError::OutsideProjectRoot));
}
```

- [ ] **Step 2: Chạy `cargo test` để xác nhận FAIL**

Run: `cd src-tauri && cargo test core_engine::paths::tests`
Expected: FAIL (`res` là `Ok(...)`).

- [ ] **Step 3: Implement kiểm tra `.git` và canonicalize tổ tiên gần nhất trong `paths.rs` + lọc thư mục trong `mcp_stdio.rs`**

1. Trong `canonical_within` (`paths.rs`):
   - Kiểm tra mọi `Component::Normal(os)` trong `candidate`: nếu `os.to_string_lossy().eq_ignore_ascii_case(".git")` → trả `Err(FsError::OutsideProjectRoot)`.
   - Khi `normalized` chưa tồn tại trên đĩa: đi ngược qua `.ancestors()` tìm thư mục tổ tiên gần nhất có `.exists()`, gọi `.canonicalize()` trên tổ tiên đó rồi nối phần đuôi tương đối (`normalized.strip_prefix(existing_ancestor)`), sau đó kiểm tra `.starts_with(&canonical_root)`.
2. Trong `tool_propose_edit` (`mcp_stdio.rs`):
   - Sau khi có `rel = safe_path.strip_prefix(&canonical_root)`: kiểm tra đường dẫn tương đối bắt đầu bằng `"manuscript/"` hoặc `"lorebook/"` và có đuôi `.md`; nếu không → trả `json!({ "error": "novel_propose_edit only permits markdown files under manuscript/ or lorebook/" })`.

- [ ] **Step 4: Chạy `cargo test` để xác nhận PASS**

Run: `cd src-tauri && cargo test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/core_engine/paths.rs src-tauri/src/ai_bridge/mcp_stdio.rs
git commit -m "security(paths): block .git access, resolve ancestor symlinks, and scope MCP propose_edit"
```

---

### Milestone 3 — Sửa Lỗi Editor, State UI & Minh Bạch Hóa Nhãn Mô Phỏng (F2.06, F2.07, F2.08, F2.14, F2.15, F2.19)

#### Task 3.1: Sửa lỗi ghi đè chéo nhân vật (`CharacterSheet`, `RefactorRenameModal`) và nhảy con trỏ ở chế độ Raw Markdown (`NovelEditor`)

**Files:**
- Modify: `src/components/workbench/DockLayout.tsx:61-82`
- Modify: `src/components/lorebook/CharacterSheet.tsx:19-49`
- Modify: `src/components/modals/RefactorRenameModal.tsx:15-43`
- Modify: `src/components/editor/NovelEditor.tsx:254-262`

- [ ] **Step 1: Sửa `DockLayout.tsx`, `CharacterSheet.tsx`, `RefactorRenameModal.tsx`, và `NovelEditor.tsx`**

1. Trong `src/components/workbench/DockLayout.tsx`:
   - Dòng 66: `<NovelEditor key={ch.id} chapter={ch} />`
   - Dòng 73: `<CharacterSheet key={ent.id} entity={ent} />`
2. Trong `src/components/lorebook/CharacterSheet.tsx`:
   - Thêm `useEffect` đồng bộ lại `title`, `aliases`, `status`, `faction`, `role`, `appearance`, `personality`, `body` khi `entity.id` hoặc `entity.updated_at` thay đổi từ bên ngoài (ví dụ sau khi chạy Refactor Rename).
3. Trong `src/components/modals/RefactorRenameModal.tsx`:
   - Thêm `useEffect([refactorEntityId, refactorModalOpen, targetEntity])` đặt lại:
     ```typescript
     if (targetEntity) {
       setNewName(`${targetEntity.title} (Mới)`);
       setAliasPairs(
         (targetEntity.aliases || []).map((a) => ({ from: a, to: a }))
       );
       setSelectedMatchIds(new Set());
     }
     ```
4. Trong `src/components/editor/NovelEditor.tsx`:
   - Tại dòng 256: chỉ cập nhật `setRawMarkdownDraft(serializeChapterToLosslessMarkdown(chapter))` khi `chapter.id` thay đổi hoặc khi người dùng vừa chuyển `canvasMode` sang `'markdown'` (không chạy lại trên mỗi lần `chapter.paragraphs` đổi khi đang gõ ở chính chế độ `'markdown'`).

- [ ] **Step 2: Chạy kiểm tra typecheck và test**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/workbench/DockLayout.tsx src/components/lorebook/CharacterSheet.tsx src/components/modals/RefactorRenameModal.tsx src/components/editor/NovelEditor.tsx
git commit -m "fix(editor,lore): key editor/sheet by entity id, sync refactor modal state, and stop raw markdown cursor jump"
```

---

#### Task 3.2: Gắn nhãn "Mô phỏng" minh bạch và xóa toàn bộ ID/Tên nhân vật hardcode khỏi luồng Project thật

**Files:**
- Modify: `src/stores/useAgentStore.ts:195-263`
- Modify: `src/components/ai-hub/RightDock.tsx:154-174`
- Modify: `src/components/editor/extensions/ghost-text.ts:20-55`
- Modify: `src/components/editor/NovelEditor.tsx:1140-1165,1239-1275`
- Modify: `src/app/page.tsx:93-99`
- Modify: `src/components/modals/CommandPalette.tsx:66-73`
- Modify: `src/components/workbench/Sidebar.tsx:488-503,613-619`
- Modify: `src/components/lorebook/RelationshipGraph.tsx:111-115,136-138,294-296`

- [ ] **Step 1: Cập nhật các điểm hardcode và gắn nhãn mô phỏng**

1. **Story Composer (`useAgentStore.ts` & `RightDock.tsx`):**
   - Trong `useAgentStore.ts:sendComposerPrompt`: xóa việc đẩy `newMcpLog` giả (`agent_name: 'Antigravity'`) vào `mcpLogs`; thêm tiền tố `[Mô phỏng mẫu cục bộ]` vào phản hồi của Story Composer.
   - Trong `RightDock.tsx`: hiển thị rõ nhãn `Mô phỏng (Local Template)` cạnh bộ chọn mô hình của tab Composer.
2. **Ghost Text & Slash Menu (`ghost-text.ts` & `NovelEditor.tsx`):**
   - Trong `ghost-text.ts:32-33`: đổi fallback `'Lâm Vũ Linh'` thành `'nhân vật chính'` và `'Bến Cảng Đông'` thành `'bối cảnh hiện tại'`.
   - Trong `NovelEditor.tsx:1142-1164`: lấy `const povName = chapter.pov_character_name || entities.find(e => e.entity_type === 'character')?.title || 'Nhân vật chính'` thay vì hardcode `'Lâm Vũ Linh'`.
3. **Phím tắt `Shift+F6` & Graph (`page.tsx`, `CommandPalette.tsx`, `Sidebar.tsx`, `RelationshipGraph.tsx`):**
   - Khi mở Refactor Modal (`Shift+F6` hoặc nút Refactor), tìm thực thể nhân vật đầu tiên trong `entities` (`entities.find(e => e.entity_type === 'character')?.id || entities[0]?.id || ''`); nếu dự án chưa có thực thể nào thì hiện thông báo `ipcNotice` thay vì mở modal rỗng.
   - Trong `Sidebar.tsx:490`: gắn nhãn `Nhánh (Mô phỏng):` cho bộ chọn nhánh What-If khi chưa nối `git branch`.

- [ ] **Step 2: Chạy kiểm tra typecheck và test**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/stores/useAgentStore.ts src/components/ai-hub/RightDock.tsx src/components/editor/extensions/ghost-text.ts src/components/editor/NovelEditor.tsx src/app/page.tsx src/components/modals/CommandPalette.tsx src/components/workbench/Sidebar.tsx src/components/lorebook/RelationshipGraph.tsx
git commit -m "fix(ui): label simulated AI/branch features and remove hardcoded demo character IDs"
```

---

#### Task 3.3: Nhóm Hồi truyện (`act_id`) động trên Sidebar, sửa `reorderChapters` / `createChapter` / `closeTab` / `toggleSplitView` và tối ưu `useMemo`

**Files:**
- Modify: `src/components/workbench/Sidebar.tsx:53-170`
- Modify: `src/stores/useWorkspaceStore.ts:247-293,343-395`

- [ ] **Step 1: Viết test trong `src/lib/__tests__/ipc-fallback.test.ts`**

Thêm test kiểm tra:
1. `reorderChapters(0, 1)` cập nhật lại trường `order` của các chương theo đúng thứ tự mới (`1, 2, ...`) và giữ nguyên không trùng `file_path` khi `createChapter`.
2. `closeTab` khi đóng tab đang nằm ở `activeSecondaryTabId` sẽ chuyển `activeSecondaryTabId` sang tab còn lại (hoặc `null`).

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `npm test`
Expected: FAIL vì `reorderChapters` không cập nhật `ch.order` và `closeTab` không đổi `activeSecondaryTabId`.

- [ ] **Step 3: Implement trong `useWorkspaceStore.ts` và `Sidebar.tsx`**

1. Trong `src/stores/useWorkspaceStore.ts`:
   - `reorderChapters`: sau khi `splice`, `.map((ch, idx) => ({ ...ch, order: idx + 1 }))`.
   - `createChapter`: tìm số thứ tự `n` sao cho cả `id = ch_${pad(n)}` và `file_path = manuscript/act-01/ch-${pad(n)}.md` chưa tồn tại trong `state.chapters`.
   - `closeTab`: nếu `state.activeSecondaryTabId === tabId`, gán `activeSecondaryTabId = filtered.find(t => t.pane === 'secondary')?.id ?? filtered[0]?.id ?? null`.
   - `toggleSplitView`: nếu bật `splitView` mà chưa có tab nào ở `pane === 'secondary'`, tự động mở hoặc chọn tab thứ 2 trong `openTabs` (hoặc thêm tab `tab-lore-db` vào `openTabs`).
2. Trong `src/components/workbench/Sidebar.tsx`:
   - Dùng `useMemo` cho `allIssues` (dòng 76).
   - Nhóm `chapters` theo `ch.act_id` (hiển thị `ch.act_title || ch.act_id || 'Bản thảo'`), mặc định mở (`expanded`) mọi `act_id` có chương.

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/useWorkspaceStore.ts src/components/workbench/Sidebar.tsx src/lib/__tests__/ipc-fallback.test.ts
git commit -m "fix(workbench): dynamic act grouping in sidebar, update chapter order on reorder, and fix split tab state"
```

---

### Milestone 4 — Đồng Bộ SQLite, Linter Tiếng Việt Unicode & Refactor Ranh Giới Từ (F2.09, F2.10, F2.12)

#### Task 4.1: Kiểm tra ranh giới từ Unicode (`Word Boundary`) cho Refactor Rename & Linter trên cả Rust và TypeScript

**Files:**
- Create: `src/lib/word-boundary.ts`
- Modify: `src/lib/tauri-bridge.ts:221-250,479-515`
- Modify: `src/stores/useWorkspaceStore.ts:413-443`
- Modify: `src-tauri/src/core_engine/refactor.rs:14-49`
- Modify: `src-tauri/src/core_engine/linter.rs:39-140`
- Modify: `src/lib/__tests__/novel-engine.test.ts`

**Interfaces:**
- Produces in `src/lib/word-boundary.ts`:
  - `export function isUnicodeWordBoundary(text: string, start: number, end: number): boolean`
  - `export function containsWholeWordUnicode(text: string, token: string): boolean`
  - `export function replaceWholeWordUnicode(text: string, fromToken: string, toToken: string): string`

- [ ] **Step 1: Viết failing tests trong `src/lib/__tests__/novel-engine.test.ts` và `src-tauri/src/core_engine/refactor.rs` / `linter.rs`**

1. Trong `src/lib/__tests__/novel-engine.test.ts`:
   - Test `buildRefactorRenamePreview` và `replaceWholeWordUnicode`: đổi tên `"An"` → `"Bình"` trong câu `"An bước đi trong đêm an toàn cùng Công an và An."` phải cho ra `"Bình bước đi trong đêm an toàn cùng Công an và Bình."` (không biến `"Công an"` thành `"Công Bình"` hay `"Anh"` thành `"Bìnhh"`).
   - Test `scanImplicitEntities`: nhân vật có biệt danh `"An"` không được khớp nhầm vào chữ `"Anh"` hay `"an toàn"`.
2. Trong `src-tauri/src/core_engine/linter.rs`:
   - Test nhận diện chữ hoa tiếng Việt có dấu: đoạn văn `"CHỈ HUY KHÁNH bước ra từ màn mưa."` phải kích hoạt `DEAD_CHARACTER` cho nhân vật `"Chỉ huy Khánh"`.

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `npm test && (cd src-tauri && cargo test)`
Expected: FAIL ở cả TS và Rust.

- [ ] **Step 3: Implement kiểm tra ranh giới từ Unicode và tìm kiếm không phân biệt hoa-thường tiếng Việt**

1. Tạo `src/lib/word-boundary.ts`: dùng biểu thức `/[\p{L}\p{N}_]/u` để kiểm tra ký tự liền trước `start` và liền sau `end` không phải là chữ cái/chữ số Unicode.
2. Cập nhật `scanImplicitEntities` và `buildRefactorRenamePreview` trong `src/lib/tauri-bridge.ts` cùng `applyRefactorRename` trong `src/stores/useWorkspaceStore.ts` sử dụng `containsWholeWordUnicode` và `replaceWholeWordUnicode`.
3. Trong `src-tauri/src/core_engine/refactor.rs`: thêm hàm `replace_whole_word(text: &str, from: &str, to: &str) -> Option<String>` kiểm tra ký tự liền kề bằng `!c.is_alphanumeric()`, bỏ qua nếu `from.trim().is_empty()`.
4. Trong `src-tauri/src/core_engine/linter.rs`: chuyển các pattern tìm kiếm về `.to_lowercase()` và tìm trên `para.to_lowercase()` (lấy lát cắt từ `para` gốc nếu độ dài byte khớp, hoặc fallback về lát cắt trên `para_lower`) để bắt chính xác mọi ký tự tiếng Việt viết hoa (`Â`, `Đ`, `Ư`, `Ơ`, và các dấu thanh).

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `npm test && (cd src-tauri && cargo test)`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/word-boundary.ts src/lib/tauri-bridge.ts src/stores/useWorkspaceStore.ts src-tauri/src/core_engine/refactor.rs src-tauri/src/core_engine/linter.rs src/lib/__tests__/novel-engine.test.ts
git commit -m "fix(linter,refactor): enforce Unicode word boundaries and Vietnamese case-insensitive matching"
```

---

#### Task 4.2: Đồng bộ SQLite trong Transaction, dọn thực thể mồ côi/đổi `id`, nạp `attributes`, và tự động sync sau khi lưu file

**Files:**
- Modify: `src-tauri/src/core_engine/indexer.rs:96-140`
- Modify: `src-tauri/src/core_engine/storage.rs:150-365`
- Modify: `src/stores/useWorkspaceStore.ts:137-176`

- [ ] **Step 1: Viết failing Rust test trong `src-tauri/src/core_engine/storage.rs`**

```rust
#[test]
fn sync_handles_id_change_and_prunes_deleted_files() {
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path();
    let chars = root.join("lorebook/characters");
    std::fs::create_dir_all(&chars).unwrap();

    // 1. Seed entity with id = char_v1
    std::fs::write(chars.join("linh.md"), "---\nid: char_v1\ntitle: Linh\n---\nBody").unwrap();
    std::fs::write(chars.join("temp.md"), "---\nid: char_temp\ntitle: Temp\n---\nBody").unwrap();
    let s1 = sync_workspace_to_sqlite(root).unwrap();
    assert_eq!(s1.entities_indexed, 2);

    // 2. Change id in linh.md to char_v2 and delete temp.md
    std::fs::write(chars.join("linh.md"), "---\nid: char_v2\ntitle: Linh\n---\nBody").unwrap();
    std::fs::remove_file(chars.join("temp.md")).unwrap();

    let s2 = sync_workspace_to_sqlite(root).unwrap();
    assert_eq!(s2.entities_indexed, 1);

    let db = root.join(".novelforge/index.sqlite");
    let conn = init_sqlite_db(&db).unwrap();
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM entities", [], |r| r.get(0)).unwrap();
    assert_eq!(count, 1);
}
```

- [ ] **Step 2: Chạy `cargo test` để xác nhận FAIL**

Run: `cd src-tauri && cargo test core_engine::storage::tests`
Expected: FAIL với lỗi `UNIQUE constraint failed: entities.file_path`.

- [ ] **Step 3: Implement trong `indexer.rs`, `storage.rs`, và `useWorkspaceStore.ts`**

1. Trong `src-tauri/src/core_engine/indexer.rs`:
   - Trong `upsert_entity_record`: trước khi `INSERT INTO entities`, chạy `DELETE FROM entities WHERE file_path = ?1 AND id != ?2` để nếu một file đổi `id` trong frontmatter thì bản ghi cũ bị dọn sạch.
   - Xóa hàm dead code `is_sqlite_vec_virtual_table_active` (và import ở `rag_engine.rs`).
2. Trong `src-tauri/src/core_engine/storage.rs`:
   - Thu thập tập hợp tất cả `seen_entity_ids` và `seen_file_paths` trong lần quét; xóa các dòng trong `entities` và `lore_embeddings_store` không còn nằm trong `seen_entity_ids`.
   - Đọc các trường `"appearance"`, `"personality"`, `"faction"`, `"role"` từ `parsed.frontmatter` đưa vào `character_specs.attributes` (dòng 285).
3. Trong `src/stores/useWorkspaceStore.ts`:
   - Thêm hàm `scheduleSqliteSync()` (debounce 2500ms) gọi `invokeSafe('sync_project_sqlite', { projectRoot })` sau mỗi lần `saveChapterToDisk` hoặc `saveEntityToDisk` thành công.

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `cd src-tauri && cargo test && cd .. && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/core_engine/indexer.rs src-tauri/src/core_engine/storage.rs src-tauri/src/ai_bridge/rag_engine.rs src/stores/useWorkspaceStore.ts
git commit -m "fix(sqlite): handle entity id changes, prune deleted files, and auto-sync index after save"
```

---

### Milestone 5 — Xuất Bản Chuẩn (`***`, `>`, Inline Marks), Font CSP & Duyệt Đề Xuất MCP Trên UI (F2.13, F2.16, F2.18)

#### Task 5.1: Hỗ trợ đầy đủ `***`, `> blockquote`, `**bold**`, `*italic*` khi xuất EPUB/DOCX/PDF và mở CSP cho Google Fonts

**Files:**
- Modify: `src/lib/publish/escape-html.ts:23-44`
- Modify: `src/lib/publish/docx.ts:68-96`
- Modify: `src-tauri/tauri.conf.json:24-27`
- Modify: `src/lib/__tests__/publish.test.ts`

- [ ] **Step 1: Viết failing tests trong `src/lib/__tests__/publish.test.ts`**

Thêm các kiểm thử:
1. `markdownBlockToHtml('***')` trả về `'<hr />'`.
2. `markdownBlockToHtml('> Lời trích dẫn cổ xưa')` trả về `'<blockquote>Lời trích dẫn cổ xưa</blockquote>'`.
3. `markdownBlockToHtml('Cô rút **súng lục** trong *đêm mưa*.')` trả về `'<p>Cô rút <strong>súng lục</strong> trong <em>đêm mưa</em>.</p>'` (vẫn escape an toàn mọi thẻ `<script>` bên trong).

- [ ] **Step 2: Chạy `npm test` để xác nhận FAIL**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement trong `escape-html.ts`, `docx.ts`, và `tauri.conf.json`**

1. Trong `src/lib/publish/escape-html.ts`:
   - Thêm helper `formatInlineMarkdownSafe(escapedText: string): string` biến `**...**` thành `<strong>...</strong>` và `*...*` thành `<em>...</em>` sau khi đã chạy `escapeHtml`.
   - Trong `markdownBlockToHtml`: nhận cả `trimmed === '---' || trimmed === '***'` → `'<hr />'`; nếu `trimmed.startsWith('> ')` → `'<blockquote>' + formatInlineMarkdownSafe(escapeHtml(trimmed.slice(2).trim())) + '</blockquote>'`.
2. Trong `src/lib/publish/docx.ts`:
   - Hỗ trợ `trimmed === '---' || trimmed === '***'` cho dấu ngắt cảnh `* * *`, hỗ trợ `# ` / `## ` trong thân chương, và tách inline `**bold**` / `*italic*` thành các `TextRun({ bold: true / italics: true })`.
3. Trong `src-tauri/tauri.conf.json`:
   - Cập nhật `csp`: `"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' ipc: http://ipc.localhost"`.

- [ ] **Step 4: Chạy `npm test` để xác nhận PASS**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/publish/escape-html.ts src/lib/publish/docx.ts src-tauri/tauri.conf.json src/lib/__tests__/publish.test.ts
git commit -m "fix(publish,csp): render scene breaks, blockquotes, inline marks in exports and allow Google Fonts in CSP"
```

---

#### Task 5.2: Nối luồng duyệt đề xuất MCP (`.novelforge/proposals/*.json`) lên UI và chuẩn hóa JSON-RPC trong `mcp_stdio.rs`

**Files:**
- Modify: `src-tauri/src/ai_bridge/mcp_stdio.rs:51-55,372-376`
- Modify: `src-tauri/src/commands/ai_cmd.rs:49-90`
- Modify: `src-tauri/src/lib.rs:12-31`
- Modify: `src/components/ai-hub/RightDock.tsx:367-400`

**Interfaces:**
- Produces in `src-tauri/src/commands/ai_cmd.rs`:
  - `#[tauri::command] pub async fn list_edit_proposals(project_root: String) -> Result<Vec<serde_json::Value>, String>`
  - `#[tauri::command] pub async fn dismiss_edit_proposal(project_root: String, proposal_id: String) -> Result<(), String>`

- [ ] **Step 1: Viết Rust unit test trong `src-tauri/src/ai_bridge/mcp_stdio.rs`**

Kiểm tra:
1. Gửi chuỗi JSON lỗi `"{bad json"` vào `handle_message` trả về phản hồi JSON-RPC có `"error": { "code": -32700, ... }`.
2. `tool_check_continuity` với `draft_text` dùng `\r\n\r\n` tách đúng số đoạn văn và bắt được lỗi nhân vật đã tử vong.

- [ ] **Step 2: Chạy `cargo test` để xác nhận FAIL**

Run: `cd src-tauri && cargo test ai_bridge`
Expected: FAIL.

- [ ] **Step 3: Implement trong `mcp_stdio.rs`, `ai_cmd.rs`, `lib.rs`, và `RightDock.tsx`**

1. Trong `src-tauri/src/ai_bridge/mcp_stdio.rs`:
   - Khi `serde_json::from_str(line)` lỗi: trả `json_error(Some(Value::Null), -32700, "Parse error")`.
   - Trong `tool_check_continuity`: `let normalized_draft = draft_text.replace("\r\n", "\n");` trước khi `.split("\n\n")`.
2. Trong `src-tauri/src/commands/ai_cmd.rs` & `lib.rs`:
   - Thêm command `list_edit_proposals(project_root: String)` đọc các file `.json` trong `.novelforge/proposals/` có `status == "proposed"`.
   - Thêm command `dismiss_edit_proposal(project_root: String, proposal_id: String)` xóa hoặc đánh dấu `"resolved"` cho file đề xuất.
3. Trong `src/components/ai-hub/RightDock.tsx` (tab MCP):
   - Khi `canRunRealMcp`, thêm nút `"Đồng bộ đề xuất từ .novelforge/proposals"` gọi `list_edit_proposals` và nạp vào `useAgentStore.addDiffProposal` để tác giả duyệt trực tiếp trên trình soạn thảo.

- [ ] **Step 4: Chạy toàn bộ test Rust và Frontend**

Run: `cd src-tauri && cargo test && cd .. && npm test && npm run typecheck && npm run build && npm run verify:utf8`
Expected: Tất cả PASS 100%.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/ai_bridge/mcp_stdio.rs src-tauri/src/commands/ai_cmd.rs src-tauri/src/lib.rs src/components/ai-hub/RightDock.tsx
git commit -m "feat(mcp): load disk edit proposals into IDE review flow and return JSON-RPC -32700 on parse errors"
```

---

## 5. Verification Tổng (Sau Milestone 5)

1. `npm run verify:utf8` → `0 errors, 0 warnings`.
2. `npm test` → toàn bộ unit test và integration test pass (≥ 40 tests).
3. `npm run typecheck` & `npm run build` → exit `0`.
4. `cd src-tauri && cargo test` → toàn bộ Rust test pass (≥ 16 tests).
5. Kiểm tra đủ 6 kịch bản `RF1..RF6` trong mục Review Focus đều có test tự động bảo vệ.

---

## 6. Truy Vết Phát Hiện → Task

- `F2.01`, `F2.02` → **Task 1.1**
- `F2.03` → **Task 1.2**
- `F2.04` → **Task 1.2 & Task 1.3**
- `F2.05`, `F2.20` → **Task 2.1**
- `F2.11` → **Task 2.2**
- `F2.07`, `F2.08` → **Task 3.1**
- `F2.06`, `F2.19` → **Task 3.2 & Task 3.3**
- `F2.14`, `F2.15` → **Task 3.3**
- `F2.09`, `F2.12` → **Task 4.1**
- `F2.10` → **Task 4.2**
- `F2.13` → **Task 5.1**
- `F2.16`, `F2.18` → **Task 5.2**
- `F2.17` → **Task 0.1**
