# Releasing NovelForge IDE (Windows)

## Prerequisites

1. **Rust stable** — `rustup default stable` (đã test với 1.99.1)
2. **Microsoft C++ Build Tools** — "Desktop development with C++" workload
   (provides `link.exe` + Windows SDK). Đây là prerequisite bắt buộc — không có nó,
   mọi lệnh `cargo` sẽ fail ở linker.
3. **Node.js** v18.17+ và npm — test với Node 24 / npm 12.
4. **Tauri CLI** — đã nằm trong devDependencies (`npm run tauri ...`).

## Commands

```bash
npm install
npm test                 # 31 tests
cd src-tauri && cargo test   # 11 tests
cd ..
npm run build            # static export -> out/
npm run tauri dev        # desktop dev (hot reload frontend)
npm run tauri build      # production bundle (MSI/NSIS trong src-tauri/target/release/bundle/)
```

## MCP stdio bridge

Sau khi có executable (hoặc qua `cargo run`):

```bash
novelforge-ide mcp D:/path/to/project
```

Agent bên ngoài (Cline, Claude Desktop, OpenCode) cấu hình stdio command trỏ tới binary này với `cwd` = project root.

## Not yet automated

- Không có GitHub Actions release / auto-updater — publish thủ công, upload MSI/NSIS lên GitHub Releases.
- `code-signing` chưa có (Windows SmartScreen có thể cảnh báo).
- Bundle size / RAM chưa stress-test với project 500 chương.
