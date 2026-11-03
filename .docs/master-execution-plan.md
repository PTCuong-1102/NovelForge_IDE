# KẾ HOẠCH THỰC THI & LỘ TRÌNH PHÁT TRIỂN CHI TIẾT (MASTER EXECUTION PLAN)
**Dự án:** NovelForge IDE  
**Tổng thời gian dự kiến (MVP đến Production v1.0):** 16 Tuần (4 Sprints lớn)  
**Mô hình phát triển:** Agile / Iterative (Ưu tiên hoàn thiện lõi Local-First trước, tích hợp AI và Linter nâng cao sau)

---

## 1. CẤU TRÚC THƯ MỤC DỰ ÁN CHUẨN (REPOSITORY BOILERPLATE)

Dự án được tổ chức theo cấu trúc Monorepo gọn nhẹ, tách biệt rõ ràng giữa **Frontend (Next.js)** và **Core Engine (Rust/Tauri)**:

```text
novelforge-ide/
├── package.json
├── next.config.mjs                  # Cấu hình output: 'export', images: { unoptimized: true }
├── tsconfig.json
├── src/                             # FRONTEND (Next.js 15+ App Router)
│   ├── app/
│   │   ├── layout.tsx
│   │   └── page.tsx                 # Entry point duy nhất cho SPA Workbench
│   ├── components/
│   │   ├── workbench/               # Khung giao diện kiểu VS Code
│   │   │   ├── ActivityBar.tsx      # Thanh icon bên trái (Explorer, Lore, Git, AI)
│   │   │   ├── Sidebar.tsx          # Cây thư mục & Danh sách thực thể
│   │   │   ├── DockLayout.tsx       # Quản lý Split-view, Multi-tab (Dockview)
│   │   │   └── StatusBar.tsx        # Đếm từ, trạng thái Git, trạng thái AI Agent
│   │   ├── editor/                  # Trình soạn thảo kiểu Notion + IntelliJ
│   │   │   ├── NovelEditor.tsx      # Core TipTap Editor
│   │   │   ├── extensions/          # Custom Nodes: @Mention, #LoreTag, InlineDiff, LinterMark
│   │   │   └── SlashMenu.tsx        # Menu lệnh nhanh khi gõ '/'
│   │   ├── lorebook/                # Giao diện quản lý Thế giới quan (Notion Database view)
│   │   │   ├── CharacterSheet.tsx
│   │   │   ├── TimelineBoard.tsx
│   │   │   └── RelationshipGraph.tsx
│   │   └── ai-hub/                  # Trung tâm điều khiển AI (Cline/OpenCode/MCP)
│   │       ├── AgentTerminal.tsx
│   │       ├── ComposerPanel.tsx
│   │       └── DiffReviewBar.tsx
│   ├── stores/                      # Zustand State Management
│   │   ├── useWorkspaceStore.ts
│   │   ├── useEditorStore.ts
│   │   └── useAgentStore.ts
│   └── lib/
│       ├── tauri-bridge.ts          # Type-safe wrappers cho hàm invoke() của Tauri
│       └── shortcuts.ts             # Quản lý phím tắt toàn cục (Keybindings)
│
└── src-tauri/                       # BACKEND (Rust Core Engine)
    ├── Cargo.toml
    ├── tauri.conf.json
    └── src/
        ├── main.rs
        ├── lib.rs
        ├── commands/                # Các hàm #[tauri::command] giao tiếp với Next.js
        │   ├── fs_cmd.rs
        │   ├── lore_cmd.rs
        │   ├── linter_cmd.rs
        │   └── ai_cmd.rs
        ├── core_engine/             # Logic nghiệp vụ cốt lõi
        │   ├── parser.rs            # Phân tích Markdown + YAML Frontmatter (pulldown-cmark)
        │   ├── indexer.rs           # Đồng bộ file vào SQLite + Tạo chỉ mục
        │   ├── linter.rs            # Bộ kiểm tra logic cốt truyện & thực thể
        │   └── refactor.rs          # Đổi tên thực thể an toàn trên toàn dự án
        ├── ai_bridge/               # Hệ thống kết nối AI đa nền tảng
        │   ├── mcp_server.rs        # Máy chủ MCP nội bộ cung cấp Tools cho Cline/Antigravity
        │   ├── agent_runner.rs      # Quản lý tiến trình CLI (OpenCode, Ollama)
        │   └── rag_engine.rs        # Truy xuất ngữ cảnh bằng sqlite-vec
        └── vcs/                     # Quản lý phiên bản cho nhà văn
            ├── snapshot.rs          # Bọc libgit2 thành tính năng lưu mốc thời gian
            └── diff_engine.rs       # Tính toán khác biệt văn bản bằng crate 'similar'
```

---

## 2. LỘ TRÌNH THỰC THI CHI TIẾT (16 TUẦN)

### GIAI ĐOẠN 1: Nền tảng Workbench & Hệ thống File Local-First (Tuần 1 - Tuần 3)
**Mục tiêu:** Chạy được ứng dụng Desktop trên Windows/macOS/Linux, mở được thư mục dự án, đọc/ghi file Markdown tốc độ cao với giao diện chia cửa sổ như VS Code.

* **Tuần 1: Khởi tạo & Cấu hình Kiến trúc**
  * [ ] Khởi tạo dự án Tauri v2 + Next.js (App Router, Static Export) + TailwindCSS + Shadcn UI.
  * [ ] Thiết lập cơ chế sinh kiểu dữ liệu tự động từ Rust sang TypeScript bằng `tauri-specta` (đảm bảo an toàn kiểu $100\%$ khi gọi IPC).
  * [ ] Tích hợp thư viện `dockview` để xây dựng hệ thống Multi-tab, kéo thả chia đôi màn hình (Split Editor Right/Down).
* **Tuần 2: Hệ thống File System & File Watcher (Rust)**
  * [ ] Viết module đọc cây thư mục dự án bất đồng bộ bằng `tokio::fs`.
  * [ ] Tích hợp crate `gray_matter` hoặc `serde_yaml` để tách riêng phần YAML Frontmatter và phần nội dung Markdown.
  * [ ] Tích hợp crate `notify` để lắng nghe sự kiện thay đổi file trên ổ cứng (chuẩn bị sẵn sàng cho việc các AI bên ngoài như Cline/OpenCode can thiệp vào file).
* **Tuần 3: Command Palette & Trạng thái Lưu trữ**
  * [ ] Xây dựng hộp thoại `Ctrl/Cmd + P` (Tìm mở nhanh chương/nhân vật) và `Ctrl/Cmd + Shift + P` (Chạy lệnh hệ thống).
  * [ ] Cơ chế Auto-save thông minh (Debounce $1000\text{ ms}$) kèm chỉ báo trạng thái lưu trên thanh Status Bar.

**Deliverable Giai đoạn 1:** Một trình quản lý và chỉnh sửa file Markdown đa cửa sổ siêu nhẹ, phản hồi tức thì.

---

### GIAI ĐOẠN 2: Trình soạn thảo Notion-like & Cơ sở dữ liệu Lorebook (Tuần 4 - Tuần 6)
**Mục tiêu:** Biến trình sửa văn bản thô thành môi trường sáng tác chuyên nghiệp có liên kết dữ liệu thế giới quan.

* **Tuần 4: Xây dựng Core Editor với TipTap / ProseMirror**
  * [ ] Tích hợp TipTap với bộ chuyển đổi Markdown hai chiều (Lossless Markdown Serializer/Parser).
  * [ ] Xây dựng **Slash Command Menu (`/`)**: Chèn nhanh Phân cảnh (Scene Break `***`), Ghi chú tác giả (Callout ẩn khi xuất bản), Tiêu đề, Hộp thoại.
  * [ ] Chế độ **Zen Mode / Typewriter Scrolling** (Luôn giữ dòng đang gõ ở chính giữa màn hình).
* **Tuần 5: Hệ thống SQLite Indexer & Lorebook Schema**
  * [ ] Tích hợp `rusqlite` vào Rust Backend. Tự động khởi tạo file `.novelforge/index.sqlite` khi mở dự án.
  * [ ] Xây dựng luồng Background Indexer: Mỗi khi file trong thư mục `lorebook/` hoặc `manuscript/` được lưu, tự động bóc tách YAML Frontmatter và cập nhật vào bảng `entities`.
* **Tuần 6: Liên kết Thực thể (`@Mention` & `#LoreTag`) và Giao diện Lorebook**
  * [ ] Viết TipTap Extension cho phép gõ `@` để gợi ý tên nhân vật, `#` để gợi ý địa điểm/vật phẩm lấy trực tiếp từ SQLite.
  * [ ] Xây dựng giao diện **Lorebook Database View** (Dạng bảng và dạng thẻ Gallery giống Notion) để quản lý hồ sơ nhân vật, chỉnh sửa thuộc tính trực quan.

**Deliverable Giai đoạn 2:** Người viết có thể vừa viết truyện, vừa gõ `@` để gắn thẻ nhân vật và quản lý toàn bộ thế giới quan ngay trong cùng một ứng dụng.

---

### GIAI ĐOẠN 3: Hệ thống "IntelliJ Inspector" cho Văn học (Tuần 7 - Tuần 9)
**Mục tiêu:** Đưa các tính năng phân tích tĩnh (Static Analysis) của IDE lập trình vào việc kiểm soát chất lượng tiểu thuyết.

* **Tuần 7: Tự động nhận diện Thực thể (Implicit Entity Detection) & Hover Card**
  * [ ] Sử dụng thuật toán **Aho-Corasick** (crate `aho-corasick` trong Rust) để quét toàn bộ tên và biệt danh (`aliases`) của hàng ngàn nhân vật trên một chương truyện dài $10.000$ từ chỉ trong $< 2\text{ ms}$ mà không cần người dùng phải gõ dấu `@`.
  * [ ] Hiển thị **Hover Popover** trên Frontend: Khi rê chuột vào tên nhân vật trong bài viết, hiện ngay thẻ tóm tắt tiểu sử, tuổi tác, ngoại hình và trạng thái hiện tại.
* **Tuần 8: Find Usages (Tra cứu xuất hiện) & Refactor Rename (Đổi tên toàn cục)**
  * [ ] Xây dựng bảng `entity_mentions`: Liệt kê chính xác nhân vật X đã xuất hiện ở những chương nào, đoạn nào (tương tự tính năng *Find Usages* của IntelliJ).
  * [ ] Xây dựng công cụ **Refactor Rename**: Đổi tên một nhân vật hoặc địa danh, tự động quét toàn bộ dự án, hiển thị danh sách các câu văn sẽ bị thay đổi để tác giả duyệt trước khi áp dụng.
* **Tuần 9: Continuity Linter (Bộ kiểm tra mâu thuẫn cốt truyện)**
  * [ ] Thiết lập Timeline Engine đối chiếu thứ tự chương với niên biểu (`timeline.json`).
  * [ ] Viết các quy tắc Linter đầu tiên: Cảnh báo nhân vật đã chết nhưng vẫn xuất hiện; cảnh báo sai lệch tên gọi theo giai đoạn cốt truyện; cảnh báo lặp từ vựng quá dày đặc.
  * [ ] Hiển thị đường gạch chân răng cưa (Squiggly lines: Đỏ cho lỗi logic nghiêm trọng, Vàng cho cảnh báo văn phong) ngay trong TipTap Editor.

**Deliverable Giai đoạn 3:** IDE có khả năng tự động phát hiện nhân vật, tra cứu chéo và bắt lỗi mâu thuẫn cốt truyện theo thời gian thực.

---

### GIAI ĐOẠN 4: Kiến trúc AI Đa Tác Nhân & Giao thức MCP (Tuần 10 - Tuần 13)
**Mục tiêu:** Tích hợp sâu Antigravity, OpenCode, Cline và các LLM nội bộ/đám mây mà không phá vỡ luồng sáng tác của tác giả.

* **Tuần 10: Xây dựng Embedded MCP Server trong Rust**
  * [ ] Triển khai chuẩn giao thức **Model Context Protocol (MCP)** trong module `ai_bridge/mcp_server.rs`.
  * [ ] Xuất bản các MCP Resources & Tools: Cho phép bất kỳ MCP Client nào (Cline, Claude Desktop, Antigravity, OpenCode) truy vấn trực tiếp vào SQLite Lorebook và đọc cấu trúc chương truyện.
* **Tuần 11: Local RAG với `sqlite-vec`**
  * [ ] Tích hợp extension `sqlite-vec` để lưu trữ Vector Embeddings ngay trong file SQLite.
  * [ ] Hỗ trợ tạo Embedding qua Ollama cục bộ (như `nomic-embed-text`) hoặc API (OpenAI/Gemini) để tìm kiếm ngữ nghĩa các tình tiết cũ trong truyện.
* **Tuần 12: Giao diện Inline Diff & Conflict Guard (Kiểu Cursor / Cline)**
  * [ ] Xây dựng TipTap Extension **Diff Decorator**: Khi AI sửa file hoặc đề xuất đoạn văn mới, sử dụng crate `similar` trong Rust để tách các đoạn thêm/xóa và hiển thị nút `[Chấp nhận (Tab)]` / `[Từ chối (Esc)]` trên từng đoạn văn.
  * [ ] Xây dựng cơ chế khóa an toàn (File Lock Indicator) khi một AI Agent bên ngoài đang thực hiện tác vụ ghi file.
* **Tuần 13: AI Composer & Subprocess Agent Dock**
  * [ ] Tích hợp khung điều khiển bên phải cho phép gọi nhanh các lệnh chuyên biệt: *"Viết tiếp cảnh này theo góc nhìn nhân vật A"*, *"Kiểm tra lỗ hổng logic chương này"*, *"Tóm tắt chương vừa viết để cập nhật vào Lorebook"*.
  * [ ] Tích hợp Terminal/Bridge nhúng để khởi chạy và giao tiếp trực tiếp với `opencode` CLI ngay bên trong cửa sổ IDE.

**Deliverable Giai đoạn 4:** Hệ sinh thái AI hoàn chỉnh, nơi Cline, OpenCode hay Antigravity hiểu toàn bộ thế giới quan của bộ truyện và hỗ trợ viết/biên tập thông qua cơ chế duyệt Diff an toàn.

---

### GIAI ĐOẠN 5: Quản lý Phiên bản (Git cho Nhà văn) & Xuất bản (Tuần 14 - Tuần 16)
**Mục tiêu:** Đóng gói tính năng nâng cao, tối ưu hóa hiệu năng và hoàn thiện bộ công cụ xuất bản thương mại.

* **Tuần 14: "Time Machine" & "Alternate Timelines" (Wrapper trên `libgit2`)**
  * [ ] Bọc các khái niệm phức tạp của Git (`commit`, `branch`, `merge`, `diff`) thành ngôn ngữ của nhà văn:
    * `Commit` $\rightarrow$ **Lưu Điểm Nhớ (Snapshot)**.
    * `Branch` $\rightarrow$ **Nhánh Cốt Truyện Thử Nghiệm (What-If Timeline)**.
  * [ ] Giao diện so sánh 2 phiên bản bản thảo trực quan cạnh nhau (Side-by-side Prose Diff).
* **Tuần 15: Bộ máy Xuất bản (Publishing Compiler)**
  * [ ] Viết bộ biên dịch gộp toàn bộ các file `.md` theo thứ tự chương trong cấu hình, tự động loại bỏ các khối Ghi chú tác giả (Author Notes).
  * [ ] Xuất ra định dạng chuẩn công nghiệp: **EPUB 3** (dùng crate `epub-builder`), **DOCX** chuẩn bản thảo gửi nhà xuất bản, và **PDF**.
* **Tuần 16: Kiểm thử Tải nặng (Stress Testing) & Đóng gói Phân phối**
  * [ ] Tạo bộ dữ liệu giả lập (Mock Novel) gồm $500$ chương truyện ($\approx 1.000.000$ từ) và $500$ hồ sơ nhân vật để đo lường RAM, CPU và tối ưu hóa các truy vấn SQLite/Rust.
  * [ ] Thiết lập GitHub Actions để tự động build bộ cài đặt đa nền tảng (`.msi` / `.exe` cho Windows, `.dmg` cho macOS, `.AppImage` / `.deb` cho Linux) kèm cơ chế Auto-Updater của Tauri v2.

---

## 3. DANH SÁCH THƯ VIỆN KHUYẾN NGHỊ (TECH STACK MANIFEST)

### 3.1. Phía Rust Backend (`src-tauri/Cargo.toml`)
| Phân hệ | Tên Crate | Vai trò cụ thể |
| :--- | :--- | :--- |
| **Core & Async** | `tauri` (v2), `tokio`, `serde`, `serde_json` | Khung ứng dụng chính, xử lý đa luồng bất đồng bộ và tuần tự hóa dữ liệu. |
| **Type Safety** | `specta`, `tauri-specta` | Tự động xuất file `bindings.ts` từ các struct và command của Rust sang Next.js. |
| **Database & RAG** | `rusqlite` (bundled), `sqlite-vec` | Cơ sở dữ liệu nhúng lưu trữ đồ thị thực thể và tìm kiếm vector ngữ nghĩa cục bộ. |
| **Text & AST** | `pulldown-cmark`, `gray_matter`, `aho-corasick` | Phân tích cú pháp Markdown tốc độ cao, tách YAML frontmatter và quét tên nhân vật. |
| **Diff & VCS** | `similar`, `git2` | Tính toán phần thay đổi văn bản từng từ/dòng và quản lý lịch sử phiên bản Git. |
| **File Watcher** | `notify`, `notify-debouncer-full` | Theo dõi thay đổi file thời gian thực khi AI Agent bên ngoài can thiệp vào dự án. |

### 3.2. Phía Next.js Frontend (`package.json`)
| Phân hệ | Tên Package | Vai trò cụ thể |
| :--- | :--- | :--- |
| **Framework & UI** | `next`, `react`, `tailwindcss`, `lucide-react` | Nền tảng giao diện người dùng hiện đại, hỗ trợ Dark/Light/Sepia theme cho người viết. |
| **Workbench Layout** | `dockview` hoặc `react-resizable-panels` | Tạo giao diện chia tách cửa sổ, kéo thả tab linh hoạt chuẩn VS Code. |
| **Rich Text Editor** | `@tiptap/react`, `@tiptap/pm`, `tiptap-markdown` | Nhân soạn thảo văn bản dạng khối, hỗ trợ gắn thẻ thực thể và hiển thị Inline Diff. |
| **State & Data** | `zustand`, `@tanstack/react-query` | Quản lý trạng thái toàn cục siêu nhẹ và đồng bộ dữ liệu bất đồng bộ với Rust. |
| **Visualizations** | `@xyflow/react` (React Flow) | Vẽ sơ đồ mối quan hệ nhân vật (Character Relationship Graph) và nhánh cốt truyện. |