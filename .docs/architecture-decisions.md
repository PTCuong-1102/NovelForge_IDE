# Architecture Decision Records — NovelForge IDE

> Ghi nhận các quyết định kiến trúc đã chốt. Khi đổi hệ trọng, thêm ADR mới (không sửa ADR cũ — mark `Superseded by ADR-xxx`).

## ADR-001: Publishing client-side (jszip + docx), không thêm server

- **Ngày:** 2026-11-05 · **Trạng thái:** Accepted
- **Quyết định:** EPUB 3 sinh bằng `jszip`, DOCX bằng package `docx` — toàn bộ chạy trong WebView, không cần server hay binary riêng. PDF giữ `window.print()` (người dùng chọn "Lưu dưới dạng PDF").
- **Hệ quả:** giữ được `output: 'export'` (static), không phá local-first; PDF phụ thuộc hộp thoại in của OS; EPUB chưa embed font Literata (dùng serif fallback).

## ADR-002: Browser fallback = Demo có chủ đích, không giả vờ backend

- **Ngày:** 2026-11-05 · **Trạng thái:** Accepted
- **Quyết định:** `src/lib/ipc.ts` trả `NOT_IN_TAURI` khi không có `window.__TAURI_INTERNALS__`; UI hiển thị nhãn "Mô phỏng" / "Demo" rõ ràng; dữ liệu mẫu nằm trong `src/lib/ipc-demo.ts`, chỉ load khi user chọn "Mở project demo" (hoặc browser lần đầu). Initial state là workspace rỗng.
- **Hệ quả:** không bao giờ im lặng ghi/đọc file khi chạy web; mọi hành vi khác desktop đều có nhãn; người dùng không nhầm dữ liệu mẫu với project thật.

## ADR-003: Git snapshot qua git2 — restore không reset branch, chỉ ghi đè manuscript/ + lorebook/

- **Ngày:** 2026-11-05 · **Trạng thái:** Accepted
- **Quyết định:** `create_snapshot` chỉ stage `manuscript/` và `lorebook/`; commit trailer `NovelForge-Snapshot: true` + `NovelForge-Words` để list/delta chính xác. `restore_snapshot` dùng `checkout_tree` với path giới hạn (`manuscript`, `lorebook`), **không** move HEAD, **không** đụng file khác; luôn yêu cầu `confirm=true`.
- **Hệ quả:** restore không mất dữ liệu chưa commit ngoài 2 thư mục này; không rewrite lịch sử; app từ chối snapshot rỗng (`NOTHING_TO_COMMIT`).

## ADR-004: Không dùng sqlite-vec vec0 trong v1 — brute-force cosine + BM25

- **Ngày:** 2026-11-05 · **Trạng thái:** Accepted (ghép ADR-003 gap)
- **Quyết định:** RAG hiện dùng bảng thường `lore_embeddings_store` (embedding feature-hash 768-d, deterministic) + hybrid BM25 boost; `vec0` virtual table chỉ thử tạo, fail thì log và fallback (trước đây nuốt lỗi im lặng).
- **Hệ quả:** tìm kiếm ngữ nghĩa hoạt động offline, không cần loadable extension; độ chính xác thấp hơn embedding thật; khi có Ollama + `sqlite-vec` thật, thay embedding generator trong `rag_engine.rs` là đủ (schema không đổi đáng kể).

## ADR-005: IPC file commands bị scope vào project root canonical

- **Ngày:** 2026-11-05 · **Trạng thái:** Accepted
- **Quyết định:** mọi command đụng FS nhận `project_root`, resolve qua `canonical_within()` (components-aware, canonicalize parent cho file chưa tồn tại) → từ chối path thoát ra ngoài root (`OutsideProjectRoot`). CSP `default-src 'self'` + capability tối thiểu (`core:default`, `dialog:allow-open`).
- **Hệ quả:** renderer bị compromise cũng không đọc/ghi tuỳ ý; test `paths::tests` ghim hành vi; các command mới đụng FS bắt buộc dùng helper này.

## ADR-006: Demo ↔ Production tách lớp, initial state rỗng

- **Ngày:** 2026-11-05 · **Trạng thái:** Accepted
- **Quyết định:** Zustand persist bump `version: 2` (v1 bị loại bỏ); initial state = workspace rỗng + màn hình chào ("Mở thư mục project…" chỉ desktop / "Mở project demo"); mở project thật → đọc đĩa → entities/chapters inject vào store; mọi edit debounce 1s (chapters) / 1.5s (entities) ghi thẳng xuống đĩa; Ctrl+S flush + git snapshot thật.
- **Hệ quả:** user không bao giờ thấy "Huyết Cảng" như project của mình; mở lại app desktop nhớ project cũ (persist v2); browser luôn sạch.

## ADR-007: MCP cho agent bên ngoài qua stdio, IDE không nhúng sidecar

- **Ngày:** 2026-11-05 · **Trạng thái:** Accepted
- **Quyết định:** `novelforge-ide mcp [project_root]` chạy JSON-RPC 2.0 stdio với 4 tool thật (search_lore / get_chapter_context / check_continuity / propose_edit). `novel_propose_edit` **không ghi đè file** — lưu `.novelforge/proposals/*.json`. IDE gọi cùng các tool qua `mcp_execute_tool` IPC khi project mở trên đĩa; tab "External Agents" hiển thị trạng thái chưa kích hoạt thay vì PID/log giả.
- **Hệ quả:** agent bên ngoài (Cline/Claude/OpenCode) dùng được ngay với SQLite/linter thật; chat-embedding trong IDE vẫn là demo chờ tích hợp model thật; file proposal cần UI duyệt sau này (roadmap).
