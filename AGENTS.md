# AGENTS.md — NovelForge IDE

IDE desktop dành cho người viết tiểu thuyết. **Trạng thái (2026-11-05): MVP đang phát triển — core đã chạy thật trên desktop.**

## Trạng thái hiện tại

- **Desktop (Tauri v2 + Rust) chạy thật:** mở thư mục project qua dialog, đọc/ghi `manuscript/` và `lorebook/` thẳng xuống đĩa (Ctrl+S), SQLite index (`.novelforge/index.sqlite`), Linter nhất quán cốt truyện, Refactor Rename, snapshot Git thật qua `libgit2` (restore an toàn: chỉ `manuscript/` + `lorebook/`), xuất EPUB 3 / DOCX / PDF (qua print dialog).
- **MCP stdio server** (`novelforge-ide mcp [project_root]`): 4 tool thật cho agent bên ngoài — `novel_search_lore`, `novel_get_chapter_context`, `novel_check_continuity`, `novel_propose_edit` (không bao giờ tự ghi đè file).
- **Browser (`npm run dev`)**: chế độ **demo có chủ đích** với dữ liệu mẫu — không đọc/ghi file, các nút MCP hiển thị nhãn "Mô phỏng".
- **Verification:** `npm test` 31/31 · `npm run typecheck` ✅ · `npm run build` ✅ · `npm run verify:utf8` ✅ · `cargo test` 11/11.

## Đọc trước khi làm việc gì (bắt buộc)

Toàn bộ đặc tả trong `.docs/`:

| File | Nội dung |
|---|---|
| `.docs/prd-technical-architecture.md` | PRD + kiến trúc hệ thống |
| `.docs/master-execution-plan.md` | Cấu trúc repo + lộ trình 16 tuần |
| `.docs/ui-ux-specification.md` | Design system, 3 themes |
| `.docs/architecture-decisions.md` | ADR: quyết định kiến trúc (đăng ký tại đây khi đổi) |

Kế hoạch fix + trạng thái từng milestone: **`planfix_01.md`** (đọc trước khi sửa core).

## Tech stack

- **Backend:** Rust + Tauri v2 (`src-tauri/`): fs (scoped canonical path), parser Markdown+YAML (chịu CRLF), linter continuity, SQLite (entities / entity_mentions / lore_embeddings_store), RAG hybrid (BM25 + feature-hash vector, **không phải sqlite-vec vec0**), VCS (libgit2), MCP stdio server.
- **Frontend:** Next.js 15 `output: 'export'`, TipTap, Zustand, Dockview, `@xyflow/react`.
- **Không có server backend bên ngoài** — local-first.

## Quy ước

- Tài liệu/UI tiếng Việt; code/tên biến/comment tiếng Anh.
- Cấu trúc thư mục khớp `master-execution-plan.md` — không đổi tên module tùy ý.
- **Demo fallback phải luôn có nhãn** ("Mô phỏng" / "Demo") — không được im lặng giả vờ gọi backend.
- Mọi tính năng mới đụng file/git/DB phải có test Rust tương ứng; `cargo test` và `npm test` phải xanh trước khi commit.
- File text = UTF-8; repo chịu CRLF của Windows (parser đã normalize) — chạy `npm run verify:utf8` khi nghi ngờ.
- Thay đổi kiến trúc → cập nhật `.docs/` + ADR tương ứng.
