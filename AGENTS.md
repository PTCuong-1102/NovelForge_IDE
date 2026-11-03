# AGENTS.md — NovelForge IDE

IDE desktop dành cho người viết tiểu thuyết. **Trạng thái: giai đoạn 0 — chưa có code, chỉ có tài liệu đặc tả.**

## Đọc trước khi làm việc gì (bắt buộc)

Toàn bộ đặc tả nằm trong `.docs/`:

| File | Nội dung |
|---|---|
| `.docs/prd-technical-architecture.md` | PRD + kiến trúc hệ thống (Tauri v2 + Next.js + SQLite/sqlite-vec + MCP) |
| `.docs/master-execution-plan.md` | Cấu trúc repo chuẩn + lộ trình 16 tuần (4 sprint) |
| `.docs/ui-ux-specification.md` | Design system, 3 themes, wireframe workbench, breakpoint |

## Tech stack mục tiêu

- **Backend:** Rust + Tauri v2 (`src-tauri/`): fs, parser Markdown+YAML frontmatter, linter continuity, refactor rename, MCP server nội bộ, RAG (sqlite-vec), VCS (libgit2 + `similar`).
- **Frontend:** Next.js 15 App Router, `output: 'export'` (static), TailwindCSS + Shadcn UI + Dockview + TipTap + React Flow + Zustand (`src/`).
- **Không dùng server backend bên ngoài** — local-first, mọi thứ chạy trong WebView + native core.

## Quy ước

- Tài liệu/tiết lệnh bằng tiếng Việt; code, tên biến, comment code bằng tiếng Anh.
- Cấu trúc thư mục và đường dẫn file phải khớp đúng với `master-execution-plan.md` (mục 1) — không đổi tên module tùy ý.
- Mọi thay đổi kiến trúc phải cập nhật lại file spec tương ứng trong `.docs/`.
