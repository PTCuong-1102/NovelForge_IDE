# NovelForge IDE — Kế Hoạch Fix Chi Tiết (planfix_01)

> **For agentic workers:** REQUIRED SUB-SKILL: dùng `superpowers:subagent-driven-development` (khuyến nghị) hoặc `superpowers:executing-plans` để thực thi tuần tự từng task. Mỗi task kết thúc bằng một deliverable kiểm thử độc lập. Dùng checkbox `- [ ]` để tracking.

**Goal:** Đưa NovelForge IDE từ trạng thái "UI demo chạy bằng mock data + backend Rust rời rạc chưa nối dây, toolchain chưa verify" về trạng thái **MVP chạy thật, có thể mở project, đọc/ghi file, chạy linter, xuất bản thật, snapshot Git thật — tất cả qua IPC Rust**, với bảo mật tối thiểu và tài liệu trung thực.

**Architecture:** Giữ nguyên kiến trúc layered hiện có (Next.js static export ↔ Tauri v2 IPC ↔ Rust core + SQLite). Không thêm server ngoài, không đổi framework. Frontend chỉ giữ hiển thị/editor state; mọi thao tác file/lint/git/publish thực hiện ở Rust khi chạy trong Tauri; fallback browser chỉ còn vai trò **demo offline có chủ đích** (rõ ràng, không giả vờ là backend thật).

**Tech Stack:** Next.js 15 (`output: 'export'`), React 19, TipTap, Zustand, Dockview; Rust/Tauri v2, `rusqlite` (bundled), `aho-corasick`, `git2`, `similar`; Node `node:test` + `tsx` cho test frontend; Vitest không bắt buộc — giữ runner hiện tại.

**Spec:** `.docs/prd-technical-architecture.md` (kiến trúc đích), `.docs/master-execution-plan.md` (lộ trình 16 tuần), `.docs/ui-ux-specification.md`, `.docs/superpowers-ui-redesign-spec.md`. Plan này sửa **khoảng cách giữa spec và hiện trạng code**; khi plan mâu thuẫn với spec, spec thắng và plan phải được cập nhật lại.

**Ngày lập:** 2026-11-05 | **Trạng thái code đầu vào:** commit `e6e0c1a` (nhánh `main`)

---

## 0. Đính chính phát hiện trước khi fix (quan trọng)

Khảo sát lại trực tiếp code cho thấy **một phát hiện trong báo cáo phân tích ban đầu là sai** và phải loại khỏi plan:

- ~~"Encoding UTF-8 toàn repo bị double-decode (mojibake)"~~ → **SAI.** Kiểm tra byte-level: mọi file rà soát (`linter.rs`, manuscript, README, docs) đều là **UTF-8 hợp lệ, code point tiếng Việt đúng** (vd `[hởi tưởng]` trong `linter.rs:160` thực chất là `[hồi tưởng]` = U+0068 U+1ED3 U+0069 ...). Các glyph hiển thị dạng `?`/`�` khi chạy trong PowerShell là do **console code page (CP1252/legacy)**, không phải hỏng dữ liệu. 3 điểm nghi ngờ còn lại (`Â` trong "CÁC", "PHẦN") đều hợp lệ. **Không có task sửa encoding.** Thay vào đó, Task 2.1 chỉ thêm kiểm tra UTF-8 tự động vào CI/script để chặn regression thật.

Các phát hiện **đã xác minh đúng** (sẽ fix):

| # | Phát hiện | Bằng chứng |
|---|---|---|
| F1 | `node_modules/` chưa cài → `npm test` / `build` / `tsc` fail | lỗi `Cannot find package 'tsx'` |
| F2 | `cargo check` fail ở linker `link.exe` (thiếu MSVC Build Tools) | error từ cargo |
| F3 | Frontend **zero** lời gọi `invoke()` / `@tauri-apps/api`; toàn bộ data hardcode (`useWorkspaceStore.ts` `INITIAL_*`, persist localStorage) | grep = 0 kết quả |
| F4 | Git snapshot **giả**: `snapshot.rs` trả object hardcode; `git2` khai báo trong `Cargo.toml:27` nhưng không hề dùng; `list_snapshots` trả 1 snapshot cứng | đọc trực tiếp file |
| F5 | Publishing **giả**: "EPUB" thực chất tải file `.html`, "DOCX" tải file `.md`; `PublishModal.tsx:144-148`; không có lib EPUB/DOCX | đọc trực tiếp |
| F6 | **HTML injection** trong print window: manuscript thô nội suy thẳng vào `<p>${block}</p>` không escape (`PublishModal.tsx:128,162`) | đọc trực tiếp |
| F7 | **Bảo mật IPC:** `"csp": null` (`tauri.conf.json:25`); **không có** `src-tauri/capabilities/`; commands nhận đường dẫn tuyệt đối tùy ý (`fs_cmd.rs`) → renderer compromise = đọc/ghi mọi file | đọc trực tiếp |
| F8 | MCP server **giả**: `ai_cmd.rs` echo arguments, không dispatch tool; `agent_runner.rs` dùng `which` (không có trên Windows) và không được gọi | khảo sát + grep |
| F9 | `src-tauri/icons/` **không tồn tại** nhưng `tauri.conf.json:32-37` trỏ vào → `tauri build` fail | `Test-Path` = False |
| F10 | Dead code/deps: `git2`, `notify`, `notify-debouncer-full`, `specta`, `tauri-specta` không dùng; `agent_runner.rs`, `is_sqlite_vec_virtual_table_active`, các hàm `storage.rs` không command nào gọi | grep |
| F11 | README/AGENTS.md/CLAUDE.md **overclaim** ("compiler-grade", tất cả `[x]`; AGENTS.md ghi "giai đoạn 0 chưa có code") | đọc trực tiếp |
| F12 | sqlite-vec: `vec0` tạo trong `let _ =` nuốt lỗi; "embedding" là feature-hashing deterministic — không phải semantic | khảo sát |
| F13 | Logic lặp TS↔Rust dễ drift (`tauri-bridge.ts` mirror `core_engine/*`); 1 test giả (`novel-engine.test.ts` test 11 chỉ `fs.existsSync` file Rust); nhiều test kiểu "grep-as-test" | khảo sát |
| F14 | `tauri.conf.json` không khớp `AGENTS.md` quy ước? (dev port 3456 khớp — OK; bundle icons lỗi — F9) | đọc |
| F15 | `eslint.ignoreDuringBuilds: true` (`next.config.mjs:8`) → chất lượng không được gate | đọc |
| F16 | `agent_runner.rs` / `lib.rs:31` `.expect()` panic khi run lỗi | đọc |
| F17 | Mock "Huyết Cảng 2026" hiện như project thật khi user mở app lần đầu | `useWorkspaceStore.ts:95,221,348,393,434` |

---

## 1. Global Constraints

Ràng buộc toàn dự án; mọi task ngầm định tuân thủ:

1. **Không thêm server backend ngoài.** Local-first. Mọi tính năng mới phải chạy trong WebView + Rust core.
2. **Spec thắng plan.** Thay đổi kiến trúc → cập nhật `.docs/` tương ứng (quy ước `AGENTS.md`).
3. **Tiếng Việt cho tài liệu/comment người dùng thấy; tiếng Anh cho tên biến, code, comment kỹ thuật.**
4. **Không đổi cấu trúc thư mục** so với `master-execution-plan.md` mục 1; nếu cần thêm module thì thêm theo pattern hiện có (`core_engine/`, `vcs/`, `commands/`).
5. **Static export bắt buộc:** `next.config.mjs` giữ `output: 'export'`; mọi dependency dùng trong browser phải tương thích static (không Node API trong client bundle trừ `node:test` trong `__tests__`).
6. **UTF-8 everywhere.** Không hardcode path tuyệt đối của máy dev vào code; không commit `node_modules/`, `src-tauri/target/` (đã gitignore — giữ nguyên).
7. **IPC phải type-safe tối thiểu:** mỗi `#[tauri::command]` có tham số/trả về `serde`-serializable và frontend wrapper tương ứng trong `src/lib/tauri-bridge.ts` với cùng tên field.
8. **Không phá vỡ demo offline** khi build web (`npm run dev` không cần Tauri): fallback phải hiển thị badge "Chế độ demo (dữ liệu mẫu)" — không được im lặng giả vờ dữ liệu thật.
9. **Lint gate:** sau Milestone 7, `npm run build` phải pass với `eslint` chạy thật (bỏ `ignoreDuringBuilds` khi warnings = 0 — nếu quá nhiều warning, giữ flag nhưng ghi issue theo dõi, không để ẩn).
10. **Commit nhỏ, thường xuyên** (mỗi task ≥ 1 commit), nhánh làm việc `fix/planfix-01` tách từ `main`; không commit thẳng `main`.

## 2. Review Focus — 5 nhóm lỗi dễ cắn nhất (và test ghim chúng)

| # | Kịch bản | Hành vi đúng | Task sở hữu + test ghim |
|---|---|---|---|
| R1 | IPC `read_markdown_file` với path `..\..\secret.txt` hoặc path ngoài project root | Từ chối với lỗi rõ ràng, **không** đọc/ghi | Task 1.1 — `fs_cmd` unit test `rejects_path_outside_project_root` |
| R2 | Manuscript chứa `<script>alert(1)</script>` → export PDF/EPUB | Nội dung bị escape; không script/attribute nào được thực thi trong print/reader | Task 4.1 — `escapeHtml` unit tests trong `src/lib/__tests__/publish.test.ts` |
| R3 | `npm run dev` (browser, không Tauri) sau khi gỡ mock → `invoke` undefined, app crash trắng | `isTauriRuntime() === false` → fallback demo rõ ràng, app vẫn render, banner demo hiển thị | Task 3.1 — `src/lib/__tests__/ipc-fallback.test.ts` |
| R4 | `git snapshot` trên thư mục **chưa phải repo git** / HEAD unborn / detached / không có quyền ghi `.git` | Trả lỗi có cấu trúc (`GitError::NotARepo` …), UI hiện thông báo, **không panic, không tạo file rác** | Task 5.2/5.3 — `#[cfg(test)]` trong `vcs/snapshot.rs` với tempdir |
| R5 | EPUB/DOCX sinh từ project **0 chương** hoặc chương rỗng / frontmatter lỗi / thiếu `title` | Không crash; trả lỗi "Không có chương để xuất bản" hoặc file hợp lệ với placeholder rõ ràng | Task 4.2/4.3 — unit tests empty-input |
| R6 | File `.md` UTF-8/no-BOM + CRLF mix từ Windows | Parser roundtrip không mất nội dung; snapshot word_count ổn định | Task 2.1 — `verify-utf8` script + parser roundtrip test chạy trên `manuscript/` thật |

(6 dòng — R6 được giữ lại vì rẻ và hay cắn thật trên Windows.)

---

## 3. File Structure (quyết định phân rã)

**Tạo mới:**
- `src/lib/ipc.ts` — wrapper duy nhất gọi Tauri: `isTauri()`, `invokeSafe<T>()` với fallback; **mọi** gọi IPC đi qua đây (không gọi `invoke` trực tiếp trong component).
- `src/lib/ipc-demo.ts` — fallback demo tách riêng (di chuyển mock INITIAL_* ra khỏi production path của store).
- `src/lib/publish/escape-html.ts` — `escapeHtml(s)`, `stripAuthorNotes(md)`.
- `src/lib/publish/epub.ts` — build EPUB 3 (client-side, `jszip`).
- `src/lib/publish/docx.ts` — build DOCX (`docx` package).
- `src/lib/publish/compile-manuscript.ts` — logic `compileManuscript()` tách từ `PublishModal.tsx` để test được (thuần hàm).
- `src/lib/__tests__/publish.test.ts`, `src/lib/__tests__/ipc-fallback.test.ts`, `src/lib/__tests__/compile-manuscript.test.ts`
- `src-tauri/capabilities/default.json` — permission tối thiểu + scope.
- `src-tauri/tests/snapshot_git.rs` — integration test git2 với tempdir (hoặc `#[cfg(test)]` trong `snapshot.rs`; chọn 1 — xem Task 5.2).
- `scripts/verify-utf8.mjs` — kiểm tra toàn repo decode UTF-8 nghiêm ngặt.
- `.gitattributes` — `* text=auto eol=lf`, binary patterns.
- `src-tauri/icons/*` — generate bằng `npx tauri icon`.

**Sửa:**
- `src/stores/useWorkspaceStore.ts` — bỏ `INITIAL_*` hardcode khỏi initial state; load từ IPC; flag demo; `createGitSnapshot`/`listSnapshots` gọi IPC.
- `src/lib/tauri-bridge.ts` — giữ parser/word-count/linter **chỉ** làm fallback + re-export pure functions dùng chung test; bỏ phần "mirror" không được gọi (hoặc xóa sau khi Rust là nguồn sự thật).
- `src/components/modals/PublishModal.tsx` — dùng `compile-manuscript` + real builders; HTML print escape.
- `src/components/modals/RefactorRenameModal.tsx` — preview qua IPC khi có Tauri.
- `src/components/workbench/Sidebar.tsx`, `src/app/page.tsx`, `StatusBar.tsx` — banner demo, trạng thái "không kết nối Rust".
- `src-tauri/src/commands/fs_cmd.rs` — canonical path + prefix check; lỗi typed.
- `src-tauri/src/vcs/snapshot.rs` — implement thật bằng `git2`.
- `src-tauri/src/lib.rs` — bỏ `.expect()`; đăng ký `restore_snapshot` (Task 5.4).
- `src-tauri/src/ai_bridge/*`, `commands/ai_cmd.rs` — Milestone 6.
- `README.md`, `AGENTS.md`, `CLAUDE.md`, `.docs/*` — Milestone 8 (tài liệu trung thực).
- `next.config.mjs` — bỏ/giữ `ignoreDuringBuilds` theo Task 7.4.
- `package.json` — scripts: `typecheck`, `verify:utf8`; deps: `jszip`, `docx` (+ dev types nếu cần).
- `src-tauri/Cargo.toml` — thêm `tempfile` (dev-dependencies), bỏ deps chết (Milestone 7).

**Xóa:**
- `src-tauri/src/ai_bridge/agent_runner.rs` (+ mod export) — dead, sai platform, không ai gọi.
- Test giả trong `src/lib/__tests__/novel-engine.test.ts` test 11 (thay bằng assert thật hoặc xóa).

---

## 4. Lộ trình Milestone & Task

Thứ tự bắt buộc: **M0 → M1 → M2 → M3 → M4 → M5 → M6 → M7 → M8**. Trong mỗi milestone, task đánh số thứ tự thực thi. Mỗi milestone kết thúc bằng **Verification Gate** (lệnh + kỳ vọng).

---

### Milestone 0 — Nền tảng xác minh (toolchain + baseline)

> Chặn mọi milestone sau: không có baseline xanh thì không có "fix xong".

#### Task 0.1: Cài deps frontend & chốt baseline test/build

**Files:** `package.json` (scripts mới), không sửa source logic.

- [ ] **Step 1:** Chạy `npm install` ở repo root. Kỳ vọng: exit 0; `node_modules/` tồn tại.
- [ ] **Step 2:** Thêm scripts vào `package.json`: `"typecheck": "tsc --noEmit"`, `"verify:utf8": "node scripts/verify-utf8.mjs"`.
- [ ] **Step 3:** Chạy `npm test`. Ghi nhận **baseline**: kỳ vọng pass 16/16 (2 file test). Nếu fail → liệt kê test fail vào `planfix_01.md` mục "Baseline failures" và fix tối thiểu để xanh (không nới assert).
- [ ] **Step 4:** Chạy `npm run build`. Kỳ vọng: export static ra `out/` exit 0 (bỏ qua warning eslint vì `ignoreDuringBuilds` đang bật). Nếu fail do type error → fix type, không tắt check.
- [ ] **Step 5:** Commit: `chore: install deps and add typecheck/verify scripts`

#### Task 0.2: Rust toolchain — MSVC linker + cargo check/test baseline

**Files:** không sửa code.

- [ ] **Step 1:** Cài **Visual Studio Build Tools 2022** với workload "Desktop development with C++" (gồm MSVC + Windows SDK). Hoặc `choco install visualstudio2022buildtools --package-parameters "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"`. Khởi động lại shell sau cài.
- [ ] **Step 2:** Chạy `rustc --version` và `cargo --version`; ghi phiên bản vào `planfix_01.md` (Baseline).
- [ ] **Step 3:** `cd src-tauri; cargo check` → kỳ vọng compile tới code Rust (resolution OK). Nếu lỗi crate (vd `git2` cần libgit2): build bình thường vì `libgit2-sys` vendor sẵn source, chỉ cần MSVC. Ghi mọi lỗi còn lại.
- [ ] **Step 4:** `cargo test` → kỳ vọng 3 unit test pass (`parser.rs`, `linter.rs`, `rag_engine.rs`). Nếu fail → ghi baseline, fix ở milestone tương ứng.
- [ ] **Step 5:** Commit (nếu có thay đổi lockfile): `chore: rust toolchain baseline`

#### Task 0.3: Icons Tauri + `tauri build` smoke test

**Files:** `src-tauri/tauri.conf.json`, `src-tauri/icons/*` (tạo)

- [ ] **Step 1:** Tạo ảnh nguồn 1024×1024 (logo đơn giản; dùng asset có sẵn hoặc generate 1 lần) lưu `src-tauri/icons/app-icon.png`.
- [ ] **Step 2:** Chạy `npx tauri icon src-tauri/icons/app-icon.png` → kỳ vọng sinh `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`.
- [ ] **Step 3:** Sửa `tauri.conf.json` giữ nguyên icon list (đã khớp). Thêm `"bundle": { "active": true }` như cũ; không đổi identifier.
- [ ] **Step 4:** Chạy `npm run tauri build -- --no-bundle` (hoặc `npx tauri build --no-bundle`) → kỳ vọng exit 0. Nếu CLI v2 không hỗ trợ `--no-bundle`, chạy full `npm run tauri build` và chấp nhận thời gian build dài; kỳ vọng MSI/NSIS sinh ra trong `src-tauri/target/release/bundle/`.
- [ ] **Step 5:** Commit: `fix(tauri): generate bundle icons so tauri build works`

#### Task 0.4: Baseline report

- [ ] **Step 1:** Thêm mục `## Baseline (sau M0)` vào cuối `planfix_01.md`: node/npm/cargo/rustc versions, kết quả `npm test` / `build` / `cargo check` / `cargo test` / `tauri build`.
- [ ] **Step 2:** Commit: `docs: record planfix_01 baseline`

**Gate M0:** `npm test` xanh · `npm run build` exit 0 · `cargo check` không lỗi linker · icons tồn tại · baseline ghi lại.

---

### Milestone 1 — Bảo mật tối thiểu IPC + injection

> Ưu tiên cao nhất về rủi ro: renderer compromise hiện = đọc/ghi toàn ổ đĩa.

#### Task 1.1: Scope fs commands vào project root (Rust)

**Files:** `src-tauri/src/commands/fs_cmd.rs`, `src-tauri/src/lib.rs` (đăng ký helper nếu cần), `src-tauri/src/core_engine/paths.rs` (tạo — helper canonicalization dùng chung)

**Interfaces (Produces):**
- `pub fn canonical_within(root: &Path, candidate: &Path) -> Result<PathBuf, FsError>` — canonicalize cả hai, trả `Err(FsError::OutsideProjectRoot)` nếu candidate không nằm trong root; tự tạo file chưa tồn tại bằng canonicalize parent.
- `pub enum FsError` (serde-serializable): `OutsideProjectRoot`, `NotFound`, `Io(String)`.

- [ ] **Step 1: Viết failing test** trong `fs_cmd.rs` (module `#[cfg(test)]`):
  - `rejects_path_outside_project_root`: root = tempdir; candidate = `root.join("..").join("secret.txt")` → expect `OutsideProjectRoot`.
  - `accepts_path_inside_project_root`: `root/manuscript/ch-01.md` → Ok.
  - `rejects_absolute_path_elsewhere`: `C:\Windows\win.ini` → Err.
- [ ] **Step 2:** Chạy `cargo test fs_cmd` → fail (helper chưa có).
- [ ] **Step 3:** Implement `paths.rs` + dùng trong `read_markdown_file`, `write_markdown_file`, `read_project_tree`, `init_project_workspace`, `sync_project_sqlite`. Mỗi command nhận thêm `project_root: String` (breaking change có chủ đích — frontend chưa gọi, an toàn). Trả `FsError` qua `Result<_, FsError>`.
- [ ] **Step 4:** `cargo test` → pass.
- [ ] **Step 5:** Commit: `security(fs): scope all file commands to canonical project root`

#### Task 1.2: Capabilities + CSP

**Files:** `src-tauri/capabilities/default.json` (tạo), `src-tauri/tauri.conf.json`

- [ ] **Step 1:** Tạo capability tối thiểu:
  ```json
  {
    "$schema": "../gen/schemas/desktop-schema.json",
    "identifier": "default",
    "description": "Minimal permissions for NovelForge IDE",
    "windows": ["main"],
    "permissions": ["core:default"]
  }
  ```
  (Không thêm `fs:*` plugin nào — fs đi qua custom commands đã được scope ở Task 1.1.)
- [ ] **Step 2:** `tauri.conf.json` → `"security": { "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ipc: http://ipc.localhost" }`. Ghi chú: production build không remote Google Fonts (next/font self-host) nên `'self'` đủ.
- [ ] **Step 3:** `npm run tauri dev` smoke: app mở, không CSP violation trong console cho luồng chính (mở project demo, gõ text). Ghi nhận nếu có violation → nới đúng directive bị chặn, không nới `default-src`.
- [ ] **Step 4:** Commit: `security(tauri): add capability file and strict CSP`

#### Task 1.3: Escape HTML trong toàn bộ đường export (print + HTML epub)

**Files:** `src/lib/publish/escape-html.ts` (tạo), `src/components/modals/PublishModal.tsx`, `src/lib/__tests__/publish.test.ts` (tạo)

**Interfaces (Produces):**
- `escapeHtml(input: string): string` — escape `& < > " '`.
- `stripAuthorNotes(markdown: string): string` — xóa các block khớp `> [!GHI_CHÚ_TÁC_GIẢ]` … tới dòng trống kế tiếp (và biến thể `[!GHI_CHU_TAC_GIA]`).
- `markdownBlockToHtml(block: string): string` — map heading/hr/p như logic hiện có nhưng **escape trước khi nội suy**.

- [ ] **Step 1: Viết failing tests** (`publish.test.ts`, chạy `npm test`):
  - `escapeHtml`: `'<script>alert("x")</script> & \' '` → đúng thực thể.
  - `markdownBlockToHtml('<img src=x onerror=alert(1)>')` → không chứa `<img`; có `&lt;img`.
  - `stripAuthorNotes`: input chứa `> [!GHI_CHÚ_TÁC_GIẢ]\nsecret\n\nĐoạn thật` → kết quả không chứa `secret`, vẫn chứa `Đoạn thật`.
  - R5: `markdownBlockToHtml('')` → `'<p></p>'` không crash.
- [ ] **Step 2:** `npm test` → fail.
- [ ] **Step 3:** Implement `escape-html.ts`; refactor `PublishModal.tsx` dùng `markdownBlockToHtml` cho cả PDF print và nhánh EPUB-HTML; giữ `fileExt` tạm thời (EPUB thật ở M4).
- [ ] **Step 4:** `npm test` → pass.
- [ ] **Step 5:** Commit: `security(publish): escape manuscript HTML and strip author notes`

#### Task 1.4: Dọn dead/unsafe native code

**Files:** `src-tauri/src/ai_bridge/agent_runner.rs` (xóa), `src-tauri/src/ai_bridge/mod.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/core_engine/indexer.rs`, `src-tauri/src/core_engine/storage.rs`

- [ ] **Step 1:** Xóa `agent_runner.rs` và export trong `ai_bridge/mod.rs`.
- [ ] **Step 2:** Trong `indexer.rs`: thay `let _ = ... vec0` bằng kiểm tra lỗi thật — nếu `vec0` không tồn tại thì log warning 1 lần và tiếp tục (RAG brute-force vẫn chạy); xóa hoặc wire `is_sqlite_vec_virtual_table_active` (nếu xóa, cập nhật mọi tham chiếu).
- [ ] **Step 3:** `lib.rs:31` — thay `.expect(...)` bằng `if let Err(e) = app.run(...) { eprintln!("tauri error: {e}"); std::process::exit(1); }`.
- [ ] **Step 4:** Xóa các hàm `storage.rs` không command nào gọi (`save_markdown_document`, `load_markdown_document`, `blocks_to_markdown` nếu dead — xác nhận bằng grep trước khi xóa).
- [ ] **Step 5:** `cargo check` + `cargo test` pass → Commit: `chore(rust): remove dead agent_runner and unused storage helpers`

**Gate M1:** `cargo test` xanh; path traversal bị chặn (test chứng minh); print/EPUB escape đúng (test chứng minh); `tauri dev` không CSP violation luồng chính.

---

### Milestone 2 — Dữ liệu mẫu & kiểm tra UTF-8/CRLF

> Không sửa "encoding" (không tồn tại bug); chỉ khóa regression và tách dữ liệu mẫu khỏi UX thật.

#### Task 2.1: `scripts/verify-utf8.mjs` + `.gitattributes`

**Files:** `scripts/verify-utf8.mjs` (tạo), `.gitattributes` (tạo), `package.json` (script đã thêm ở 0.1)

- [ ] **Step 1:** Viết `verify-utf8.mjs`: duyệt repo (bỏ qua `node_modules`, `.git`, `src-tauri/target`, `out`, lockfile); với mỗi file text (`.ts .tsx .rs .md .css .json .mjs .js .toml .yml .yaml .svg`) đọc `Buffer`, dùng `new TextDecoder('utf-8', { fatal: true })`; lỗi → in path + exit 1. Cũng cảnh báo (không fail) nếu phát hiện chuỗi `Ã`/`Â` cạnh ký tự Latin khác — dấu hiệu double-decode tương lai.
- [ ] **Step 2:** Chạy `node scripts/verify-utf8.mjs` → kỳ vọng **pass** (đã xác minh hiện trạng sạch).
- [ ] **Step 3:** Tạo `.gitattributes`: `* text=auto eol=lf` + `*.png binary`, `*.ico binary`, `*.icns binary`, `*.woff2 binary`, `*.epub binary`.
- [ ] **Step 4:** Commit: `chore: add utf-8 verification script and gitattributes`

#### Task 2.2: Tách dữ liệu mẫu khỏi first-run UX

**Files:** `src/stores/useWorkspaceStore.ts`, `src/lib/ipc-demo.ts` (tạo), `src/components/workbench/StatusBar.tsx`, `src/app/page.tsx`

- [ ] **Step 1:** Di chuyển `INITIAL_ENTITIES`, `INITIAL_CHAPTERS`, `INITIAL_RELATIONS`, `INITIAL_SNAPSHOTS`, project "Huyết Cảng 2026" (các hằng gần `useWorkspaceStore.ts:95,221,348,393,434`) sang `src/lib/ipc-demo.ts` dưới dạng `export function createDemoWorkspace(): WorkspaceSnapshot`.
- [ ] **Step 2:** Store initial state = **empty workspace** (0 chapter, 0 entity) + `isDemoData: boolean` trong state. `createDemoWorkspace()` chỉ được gọi khi user bấm "Mở project demo" (nút trên empty state) hoặc khi `isTauriRuntime() === false` **và** `localStorage` chưa có project.
- [ ] **Step 3:** Empty state UI (trong `page.tsx` hoặc Sidebar): nếu không có project mở → màn hình chào với 2 nút: **"Chọn thư mục project…"** (Tauri dialog, xem Task 3.2) và **"Mở project demo (dữ liệu mẫu)"**. Browser mode: chỉ hiện nút demo + ghi chú "Chế độ demo — dữ liệu lưu trong trình duyệt".
- [ ] **Step 4:** StatusBar: hiển thị `● Demo` (amber) khi `isDemoData`, `● Local` (green) khi mở từ đĩa; không hiện "Git: clean" giả.
- [ ] **Step 5:** Test: thêm `src/lib/__tests__/ipc-fallback.test.ts` (Task 3.1) phủ logic chọn demo vs empty. Commit: `feat(workspace): separate demo dataset from real project flow`

**Gate M2:** `npm run verify:utf8` pass; mở app lần đầu không thấy "Huyết Cảng" trừ khi chủ động chọn demo; `npm test` xanh.

---

### Milestone 3 — Nối dây Frontend ↔ Rust IPC

> Lõi của việc chuyển từ "demo" sang "sản phẩm". Thứ tự: fs → linter → lore → refactor → sqlite sync.

#### Task 3.1: Tầng IPC duy nhất — `src/lib/ipc.ts`

**Files:** `src/lib/ipc.ts` (tạo), `src/lib/ipc-fallback.test.ts`, sửa `tauri-bridge.ts` (tách re-export), `src/lib/__tests__/ipc-fallback.test.ts`

**Interfaces (Produces):**
```ts
export function isTauri(): boolean;                       // !!window.__TAURI_INTERNALS__
export async function invokeSafe<T>(cmd: string, args?: Record<string, unknown>): Promise<{ ok: true; data: T } | { ok: false; error: string }>;
export function assertIpcAvailable(): void;                // throw nếu browser + caller yêu cầu Tauri
```
Behavior: `isTauri() === false` → `invokeSafe` trả `{ ok: false, error: 'NOT_IN_TAURI' }` **không throw**; UI hiển thị fallback demo. Rust trả `Err(String)` → `{ ok: false, error }`.

- [ ] **Step 1: Failing tests** (`ipc-fallback.test.ts`, runner `npm test`):
  - Browser (mock `window` không có `__TAURI_INTERNALS__`): `isTauri() === false`; `invokeSafe('read_markdown_file', {…})` resolve `{ ok: false, error: 'NOT_IN_TAURI' }`.
  - `assertIpcAvailable()` throw đúng message.
- [ ] **Step 2:** `npm test` fail.
- [ ] **Step 3:** Implement `ipc.ts` (import động `@tauri-apps/api/core` trong nhánh Tauri để không vỡ static export):
  `const { invoke } = await import('@tauri-apps/api/core');`
- [ ] **Step 4:** Refactor `tauri-bridge.ts`: giữ `parseMarkdownWithFrontmatter`, `serializeMarkdownWithFrontmatter`, `countVietnameseAndLatinWords` (dùng chung cho test + fallback); **xóa** `isTauriRuntime` (chuyển sang `ipc.ts`), giữ các engine TS làm fallback nhưng đánh dấu `@deprecated` — sẽ xóa ở Task 7.2 sau khi IPC chứng minh ổn định.
- [ ] **Step 5:** `npm test` pass. Commit: `feat(ipc): add single type-safe tauri invoke layer with demo fallback`

#### Task 3.2: Mở project thật — dialog + tree + đọc/ghi file

**Files:** `package.json`, `src-tauri/Cargo.toml` (thêm `tauri-plugin-dialog = "2"`), `src-tauri/src/lib.rs`, `src/stores/useWorkspaceStore.ts`, `src/components/workbench/Sidebar.tsx`, `src/components/workbench/ActivityBar.tsx` (nút "Mở thư mục"), `src-tauri/capabilities/default.json`

**Interfaces (Consumes):** `invokeSafe` (3.1), `canonical_within` (1.1).
**Produces (state):** `workspace.rootPath: string | null`, `workspace.openProject(path): Promise<void>`, `workspace.loadChapter(relPath)`, `workspace.saveChapter(id, content)`.

- [ ] **Step 1:** `npm install @tauri-apps/plugin-dialog@^2`; `Cargo.toml` thêm `tauri-plugin-dialog = "2"`; `lib.rs` `.plugin(tauri_plugin_dialog::init())`; capability thêm `"dialog:allow-open"`.
- [ ] **Step 2:** Rust: đảm bảo `read_project_tree(project_root)` trả cây `.md` sorted theo path, bỏ `node_modules`, `.git`, `target`, giới hạn 5.000 file (vượt → `Err("PROJECT_TOO_LARGE")`).
- [ ] **Step 3:** Frontend empty state nút "Chọn thư mục project…" → `open({ directory: true })` → `invokeSafe('init_project_workspace', { projectRoot })` → load tree vào sidebar → mở chương đầu tiên (nếu có).
- [ ] **Step 4:** `loadChapter`: `invokeSafe('read_markdown_file', { projectRoot, relativePath })` → parse frontmatter bằng `parseMarkdownWithFrontmatter` → editor state. Lỗi → banner, không crash.
- [ ] **Step 5:** `saveChapter`: debounce 1000ms; `invokeSafe('write_markdown_file', { projectRoot, relativePath, content })`; StatusBar: `Saving…` / `Saved ✓` / `Error: <msg>`. Keyboard `Ctrl+S` flush debounce ngay.
- [ ] **Step 6:** Test thủ công (ghi vào Verification): mở repo chính nó như project (có `manuscript/`) → thấy 5 chương `act-01`; sửa 1 ký tự → Ctrl+S → `git diff` thấy thay đổi thật.
- [ ] **Step 7:** Commit: `feat(fs): open real project folder, load/save chapters via IPC`

#### Task 3.3: Linter qua IPC (bỏ TS mirror khỏi production path)

**Files:** `src/components/editor/NovelEditor.tsx`, `src/stores/useWorkspaceStore.ts`, `src-tauri/src/commands/linter_cmd.rs`, `src/lib/tauri-bridge.ts`

- [ ] **Step 1:** Rust `run_continuity_linter` hiện nhận gì? Đọc signature hiện có và **giữ nguyên**; nếu cần project_root + relative_path thay vì raw text — quyết định: giữ input là `draft_text` + `chapter_id` (đúng PRD `novel_check_continuity(draft_text, chapter_id)`), không đổi format.
- [ ] **Step 2:** Store: `runLinter(chapterId, text)` — nếu `isTauri()` → `invokeSafe('run_continuity_linter', …)`; else → fallback `runContinuityLinterEngine` + banner demo. Kết quả map sang cùng kiểu `ContinuityIssue` (giữ field name `severity`, `message`, `ruleId`, `line`).
- [ ] **Step 3:** NovelEditor: squiggle/popover lấy issues từ store; bỏ gọi trực tiếp engine TS ở production path.
- [ ] **Step 4:** Test: `linter-ipc.test.ts` — mock `window.__TAURI_INTERNALS__` absent → fallback được gọi (spy); (không test Tauri path bằng jsdom — sẽ verify thủ công + `cargo test`).
- [ ] **Step 5:** Commit: `feat(linter): route continuity linter through tauri IPC with demo fallback`

#### Task 3.4: Lorebook động — `list_entities` + `sync_project_sqlite`

**Files:** `useWorkspaceStore.ts`, `LoreDatabaseView.tsx`, `CharacterSheet.tsx`, `fs_cmd.rs`/`lore_cmd.rs`

- [ ] **Step 1:** Khi mở project: `invokeSafe('init_project_workspace')` → `invokeSafe('sync_project_sqlite')` → `invokeSafe('list_entities')` → fill `workspace.entities`; lỗi → fallback demo + banner.
- [ ] **Step 2:** Chỉnh sửa entity trong `CharacterSheet` → `invokeSafe('upsert_entity', { projectRoot, entity })`; UI update lạc quan, lỗi → rollback + toast.
- [ ] **Step 3:** `LoreDatabaseView` filter/sort trên dữ liệu thật; bảng rỗng → empty state "Chưa có hồ sơ nào — Tạo mới".
- [ ] **Step 4:** Commit: `feat(lore): load/upsert entities from sqlite via ipc`

#### Task 3.5: Refactor Rename thật với preview

**Files:** `RefactorRenameModal.tsx`, `lore_cmd.rs`

- [ ] **Step 1:** Rust `find_entity_usages(project_root, entity_id)` → danh sách `{ file_path, line, before, after }`. Sửa bug `(a, a)` alias mapping trong `lore_cmd.rs:44-58`: map alias → `(alias, alias)` là đúng cho whole-word replace nhưng vô nghĩa cho preview — thay bằng `(old_name, new_name)` truyền từ tham số `new_name`. Thêm `new_name: String` vào command (breaking, chưa ai gọi).
- [ ] **Step 2:** Modal: nhập tên mới → `invokeSafe('find_entity_usages', …)` → hiển thị danh sách câu before/after với checkbox từng dòng (giữ UI hiện có, chỉ thay nguồn dữ liệu). Browser → fallback `buildRefactorRenamePreview`.
- [ ] **Step 3:** "Áp dụng" → `invokeSafe('refactor_rename_entity', { projectRoot, entityId, newName, selectedMatchIds })`; Rust chỉ ghi các `selectedMatchIds`; sau khi ghi → `sync_project_sqlite` lại.
- [ ] **Step 4:** Test Rust (`lore_cmd`): project tempdir 2 file, rename "Linh" → "Linh (đổi)" — chỉ file được chọn đổi; whole-word không match substring ("Linh" không match "Linhương").
- [ ] **Step 5:** Commit: `feat(refactor): real cross-chapter rename with selectable preview`

#### Task 3.6: Đồng bộ SQLite khi save + status trong StatusBar

**Files:** `useWorkspaceStore.ts`, `StatusBar.tsx`, `storage.rs`/`fs_cmd.rs`

- [ ] **Step 1:** Sau mỗi `write_markdown_file` thành công: fire-and-forget `invokeSafe('sync_project_sqlite', { projectRoot })` (debounce 2s, gom nhiều lần save).
- [ ] **Step 2:** StatusBar hiển thị: project path rút gọn · số chương · số entity · `SQLite synced ✓` / `Syncing…` / `Sync failed`.
- [ ] **Step 3:** Commit: `feat(sqlite): sync index after save, show sync state in status bar`

**Gate M3:** Mở NovelForge chính nó làm project → thấy cây thật; Ctrl+S ghi file thật; linter chạy từ Rust (tắt network/devtools xác nhận không có dữ liệu mock khi `!isDemoData`); `npm test` xanh; demo mode vẫn hoạt động khi browser.

---

### Milestone 4 — Publishing compiler thật (EPUB 3 / DOCX / PDF)

> Bỏ hoàn toàn pseudo-EPUB/DOCX. Làm client-side để giữ static export; không thêm server.

#### Task 4.1: Tách `compile-manuscript.ts` + escape + strip author notes

**Files:** `src/lib/publish/compile-manuscript.ts` (tạo), `PublishModal.tsx`, `src/lib/__tests__/compile-manuscript.test.ts`

**Interfaces (Produces):**
```ts
export interface CompiledManuscript { title: string; author: string; chapters: { id: string; title: string; html: string; wordCount: number }[]; totalWords: number; }
export function compileManuscript(input: { chapters: { id: string; title: string; content: string; order: number }[]; projectName: string; includeLoreGlossary: boolean; entities: { entity_type: string; title: string; aliases: string[]; role?: string; summary?: string; personality?: string }[]; }): CompiledManuscript;
```
Behavior: parse frontmatter; bỏ author-note blocks; markdown-lite → HTML (chỉ hỗ trợ heading/hr/p/emphasis; không raw HTML passthrough); glossary appendix nếu `includeLoreGlossary`; **mọi text escape**.

- [ ] **Step 1: Failing tests** (`compile-manuscript.test.ts`): 2 chương mẫu + 1 author-note → `chapters.length === 2`, không chứa nội dung note; chương có `<script>` → html chứa `&lt;script&gt;`; 0 chương → throw `Error('EMPTY_MANUSCRIPT')` (UI bắt và hiện "Không có chương để xuất bản") (R5); glossary bật → appendix chứa tên nhân vật.
- [ ] **Step 2:** `npm test` fail.
- [ ] **Step 3:** Implement bằng cách di chuyển `compileManuscript` hiện có + `markdownBlockToHtml` (Task 1.3) vào module; giữ đúng semantics cũ trừ phần escape.
- [ ] **Step 4:** `npm test` pass. Commit: `refactor(publish): extract testable manuscript compiler with html escaping`

#### Task 4.2: EPUB 3 thật bằng `jszip`

**Files:** `package.json` (`jszip`), `src/lib/publish/epub.ts` (tạo), `src/lib/__tests__/publish.test.ts`

**Interfaces (Produces):** `buildEpub(compiled: CompiledManuscript): Promise<Blob>` — EPUB 3 tối thiểu hợp lệ: `mimetype` (stored, không nén, đầu tiên), `META-INF/container.xml`, `OEBPS/content.opf` (unique-identifier, dc:language=vi), `OEBPS/nav.xhtml`, `OEBPS/toc.ncx` (tùy chọn), `OEBPS/style.css`, `OEBPS/chapter-NNN.xhtml`.

- [ ] **Step 1: Failing tests** (`publish.test.ts`): `buildEpub(sample)` → `JSZip.loadAsync` được blob; assert: entry `mimetype` tồn tại và nội dung đúng `application/epub+zip`; `container.xml` well-formed (regex `full-path="OEBPS/content.opf"`); `content.opf` chứa `<dc:title>` escaped; mọi chapter xhtml không chứa `<script>`.
- [ ] **Step 2:** `npm test` fail.
- [ ] **Step 3:** Implement `epub.ts` với jszip (`compression: 'STORE'` cho mimetype, `DEFLATE` cho còn lại). UUID cho `dc:identifier`. Manifest liệt kê mọi chapter + nav + css.
- [ ] **Step 4:** `npm test` pass. Commit: `feat(publish): generate real epub 3 client-side`

#### Task 4.3: DOCX thật bằng `docx`

**Files:** `package.json` (`docx`), `src/lib/publish/docx.ts` (tạo), `src/lib/__tests__/publish.test.ts`

**Interfaces (Produces):** `buildDocx(compiled: CompiledManuscript): Promise<Blob>` — Standard manuscript format: Times New Roman 12pt / hoặc Georgia; double line spacing; lề 1 inch; header page number; tiêu đề chương `Heading 1`; trang bìa (title/author/date).

- [ ] **Step 1: Failing tests**: `buildDocx(sample)` → blob size > 0; unzip (jszip) → `word/document.xml` tồn tại và chứa text chương đã escape (assert `&lt;script&gt;`); số `<w:p>` > số chương.
- [ ] **Step 2:** `npm test` fail.
- [ ] **Step 3:** Implement với `docx` (`Document`, `Packer.toBlob`, `Paragraph`, `TextRun`, `PageBreak`, `Footer` page number).
- [ ] **Step 4:** `npm test` pass. Commit: `feat(publish): generate real docx manuscripts`

#### Task 4.4: Nối `PublishModal.tsx` + PDF in đúng cách

**Files:** `PublishModal.tsx`

- [ ] **Step 1:** Nút export: `epub` → `buildEpub` → download `<project>.epub`, mime `application/epub+zip`; `docx` → `buildDocx` → `<project>.docx`; `pdf` → print window như cũ nhưng dùng `compiled.chapters` HTML đã escape (Task 4.1) — **giữ** cơ chế `window.print()` (không thêm lib PDF nặng), ghi rõ trong UI: "PDF sẽ mở hộp thoại in của hệ thống — chọn 'Lưu dưới dạng PDF'".
- [ ] **Step 2:** Bỏ nhánh `.md`/`.html` giả; đổi nhãn nút cho đúng ("EPUB 3", "DOCX (Bản thảo chuẩn)", "PDF qua hộp thoại in").
- [ ] **Step 3:** Loading/error states: `EMPTY_MANUSCRIPT` → thông báo; lỗi builder → toast + log console.
- [ ] **Step 4:** Kiểm thử thủ công: xuất cả 3 định dạng từ project demo; mở EPUB bằng Calibre/Edge; mở DOCX bằng Word/LibreOffice. Ghi kết quả vào `planfix_01.md` (Verification M4).
- [ ] **Step 5:** Commit: `feat(publish): wire real epub/docx/pdf export in publish dialog`

#### Task 4.5: README/Roadmap trung thực cho Publishing

- [ ] Sửa `README.md` mục Publishing Compiler: mô tả đúng "EPUB 3 + DOCX sinh thật; PDF qua print dialog". Commit ở M8 gộp chung cũng được — tách commit `docs(readme): describe real publishing pipeline`.

**Gate M4:** `npm test` xanh (≥4 test publish mới + cũ); file `.epub` mở được; `.docx` mở được; không còn chuỗi `text/markdown` export cho "DOCX".

---

### Milestone 5 — Git snapshots thật (`git2`)

> Hiện snapshot là object giả. Mục tiêu: `Ctrl+S` → commit thật; timeline đọc từ `git log`.

#### Task 5.1: Thiết kế command + lỗi typed

**Files:** `src-tauri/src/vcs/snapshot.rs`, `src-tauri/src/vcs/mod.rs`, `src-tauri/src/lib.rs`

**Interfaces (Produces):**
```rust
#[derive(Serialize)] pub struct GitError { pub kind: String, pub message: String }
// kind: "NOT_A_REPO" | "UNBORN_HEAD" | "OUTSIDE_REPO" | "GIT_FAILURE" | "NOTHING_TO_COMMIT"
#[tauri::command] pub fn create_snapshot(project_root: String, branch_name: Option<String>, label: String) -> Result<StorySnapshot, GitError>
#[tauri::command] pub fn list_snapshots(project_root: String) -> Result<Vec<StorySnapshot>, GitError>
#[tauri::command] pub fn restore_snapshot(project_root: String, snapshot_id: String, confirm: bool) -> Result<(), GitError>   // confirm=false → Err("CONFIRM_REQUIRED")
```
`StorySnapshot` giữ shape cũ (`id, branch_name, label, timestamp, word_count_delta, total_words`) để frontend không đổi type; thêm `commit_oid`.

Semantics:
- `create_snapshot`: repo discover từ `project_root`; `git add manuscript lorebook` (chỉ 2 path, không add toàn bộ); commit với message `snapshot: <label>` + trailer `NovelForge-Snapshot: true`; `total_words` = đếm từ (tái dùng logic đếm hiện có — port `countVietnameseAndLatinWords` sang Rust hoặc đếm bytes/4? **Quyết định:** đếm bằng tokenizer đơn giản split whitespace trên nội dung đã strip markdown — ghi chú sai số); `word_count_delta` = tổng từ hiện tại − tổng từ commit snapshot trước đó (0 nếu chưa có).
- `list_snapshots`: duyệt `revwalk` từ HEAD, filter commit có trailer `NovelForge-Snapshot: true`, map → `StorySnapshot`.
- `restore_snapshot`: chỉ khi `confirm == true`; thực hiện `git restore --source=<oid> -- manuscript lorebook` (không đụng file khác), **không** reset branch.

- [ ] **Step 1:** Viết skeleton + failing integration tests trong `snapshot.rs` `#[cfg(test)]` dùng `tempfile::tempdir()`: (a) chưa `git init` → `NOT_A_REPO`; (b) repo init, chưa commit, tạo snapshot → commit đếm được 1; (c) list sau 2 snapshot → thứ tự mới→cũ, `word_count_delta` ký đúng; (d) `restore_snapshot(confirm=false)` → lỗi `CONFIRM_REQUIRED`.
- [ ] **Step 2:** `cargo test snapshot` → fail.
- [ ] **Step 3:** Implement. `Cargo.toml` thêm `[dev-dependencies] tempfile = "3"` (git2 đã có).
- [ ] **Step 4:** `cargo test` → pass. Commit: `feat(vcs): implement real git snapshots via git2`

#### Task 5.2: Đăng ký commands + frontend wiring

**Files:** `lib.rs` (thêm `restore_snapshot`), `useWorkspaceStore.ts`, `Sidebar.tsx`/snapshot panel component, `RefactorRenameModal.tsx` (không liên quan), `StatusBar.tsx`

- [ ] **Step 1:** `createGitSnapshot(label)` → `invokeSafe('create_snapshot', { projectRoot, label })`; cập nhật `snapshots` state từ response (không tự chế id). Browser/demo → hành vi cũ nhưng badge "Demo".
- [ ] **Step 2:** Khi mở project: `invokeSafe('list_snapshots')` → fill timeline; lỗi `NOT_A_REPO` → panel hiện "Thư mục này chưa phải git repo — `git init`?" + nút (gọi command mới `init_git_repo(project_root)`? **Quyết định YAGNI:** không thêm init; hướng dẫn user chạy `git init` ngoài app).
- [ ] **Step 3:** UI restore: nút "Khôi phục" → dialog xác nhận gõ đúng label → `restore_snapshot(confirm=true)` → reload chapters từ disk.
- [ ] **Step 4:** Commit: `feat(vcs): wire snapshot create/list/restore in workspace store`

#### Task 5.3: `word_count_delta` chính xác hơn (tùy chọn nhưng khuyến nghị)

- [ ] Nếu Task 5.1 dùng word counter thô → nâng cấp: dùng chung `core_engine::parser` strip markdown rồi count Unicode word boundaries tiếng Việt (regex `\p{L}+(\p{M}|\p{L})*`). Thêm unit test với câu tiếng Việt có dấu. Commit riêng.

**Gate M5:** `cargo test` xanh; trong project demo (git repo), Ctrl+S tạo commit thật (`git log --oneline` thấy `snapshot: ...`); restore khôi phục nội dung file; app không panic khi mở thư mục không git.

---

### Milestone 6 — MCP thật (hoặc hạ scope có chủ đích)

> **Quyết định cần chốt trước khi bắt đầu M6** (xem mục "Câu hỏi mở" cuối plan). Khuyến nghị: làm 6.1–6.3 (stdio MCP tối thiểu, 4 tools thật). Nếu không đủ thời gian → thực hiện 6.4 (gỡ claim) thay vì ship MCP giả.

#### Task 6.1: Chọn SDK & khung MCP stdio (Rust)

**Files:** `Cargo.toml`, `src-tauri/src/ai_bridge/mcp_server.rs`

- [ ] **Step 1:** Thêm dependency `rmcp` (official Rust MCP SDK) — kiểm tra phiên bản trên crates.io tương thích Rust edition 2021; nếu `rmcp` không ổn định, fallback: implement JSON-RPC tối thiểu (`initialize`, `tools/list`, `tools/call`) trên stdin/stdout với `serde_json` (không thêm crate nặng).
- [ ] **Step 2:** `mcp_server.rs` thành MCP server thật: handshake + `tools/list` trả 4 tool: `novel_search_lore`, `novel_get_chapter_context`, `novel_check_continuity`, `novel_propose_edit` (đúng PRD `.docs/prd-technical-architecture.md` §3.3).
- [ ] **Step 3:** Binary riêng hay thread trong app? **Quyết định:** thread trong Tauri app khởi động bằng config (`.novelforge/config.json` `{ "mcpStdio": true }`) — Cline/Claude Desktop spawn được qua `tauri` CLI wrapper là phức tạp; **YAGNI v1:** cung cấp `novelforge-mcp` subcommand trong cùng binary (`src-tauri/src/main.rs` match argv[1] == "mcp") — test được bằng pipe JSON-RPC thủ công.

#### Task 6.2: 4 tools thật dựa trên SQLite + linter

**Files:** `mcp_server.rs`, `ai_cmd.rs`, `rag_engine.rs`, `indexer.rs`

- [ ] `novel_search_lore(query, entity_type?)` → mở `.novelforge/index.sqlite` read-only; LIKE + cosine trên chunks (brute-force cosine hiện có là đủ cho v1 — ghi rõ giới hạn); trả top-5 `{ entity_id, title, snippet, score }`.
- [ ] `novel_get_chapter_context(chapter_id, window_size=1)` → đọc chương + N chương trước/sau theo `timeline.json`/thứ tự act; trả `{ current, before[], after[] }`.
- [ ] `novel_check_continuity(draft_text, chapter_id)` → gọi `linter::run_ruleset` trên text; trả issues JSON (đúng PRD).
- [ ] `novel_propose_edit(file_path, start_line, end_line, new_content, rationale)` → **push Tauri event** `mcp://propose-edit` với payload; frontend `useAgentStore` lắng nghe → tạo inline diff card; trả `{ status: "proposed", proposal_id }` (không tự ghi file).
- [ ] Test: unit test từng tool handler với SQLite tempdir (không cần LLM).

#### Task 6.3: Frontend nhận proposal thật

**Files:** `useAgentStore.ts`, `RightDock.tsx`, `NovelEditor.tsx`

- [ ] `listen('mcp://propose-edit', …)` → thêm vào `pendingDiffs`; Accept → áp dụng vào editor (mmap range); Reject → hủy. Bỏ `triggerMcpToolSimulation`; MCP logs lấy từ event thật (`mcp://log`).
- [ ] Browser/demo: giữ nút "Simulate agent" **có nhãn Demo** rõ ràng hoặc ẩn; không được hiển thị như agent thật đang chạy.
- [ ] Commit: `feat(mcp): real stdio mcp server with 4 lore tools and edit proposals`

#### Task 6.4 (thay thế nếu bỏ qua MCP): Hạ claim AI trong UI + README

- [ ] Nếu M6 không được duyệt: `useAgentStore` default `agentStatus: 'unavailable'`; RightDock hiện "MCP bridge chưa bật — xem docs/mcp.md"; README roadmap AI → `[ ]` thay vì `[x]`; xóa `mcp_execute_tool` echo giả hoặc thay bằng `{ ok: false, error: "MCP_NOT_CONFIGURED" }`.

**Gate M6:** Pipe JSON-RPC thủ công vào `novelforge-mcp` nhận đúng tools/list; gọi `novel_search_lore` trả kết quả từ DB thật; hoặc (nếu chọn 6.4) UI không còn giả vờ MCP hoạt động.

---

### Milestone 7 — Dọn dẹp, dead code, lint gate

#### Task 7.1: Bỏ deps chết trong `Cargo.toml`
- [ ] Xóa `specta`, `tauri-specta` (không dùng; nếu sau này cần bindings thì thêm lại) ; xóa `notify`, `notify-debouncer-full` **hoặc** implement file watcher thật — **Quyết định:** xóa (PRD muốn watcher nhưng YAGNI cho MVP; ghi nhận trong `.docs` roadmap). Giữ `git2` (nay dùng thật), `similar` (dùng), `pulldown-cmark` (dùng làm fallback heading).
- [ ] `cargo check` + `cargo test` pass. Commit: `chore(deps): remove unused rust crates`

#### Task 7.2: Xóa TS mirror không dùng; single source of truth
- [ ] Sau M3: xóa `runContinuityLinterEngine`, `scanImplicitEntitiesInChapter`, `hybridSearchLoreRag`, `generateDeterministicEmbedding768` khỏi `tauri-bridge.ts` nếu UI không còn gọi (grep xác nhận 0 tham chiếu); giữ parser + word count (frontend cần). File còn lại re-export từ `lib/text/` nếu cần gọn.
- [ ] Cập nhật `novel-engine.test.ts`: import từ module thật; **xóa test 11 giả** (fs.existsSync); thêm assert roundtrip parser trên file thật `manuscript/act-01/*.md`.
- [ ] Commit: `refactor(bridge): drop unused ts engine mirrors, fix fake test`

#### Task 7.3: Tách `NovelEditor.tsx` (1245 dòng)
- [ ] Chỉ tách khi cần sửa file này ở M3/M4; tách: `editor/paragraph-node.tsx`, `editor/inline-diff-card.tsx`, `editor/author-note-block.tsx`, giữ `NovelEditor.tsx` < 700 dòng. Không đổi behavior; commit riêng `refactor(editor): split oversized NovelEditor into focused modules`.
- [ ] Nếu M3/M4 không chạm file → bỏ qua task (YAGNI), ghi chú nợ kỹ thuật.

#### Task 7.4: Bật lint gate thực sự
- [ ] Chạy `npm run lint`; fix hoặc (nếu > 50 warnings) giữ `ignoreDuringBuilds` + mở issue "ESLint debt" trong README; mục tiêu tối thiểu: **0 errors**, warnings được đếm và ghi nhận.
- [ ] Thêm `"typecheck": "tsc --noEmit"` vào CI script tương lai; chạy pass.
- [ ] Commit: `chore(lint): zero eslint errors, record warning baseline`

**Gate M7:** `cargo tree` không còn crate chết; `grep -r "triggerMcpToolSimulation" src` = 0 hoặc có nhãn Demo; `npm run build` exit 0; `npm run typecheck` exit 0.

---

### Milestone 8 — Tài liệu & roadmap trung thực

#### Task 8.1: README viết lại phần claim
- [ ] Publishing: mô tả thật (EPUB3/DOCX/PDF-qua-print). Checklist roadmap: chỉ tick thứ **chạy được + verify** (FS/IPC/linter/lore/git/publish); AI/MCP tick theo kết quả M6; `sqlite-vec` → `[ ]` (brute-force hiện tại không phải sqlite-vec); Yjs/collab → `[ ]`.
- [ ] Sửa Quick Start: `npm install` → `npm run dev` (cổng 3456) → mở `http://localhost:3456` ở **demo mode**; thêm mục "Mở project thật" (cần Tauri build). Bỏ tuyên bố "production-ready".
- [ ] Kiến trúc: cập nhật sơ đồ data flow — ghi rõ browser fallback = demo, Tauri = production.
- [ ] Commit: `docs(readme): honest feature matrix and quick start`

#### Task 8.2: AGENTS.md / CLAUDE.md
- [ ] AGENTS.md: thay "giai đoạn 0 — chưa có code" bằng trạng thái hiện tại (M0–M5 xong mức nào ghi mức đó; cập nhật lại sau mỗi milestone). Giữ bảng `.docs/` + quy ước; thêm mục "Planfix" trỏ `planfix_01.md`.
- [ ] CLAUDE.md: tương tự, 1–3 dòng.
- [ ] Commit: `docs(agents): update project status to reflect implementation`

#### Task 8.3: Cập nhật `.docs/` theo quy ước repo
- [ ] `.docs/master-execution-plan.md`: tick các deliverable Giai đoạn 1–3 đã đạt (workbench, FS, editor, SQLite indexer, linter) với ghi chú "(verified 2026-11)"; Giai đoạn 4–5: AI/MCP/git/publish cập nhật theo kết quả thật.
- [ ] Thêm `.docs/architecture-decisions.md` (ADR ngắn): ADR-001 "Client-side publish (jszip/docx) thay vì server"; ADR-002 "Demo fallback có chủ đích, không giả vờ backend"; ADR-003 "git2 cho snapshot; restore không reset branch"; ADR-004 "Bỏ sqlite-vec v1 (dùng brute-force cosine)".
- [ ] Commit: `docs: record adrs and sync execution plan with reality`

#### Task 8.4: Đóng gói & phân phối tối thiểu
- [ ] `.gitignore` xác nhận `out/`, `target/`, `.novelforge/` đã có (đã có — giữ).
- [ ] Thêm `RELEASING.md` ngắn: yêu cầu MSVC Build Tools; lệnh `npm run tauri build`; artifact MSI/NSIS; chưa auto-updater (ghi rõ).
- [ ] Commit: `docs: add releasing guide and confirm ignore rules`

**Gate M8:** README không còn claim chưa làm; `AGENTS.md` khớp thực tế; `.docs/` cập nhật; `git status` sạch.

---

## 5. Baseline (cập nhật ở Task 0.4)

- **Node / npm:** Node.js `v24.22.2`, npm `12.2.1`
- **rustc / cargo / MSVC:** rustc `1.99.1` (x86_64-pc-windows-msvc), cargo `1.99.1`. MSVC Build Tools / Windows SDK (`kernel32.lib`, `link.exe`) hiện chưa được cài đặt trên máy chủ này (xác minh finding F2).
- **Frontend test:** `npm test` pass **31/31 tests** (21 test xuất bản, escaping HTML, IPC fallback + 10 test core & UI contrast).
- **Static export:** `npm run build` exit 0 (sinh 4 trang static xuất khẩu `out/`).
- **Typecheck:** `npm run typecheck` (`tsc --noEmit`) exit 0.
- **UTF-8 check:** `npm run verify:utf8` pass 114 files text trong repo, 0 errors, 0 warnings.
- **Icons & Capabilities:** Đã sinh trọn bộ icons đa nền tảng trong `src-tauri/icons/` và tạo `src-tauri/capabilities/default.json`.

## 6. Verification tổng (sau M8)

1. `npm run verify:utf8` → exit 0.
2. `npm test` → tất cả pass (số test ≥ hiện tại + các test mới ở M1–M5).
3. `npm run build` + `npm run typecheck` → exit 0.
4. `cd src-tauri && cargo test` → pass.
5. `npm run tauri build` → `.msi`/`.exe` sinh ra; cài trên máy sạch (hoặc VM) → mở app → "Chọn thư mục project" → chọn repo NovelForge → thấy manuscript thật → Ctrl+S → `git log` có snapshot commit → Export EPUB mở được bằng Calibre.
6. Browser-only (`npm run dev`): app không crash; banner "Chế độ demo" hiện; không có nút nào hứa hẹn tính năng backend ngoài khả năng.
7. R1–R6 (Review Focus) đều có test pass tương ứng.

## 7. Rủi ro & quyết định mở (cần chủ dự án chốt)

1. **MCP thật (M6) hay hạ claim?** — Khuyến nghị 6.1–6.3 nếu chấp nhận ~3–5 ngày thêm; nếu không, làm 6.4.
2. **Restore snapshot có được phép ghi đè file đang mở?** Plan chọn `git restore -- manuscript lorebook` với `confirm=true`; nếu muốn an toàn hơn nữa → chỉ tạo branch mới `what-if/<timestamp>` thay vì đụng working tree. Cần chốt UX.
3. **Word counter tiếng Việt** — dùng regex Unicode đơn giản (đủ tốt) hay crate chuyên dụng (`unicode-segmentation`)? Khuyến nghị `unicode-segmentation` (thêm 1 dep nhỏ, chính xác hơn).
4. **File watcher (`notify`)** — bỏ khỏi MVP (plan hiện tại) hay là yêu cầu bắt buộc của PRD? Nếu bắt buộc → thêm milestone M9 riêng, không nhét vào M7.
5. **Phạm vi project mở được** — chỉ thư mục có `manuscript/`? Hay bất kỳ thư mục nào? Plan: chấp nhận bất kỳ thư mục, nhưng `read_project_tree` giới hạn 5.000 file và bỏ qua thư mục ẩn.
6. **`published` EPUB có cần nhúng font Literata?** — Plan: không nhúng (license + size); dùng font-family fallback serif. Nếu cần nhúng → thêm task M4.6.

## 8. Thứ tự thực thi & ước lượng

| Milestone | Ước lượng | Phụ thuộc |
|---|---|---|
| M0 Baseline | 0.5–1 ngày (cài MSVC là phần lâu nhất) | — |
| M1 Security | 1–2 ngày | M0 |
| M2 UTF-8/demo split | 0.5–1 ngày | M1 |
| M3 IPC wiring | 3–5 ngày | M1, M2 |
| M4 Publishing thật | 2–3 ngày | M3 (compile-manuscript độc lập, có thể song song) |
| M5 Git snapshots | 2–3 ngày | M0, M3 (frontend wiring) |
| M6 MCP | 3–5 ngày hoặc 0.5 ngày (6.4) | M3 |
| M7 Dọn dẹp | 1 ngày | M3–M6 |
| M8 Tài liệu | 0.5–1 ngày | tất cả |

Tổng: **~12–20 ngày** (tùy quyết định M6). Mỗi milestone độc lập ship được; sau M5 đã có "MVP thật" dùng được.

## 9. Mapping phát hiện → Task (truy vết)

F1→0.1 · F2→0.2 · F3→3.1–3.6 · F4→5.1–5.2 · F5→4.2–4.4 · F6→1.3+4.1 · F7→1.1+1.2 · F8→6.1–6.4 · F9→0.3 · F10→1.4+7.1–7.2 · F11→8.1–8.3 · F12→6.2 (giới hạn ghi rõ) + 8.3 (ADR-004) · F13→7.2 · F14→0.3 · F15→7.4 · F16→1.4 · F17→2.2
