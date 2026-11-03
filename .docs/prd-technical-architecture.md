# TÀI LIỆU ĐẶC TẢ SẢN PHẨM & KIẾN TRÚC KỸ THUẬT (PRD & ARCHITECTURE)
**Tên dự án (Codename):** NovelForge IDE (IDE Chuyên Biệt Cho Người Viết Lách)  
**Phiên bản tài liệu:** 1.0.0  
**Tech Stack cốt lõi:** Tauri v2 (Rust) + Next.js (Static Export) + SQLite/sqlite-vec + MCP (Model Context Protocol)

---

## 1. TỔNG QUAN DỰ ÁN (EXECUTIVE SUMMARY)

### 1.1. Tầm nhìn sản phẩm
Xây dựng một Môi trường Phát triển Tích hợp (IDE) dành riêng cho tiểu thuyết gia, biên kịch, tác giả sách chuyên khảo và người sáng tạo nội dung dài kỳ. Sản phẩm kết hợp:
* **Sự linh hoạt của Notion:** Soạn thảo dạng khối (Block-based), quản lý cơ sở dữ liệu thế giới quan (Lorebook/Wiki) trực quan.
* **Không gian làm việc của VS Code:** Quản lý tệp tin Local-first, chia màn hình đa luồng (Multi-pane), hệ thống quản lý phiên bản Git ẩn dưới giao diện thân thiện.
* **Trí tuệ phân tích của IntelliJ IDEA:** Kiểm tra tính nhất quán của cốt truyện theo thời gian thực (Continuity Linter), đổi tên thực thể hàng loạt (Refactor Rename), tra cứu tham chiếu nhân vật (Find Usages).
* **Hệ sinh thái Multi-Agent AI mở:** Tích hợp sâu với các tác nhân AI tiên tiến (Cline, OpenCode, Antigravity, Claude Code, Local LLMs) thông qua chuẩn giao thức **MCP (Model Context Protocol)** và cơ chế duyệt thay đổi **Inline Diff**.

### 1.2. Giải quyết nỗi đau (Pain Points)
1. **Hiệu năng kém trên bản thảo lớn:** Notion, Google Docs hay Word bị giật lag nghiêm trọng khi tài liệu vượt quá $50.000 - 100.000$ từ.
2. **Đứt gãy ngữ cảnh (Context Fragmentation):** Tác giả phải mở hàng chục tab để tra cứu hồ sơ nhân vật, dòng thời gian, bản đồ khi đang viết chương mới.
3. **Mâu thuẫn logic (Plot Holes):** Nhân vật bị đổi màu mắt, đã chết ở chương trước nhưng xuất hiện ở chương sau, sai lệch tuổi tác theo niên biểu.
4. **AI thiếu ngữ cảnh sâu:** Khi dùng ChatGPT/Claude thông thường, tác giả phải copy-paste thủ công từng đoạn văn và hồ sơ nhân vật, làm mất mạch sáng tác.

---

## 2. KIẾN TRÚC HỆ THỐNG TỔNG THỂ (SYSTEM ARCHITECTURE)

### 2.1. Sơ đồ Kiến trúc Đa tầng (Layered Architecture)

```
+-----------------------------------------------------------------------------------+
|                            FRONTEND LAYER (Next.js SSG)                           |
|  +-------------------+  +-----------------------+  +---------------------------+  |
|  |  Workbench UI     |  |  Block/Prose Editor   |  |  AI Agent & Diff Dock     |  |
|  | (Dockview/Panels) |  | (TipTap + Custom Ext) |  | (Stream UI, Inline Diff)  |  |
|  +---------+---------+  +-----------+-----------+  +-------------+-------------+  |
|            |                        |                            |                |
|            +------------------------+----------------------------+                |
|                                     | Tauri IPC (Type-safe Invoke & Events)       |
+-------------------------------------+---------------------------------------------+
                                      |
+-------------------------------------+---------------------------------------------+
|                             BACKEND LAYER (Rust / Tauri v2)                       |
|  +--------------------+  +----------------------+  +---------------------------+  |
|  | Literature Linter  |  |  AI Orchestrator     |  |  Version Control Engine   |  |
|  | & AST Engine       |  |  & MCP Host/Server   |  |  (libgit2 wrapper)        |  |
|  +---------+----------+  +----------+-----------+  +-------------+-------------+  |
|            |                        |                            |                |
|  +---------+------------------------+----------------------------+-------------+  |
|  |                        Data & Storage Coordinator                           |  |
|  +------------------+-------------------------------+--------------------------+  |
+---------------------|-------------------------------|-----------------------------+
                      |                               |
        +-------------+-------------+   +-------------+--------------+
        | Local File System (.md)   |   | Embedded DB (SQLite + Vec) |
        | - /manuscript/ch_01.md    |   | - Entity Graph (Lorebook)  |
        | - /lore/characters/       |   | - Vector Embeddings (RAG)  |
        +---------------------------+   +----------------------------+
```

### 2.2. Nguyên lý hoạt động giữa Next.js và Tauri v2
* **Chế độ Static Export (`output: 'export'`):** Next.js được biên dịch hoàn toàn thành HTML/CSS/JS tĩnh để chạy mượt mà trên WebView của hệ điều hành (WebView2 trên Windows, WKWebView trên macOS, WebKitGTK trên Linux).
* **Tách biệt Trạng thái (State Decoupling):** 
  * Frontend (Zustand + TipTap State) chỉ giữ trạng thái hiển thị của các tab đang mở để đảm bảo tốc độ gõ phím đạt $60\text{ FPS}$ (độ trễ $< 16\text{ ms}$).
  * Backend (Rust) nắm giữ toàn bộ cây thư mục, chỉ mục tìm kiếm, đồ thị liên kết nhân vật và luồng kết nối AI.

---

## 3. ĐẶC TẢ CHI TIẾT CÁC PHÂN HỆ (CORE MODULES)

### 3.1. Phân hệ Lưu trữ Local-First (Storage & Project Structure)
Mỗi dự án viết lách là một thư mục độc lập trên ổ cứng của người dùng, hoàn toàn tương thích với Git và các công cụ bên ngoài (như VS Code, Obsidian, Cline):

```text
my-novel-project/
├── .novelforge/                 # Thư mục cấu hình ẩn của IDE
│   ├── index.sqlite             # Database chỉ mục, đồ thị thực thể & Vector RAG (Tự động sinh)
│   ├── config.json              # Cấu hình dự án, luật Linter, thiết lập AI Agent
│   └── snapshots/               # Metadata bổ sung cho các nhánh cốt truyện
├── manuscript/                  # Bản thảo chính
│   ├── act-01/
│   │   ├── ch-01-khoi-dau.md
│   │   └── ch-02-bien-co.md
├── lorebook/                    # Thế giới quan (Cơ sở dữ liệu kiểu Notion)
│   ├── characters/              # Hồ sơ nhân vật (.md kèm YAML Frontmatter)
│   ├── locations/               # Địa danh, bản đồ
│   ├── items/                   # Vật phẩm, công nghệ, hệ thống phép thuật
│   └── timeline.json            # Trục thời gian chuẩn của toàn bộ tác phẩm
└── exports/                     # Nơi xuất file (.epub, .docx, .pdf)
```

**Định dạng File Bản thảo & Lore (Markdown + YAML Frontmatter):**
```markdown
---
id: "char_linh_001"
type: "character"
name: "Lâm Vũ Linh"
aliases: ["Tiểu Linh", "Đặc vụ số 7"]
status: "alive"
birth_year: 2001
tags: ["nhân vật chính", "hacker"]
---
# Tiểu sử nhân vật
Nội dung mô tả chi tiết dưới dạng các Block của Notion...
```

### 3.2. Phân hệ "IntelliJ Inspector" cho Văn học (Semantic & Continuity Engine)
Được viết hoàn toàn bằng Rust để chạy ngầm trên luồng đa nhân (Multi-threading):
1. **Entity Recognition & Hover Card:**
   * Tự động quét toàn bộ tên nhân vật, biệt danh (`aliases`), địa danh từ thư mục `lorebook/`.
   * Khi người dùng gõ tên nhân vật trong chương truyện, IDE tự động nhận diện, gạch chân mờ và cho phép rê chuột (Hover) để xem nhanh thông tin (Tuổi, Trạng thái, Ngoại hình) mà không cần chuyển tab.
2. **Continuity Linter (Kiểm tra lỗ hổng cốt truyện):**
   * **Rule 1 (Dead Character Check):** Nếu nhân vật có trạng thái `status: "dead"` tại mốc thời gian $T_1$ (Chương 5), nhưng lại có hành động trực tiếp tại mốc $T_2 > T_1$ (Chương 8) mà chương đó không được gắn nhãn `flashback` (Hồi tưởng), hệ thống sẽ báo cảnh báo màu vàng (Warning).
   * **Rule 2 (Attribute Consistency):** Kiểm tra mâu thuẫn mô tả ngoại hình hoặc thuộc tính cố định dựa trên đối chiếu Vector/Từ khóa với hồ sơ gốc.
   * **Rule 3 (Pacing & Readability):** Phân tích nhịp điệu câu văn (câu quá dài, lặp từ vựng trong phạm vi $200$ từ, tỷ lệ hội thoại/mô tả).
3. **Safe Refactoring (Đổi tên thông minh):**
   * Cho phép đổi tên nhân vật hoặc địa danh trên toàn bộ $100$ chương truyện, tự động xử lý cả tên chính lẫn biệt danh và hiển thị bảng **Diff Preview** trước khi lưu.

### 3.3. Phân hệ Tích hợp AI Đa Tác Nhân (Multi-Agent & MCP Bridge)
Để kết nối mượt mà với **Antigravity, OpenCode, Cline** và các LLM API:

1. **Embedded MCP Server (Giao thức chuẩn hóa ngữ cảnh):**
   * Rust Backend khởi chạy một MCP Server cục bộ (qua `stdio` hoặc `SSE`).
   * **Các MCP Tools cung cấp cho AI bên ngoài:**
     * `novel_search_lore(query, entity_type)`: Tìm kiếm thông tin nhân vật/bối cảnh bằng Hybrid Search (BM25 + Vector).
     * `novel_get_chapter_context(chapter_id, window_size)`: Lấy nội dung chương hiện tại kèm tóm tắt chương trước và chương sau.
     * `novel_check_continuity(draft_text, chapter_id)`: Cho phép AI tự chạy bộ Linter để kiểm tra xem đoạn văn nó vừa viết có mâu thuẫn với cốt truyện không.
     * `novel_propose_edit(file_path, start_line, end_line, new_content, rationale)`: Đẩy đề xuất sửa đổi lên giao diện Diff của IDE.
2. **Sidecar & Subprocess Terminal (Tích hợp OpenCode / Cline CLI):**
   * Tauri quản lý các tiến trình CLI của OpenCode hoặc các Agent chạy nền.
   * Giao diện bên phải của IDE có thể chuyển đổi linh hoạt giữa:
     * **Native AI Chat & Composer:** Giao diện tích hợp sẵn gọi trực tiếp OpenAI, Anthropic Claude, Gemini, Ollama.
     * **External Agent Bridge:** Theo dõi luồng suy nghĩ (Chain-of-thought) và các lệnh đọc/ghi file từ Cline, Antigravity hoặc OpenCode theo thời gian thực.
3. **Cơ chế File Watcher & Conflict Guard:**
   * Khi một Agent bên ngoài sửa trực tiếp file `.md` trên ổ cứng, crate `notify` trong Rust sẽ bắt sự kiện trong $< 5\text{ ms}$, tính toán phần khác biệt bằng crate `similar` và hiển thị thành giao diện **Accept / Reject Inline Diff** ngay trên trình soạn thảo TipTap thay vì làm mất chữ người dùng đang gõ.

---

## 4. THIẾT KẾ CƠ SỞ DỮ LIỆU NHÚNG (SQLITE + SQLITE-VEC)

Dữ liệu gốc luôn nằm ở file `.md`, nhưng SQLite đóng vai trò là **Read-Model / Cache tốc độ cao**:

```sql
-- Bảng quản lý tất cả các thực thể (Nhân vật, Địa điểm, Vật phẩm, Chương)
CREATE TABLE entities (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL, -- 'character', 'location', 'item', 'chapter'
    title TEXT NOT NULL,
    aliases JSON,              -- Mảng các tên gọi khác ["Tiểu Linh", "Số 7"]
    file_path TEXT UNIQUE NOT NULL,
    metadata JSON,             -- Lưu toàn bộ YAML frontmatter
    content_hash TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bảng theo dõi sự xuất hiện (Find Usages / Backlinks giống IntelliJ)
CREATE TABLE entity_mentions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_chapter_id TEXT NOT NULL,
    target_entity_id TEXT NOT NULL,
    paragraph_index INTEGER NOT NULL,
    char_offset INTEGER NOT NULL,
    context_snippet TEXT,
    FOREIGN KEY(source_chapter_id) REFERENCES entities(id),
    FOREIGN KEY(target_entity_id) REFERENCES entities(id)
);

-- Bảng lưu trữ Vector Embeddings (Dùng sqlite-vec cho Local RAG)
CREATE VIRTUAL TABLE lore_embeddings USING vec0(
    chunk_id TEXT PRIMARY KEY,
    entity_id TEXT,
    embedding FLOAT[768]       -- Tương thích nomic-embed-text hoặc text-embedding-3-small
);
```

---

## 5. CHỈ SỐ HIỆU NĂNG MỤC TIÊU (NON-FUNCTIONAL REQUIREMENTS)

* **Thời gian khởi động (Cold Start):** $< 1.2\text{ giây}$.
* **Dung lượng RAM tiêu thụ:** $< 250\text{ MB}$ cho dự án quy mô $300.000$ từ (nhờ xử lý hậu kỳ bằng Rust thay vì Electron/Node.js).
* **Tốc độ tìm kiếm toàn văn & Thực thể (`Ctrl + P` / `Ctrl + Shift + F`):** $< 20\text{ ms}$ cho $1.000$ files.
* **Độ trễ phân tích Linter nền:** $< 150\text{ ms}$ sau khi ngừng gõ.