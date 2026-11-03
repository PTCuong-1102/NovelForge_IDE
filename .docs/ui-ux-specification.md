# TÀI LIỆU ĐẶC TẢ THIẾT KẾ GIAO DIỆN & TRẢI NGHIỆM NGƯỜI DÙNG (UI/UX SPECIFICATION)
**Dự án:** NovelForge IDE  
**Phiên bản:** 1.0.0  
**Triết lý Thiết kế:** *"Tập trung như Notion, Quyền năng như VS Code, Sâu sắc như IntelliJ IDEA"*  
**Thư viện UI cốt lõi:** TailwindCSS + Shadcn UI + Dockview + TipTap + React Flow

---

## 1. TRIẾT LÝ THIẾT KẾ & HỆ THỐNG MÀU SẮC (DESIGN SYSTEM)

Khác với IDE lập trình chỉ ưu tiên hiển thị mật độ thông tin dày đặc, **NovelForge IDE** phải cân bằng giữa **Chế độ Quản trị Đại cục (Architect Mode)** và **Chế độ Nhập tâm Sáng tác (Zen Writing Mode)** để không làm mỏi mắt tác giả khi nhìn màn hình 6–8 tiếng mỗi ngày.

### 1.1. Hệ thống 3 Chủ đề Giao diện (Themes)
1. **Obsidian Ink (Dark Mode - Mặc định cho quản lý cấu trúc):**
   * Nền chính (Canvas): `#0F1115` | Nền khung phụ (Sidebar/Panel): `#161920`
   * Văn bản chính: `#E2E8F0` | Văn bản mờ (Muted): `#64748B`
2. **Warm Parchment (Sepia Mode - Tối ưu chống mỏi mắt khi viết đêm/ngày):**
   * Nền chính (Canvas): `#FBF8F1` | Nền khung phụ: `#F3EFE6`
   * Văn bản chính: `#2C2623` (Màu mực tàu dịu) | Văn bản mờ: `#78716C`
3. **Daylight Paper (Clean Light Mode - Phong cách Notion):**
   * Nền chính: `#FFFFFF` | Nền khung phụ: `#F8FAFC`
   * Văn bản chính: `#0F172A`

### 1.2. Bảng màu Ngữ nghĩa (Semantic Colors cho Linter & AI)
* **Entity Mention (`@Nhân_Vật`):** Xanh ngọc lục bảo (`#10B981` nền mờ $12\%$).
* **Location/Lore Tag (`#Địa_Danh`):** Xanh dương (`#3B82F6` nền mờ $12\%$).
* **Continuity Error (Lỗi mâu thuẫn cốt truyện nghiêm trọng):** Gạch chân răng cưa Đỏ san hô (`#EF4444`).
* **Style/Pacing Warning (Cảnh báo lặp từ, câu quá dài):** Gạch chân răng cưa Vàng hổ phách (`#F59E0B`).
* **AI Diff - Đoạn thêm mới:** Nền xanh lá nhạt (`rgba(34, 197, 94, 0.15)`), viền trái `#22C55E`.
* **AI Diff - Đoạn bị xóa:** Nền đỏ nhạt (`rgba(239, 68, 68, 0.15)`), chữ gạch ngang.

### 1.3. Hệ thống Phông chữ (Typography)
* **UI & Sidebar & Inspector (Sans-serif):** `Inter` hoặc `Plus Jakarta Sans` (cỡ chữ $12\text{px} - 14\text{px}$).
* **Trình soạn thảo Bản thảo (Prose Serif/Sans tùy chọn):** `Literata`, `Merriweather`, hoặc `Charter` (Tối ưu hóa dấu tiếng Việt, cỡ chữ $16\text{px} - 20\text{px}$, chiều cao dòng `line-height: 1.75`, độ rộng tối đa một dòng `max-width: 68ch` để mắt không phải đảo quá xa).
* **Code / Markdown Raw / AI Terminal (Monospace):** `JetBrains Mono` (cỡ chữ $13\text{px}$).

---

## 2. BỐ CỤC TỔNG THỂ WORKBENCH (MASTER WIREFRAME)

Giao diện chính được chia làm **6 vùng không gian (Zones)** có thể đóng/mở hoặc kéo giãn linh hoạt bằng phím tắt:

```text
+--------------------------------------------------------------------------------------------------+
| [NovelForge]  File  Edit  View  Lore  AI-Agent  Publish     [🔍 Tìm nhanh / Lệnh (Ctrl+P)]  [-][x]|
+----+--------------------+----------------------------------------------+-------------------------+
|    | EXPLORER / LORE    | [📄 Ch.08: Đêm Mưa (x)] [👤 Lâm Vũ Linh (x)] | 🤖 AI AGENT & INSPECTOR |
| 📚 |--------------------|----------------------------------------------|-------------------------|
|    | ▼ 📁 Bản Thảo      |  Chương 8: Đêm Mưa Tại Bến Cảng             | [Composer] [Cline] [MCP]|
| 🧬 |   ▼ 📁 Hồi 1       |  ⏱️ Năm 2026 | 📍 #Bến_Cảng_Đông | 👁️ POV: Linh|-------------------------|
|    |     📄 Ch.01       |  ------------------------------------------  | 🎯 Ngữ cảnh đang ghim:  |
| 🔍 |     📄 Ch.08 (Đang)|                                              | [@Lâm Vũ Linh] [Ch.07]  |
|    | ▼ 🧬 Lorebook      |  Mưa như trút nước xuống [#Bến_Cảng_Đông].   |-------------------------|
| 🌿 |   👤 Nhân vật (24) |  [@Lâm Vũ Linh] siết chặt khẩu súng trong    | 💬 Tác vụ AI (OpenCode):|
|    |   🗺️ Địa danh (12) |  tay. Cô không ngờ [Trần Hạo] lại xuất hiện  | "Viết tiếp cảnh đối đầu |
| 🤖 |   ⚔️ Vật phẩm (08) |                     ~~~~~~~~~                |  nhưng giữ nhịp độ dồn  |
|    |--------------------|                     (⚠️ Lỗi: Đã chết ở Ch.5) |  dập, ít mô tả rườm rà."|
| 📊 | ⚠️ CẢNH BÁO (2)    |                                              |                         |
|    | • Ch.08: Trần Hạo  |  +----------------------------------------+  | ✅ Đã tra cứu Lorebook  |
|    |   đã chết ở Ch.05  |  | 🤖 Đề xuất từ AI (Cline / Antigravity):|  | ✍️ Đang đề xuất 1 đoạn  |
|    | • Ch.08: Lặp từ    |  | - Cô bước lùi lại phía sau thùng hàng. |  |    văn tại dòng 42...   |
| ⚙️ |   "lạnh lẽo" (4x)  |  | + Linh lách người nấp sau thùng hàng   |  |                         |
|    |                    |  | + rỉ sét, hơi thở dồn dập hòa vào mưa. |  | [Nhập lệnh hoặc /...]   |
|    |                    |  |          [✓ Chấp nhận (Tab)] [✕ Từ chối]|  | [Gửi ⏎] [🎙️] [📎 Ghim] |
+----+--------------------+--+----------------------------------------+--+-------------------------+
| 🌿 Nhánh: main (Đã lưu) | ⚡ MCP: 3 Agents Connected | ⚠️ 1 Lỗi, 1 Cảnh báo | 📝 3,420 từ | 🧘 Zen|
+--------------------------------------------------------------------------------------------------+
```

---

## 3. CHI TIẾT TỪNG PHÂN KHU GIAO DIỆN (COMPONENT BREAKDOWN)

### 3.1. Thanh Hoạt động Trái (Left Activity Bar - Kiểu VS Code)
Chiều rộng cố định $48\text{px}$, gồm các biểu tượng chuyển đổi nhanh không gian làm việc:
1. **📚 Manuscript Explorer (`Ctrl+Shift+E`):** Cây thư mục quản lý Hồi (Act) $\rightarrow$ Chương (Chapter) $\rightarrow$ Phân cảnh (Scene). Hỗ trợ kéo-thả để đổi thứ tự chương truyện.
2. **🧬 Lorebook & World-building (`Ctrl+Shift+L`):** Truy cập cơ sở dữ liệu Nhân vật, Địa danh, Hệ thống sức mạnh/vật phẩm, Niên biểu (Timeline).
3. **🔍 Global Search & Find Usages (`Ctrl+Shift+F`):** Tìm kiếm toàn văn hoặc tra cứu mọi phân cảnh mà một nhân vật xuất hiện.
4. **🌿 Story Timeline & Git Snapshots (`Ctrl+Shift+G`):** Quản lý các điểm lưu (Snapshots) và các nhánh cốt truyện thử nghiệm (*What-If Branches*).
5. **📊 Continuity Inspector (`Ctrl+Shift+M`):** Bảng tổng hợp toàn bộ lỗi logic cốt truyện, lỗ hổng thời gian và thống kê nhịp độ văn phong.

---

### 3.2. Không gian Soạn thảo Trung tâm (The Hybrid Notion + IntelliJ Editor)
Sử dụng **Dockview** cho phép chia màn hình không giới hạn (ví dụ: bên trái mở *Chương 8*, bên phải mở *Hồ sơ nhân vật Lâm Vũ Linh* hoặc *Sơ đồ quan hệ*). Bên trong mỗi tab Bản thảo bao gồm:

#### A. Thanh Metadata Đầu Chương (Chapter Header Properties - Kiểu Notion)
Nằm ngay dưới tiêu đề chương, có thể thu gọn, liên kết trực tiếp với YAML Frontmatter của file `.md`:
* **Trạng thái:** `Bản nháp` | `Đang biên tập` | `Hoàn tất`
* **Góc nhìn (POV):** Chọn từ danh sách nhân vật (ví dụ: `@Lâm Vũ Linh`).
* **Mốc thời gian trong truyện:** Ngày/Tháng/Năm hoặc Sự kiện trên trục Timeline (dùng để **Continuity Linter** kiểm tra tuổi tác và trạng thái sống/chết).
* **Địa điểm chính:** Gắn thẻ `#Địa_Danh`.
* **Mục tiêu số từ:** Thanh tiến trình nhỏ (ví dụ: $3.420 / 4.000$ từ).

#### B. Các Tương tác Thông minh Ngay trong Dòng Chữ (In-Editor Micro-Interactions)
1. **Slash Command Menu (`/`):**
   * Gõ `/` để mở menu nổi chia thành 3 nhóm:
     * *Cấu trúc Văn học:* `Phân cảnh mới (***)`, `Ghi chú tác giả (Callout ẩn khi xuất bản)`, `Đoạn Hồi tưởng (Flashback Block)`.
     * *Liên kết Thế giới quan:* `Chèn Nhân vật (@)`, `Chèn Địa danh (#)`, `Tạo nhanh thực thể Lore mới`.
     * *Trợ lý AI tại chỗ:* `Viết tiếp 1 đoạn`, `Miêu tả chi tiết ngũ quan (Show, Don't Tell)`, `Viết lại câu văn mượt hơn`.
2. **Thẻ Thông tin Thực thể khi Rê chuột (IntelliJ Hover Documentation Card):**
   * Khi tác giả rê chuột vào tên `Lâm Vũ Linh` trong bài viết, một thẻ nổi xuất hiện trong $150\text{ ms}$:
   ```text
   +-------------------------------------------------------+
   | [Ảnh] LÂM VŨ LINH (Biệt danh: Tiểu Linh, Số 7)        |
   | 🟢 Còn sống | 🎂 25 tuổi (tại thời điểm Chương 8)     |
   |-------------------------------------------------------|
   | • Ngoại hình: Tóc ngắn ngang vai, vết sẹo nhỏ ở cổ tay|
   | • Tính cách: Lạnh lùng, quyết đoán, sợ không gian hẹp |
   | • Xuất hiện gần nhất: Chương 7 (Cách đây 1 chương)    |
   |-------------------------------------------------------|
   | [↗ Mở hồ sơ]  [🔍 Xem 42 lần xuất hiện]  [✏️ Đổi tên] |
   +-------------------------------------------------------+
   ```
3. **Thẻ Báo lỗi Logic Cốt truyện (Continuity Linter Popover):**
   * Khi rê chuột vào chữ bị gạch chân răng cưa đỏ (ví dụ: `Trần Hạo`):
   ```text
   +-------------------------------------------------------+
   | ❌ MÂU THUẪN LOGIC CỐT TRUYỆN (PLOT HOLE DETECTED)    |
   | Nhân vật "Trần Hạo" đã được đánh dấu [Tử vong] tại    |
   | Chương 5 (Mốc thời gian: 12/10/2026).                 |
   | Chương hiện tại đang diễn ra vào: 15/10/2026.         |
   |-------------------------------------------------------|
   | 💡 Giải pháp nhanh (Quick Fix - Alt+Enter):           |
   | [1. Đánh dấu đoạn văn này là Cảnh Hồi Tưởng]          |
   | [2. Mở hồ sơ Trần Hạo để cập nhật trạng thái]         |
   | [3. Bỏ qua cảnh báo này cho Chương 8]                 |
   +-------------------------------------------------------+
   ```

---

### 3.3. Khu vực Quản lý Thế giới quan (Lorebook & World-building Views)
Khi người dùng mở mục **Lorebook**, vùng trung tâm hỗ trợ 3 chế độ hiển thị (View Switcher):
1. **Chế độ Thẻ Hồ sơ (Gallery Cards):** Hiển thị danh sách nhân vật kèm ảnh đại diện (do AI tạo hoặc tải lên), vai trò, trạng thái sống/chết.
2. **Chế độ Bảng Dữ liệu (Notion Database Table):** Cho phép lọc/sắp xếp nhân vật theo Phe phái, Tuổi, Năng lực, Số chương xuất hiện.
3. **Chế độ Sơ đồ Quan hệ (Relationship Graph - Dùng `@xyflow/react`):**
   * Các nút (Nodes) là Nhân vật/Tổ chức.
   * Các cạnh nối (Edges) thể hiện mối quan hệ: *Kẻ thù, Sư đồ, Tình nhân, Phản bội*.
   * Có thanh trượt thời gian (Timeline Slider) ở dưới đáy: Kéo thanh trượt từ Chương 1 đến Chương 20 để xem mối quan hệ giữa các nhân vật biến đổi như thế nào theo diễn biến truyện.

---

### 3.4. Khu vực Điều phối AI Đa Tác Nhân (Right Dock: AI & MCP Hub)
Khung bên phải rộng $340\text{px} - 450\text{px}$, được thiết kế chuyên biệt để làm việc với **Cline, OpenCode, Antigravity** và các mô hình LLM nội bộ:

1. **Thanh Chuyển đổi Chế độ AI (Top Tabs):**
   * **Tab 1 - Story Composer (Native):** Trợ lý viết lách tích hợp sẵn, tối ưu cho sáng tác, chỉnh sửa văn phong và động não ý tưởng (Brainstorming).
   * **Tab 2 - External Agents (Cline / OpenCode / Antigravity):** Hiển thị luồng hoạt động (Action Log) của các AI Agent đang kết nối qua **MCP Server** hoặc chạy qua CLI Sidecar.
2. **Khay Ngữ cảnh Tự động & Ghim (Context Pill Tray):**
   * Tự động hiển thị các thực thể đang có mặt trong chương hiện tại (ví dụ: `📍 Tự động nạp: @Lâm Vũ Linh, #Bến_Cảng_Đông, Tóm tắt Chương 7`).
   * Người dùng có thể bấm nút `+` để ghim thêm tài liệu bất kỳ vào bộ nhớ của AI.
3. **Trình Duyệt Thay đổi Trực tiếp (Inline Diff & File Lock UI):**
   * Khi **OpenCode** hoặc **Cline** thực hiện lệnh sửa file thông qua MCP Tool `novel_propose_edit`, một thanh điều khiển nổi xuất hiện ở góc dưới trình soạn thảo:
     * `🤖 OpenCode đã đề xuất 3 chỉnh sửa trong Chương 8` $\rightarrow$ Nút `[Đi tới thay đổi tiếp theo (F7)]` | `[Chấp nhận tất cả]` | `[Hoàn tác tất cả]`.
   * Nếu Agent đang ghi dữ liệu, viền của tab hiện tại phát sáng màu tím dịu kèm dòng trạng thái *"AI Agent đang biên tập đoạn 4..."* để tránh xung đột gõ phím.

---

### 3.5. Hộp thoại Đổi tên Thực thể Toàn cục (IntelliJ Refactor Rename Modal)
Khi tác giả bấm phím tắt `Shift + F6` trên tên một nhân vật (ví dụ: đổi tên *"Lâm Vũ Linh"* thành *"Lâm Hạ Vy"*):
* Xuất hiện hộp thoại **Smart Literary Refactor**:
  * Nhập tên mới: `Lâm Hạ Vy`
  * Tự động phát hiện các tên gọi/biệt danh liên quan trong YAML (`Tiểu Linh` $\rightarrow$ gợi ý đổi thành `Tiểu Vy`).
  * Hiển thị danh sách **Preview Changes** chia theo từng Chương (ví dụ: *Tìm thấy 142 vị trí trong 12 chương và 3 hồ sơ Lorebook*).
  * Cho phép bỏ tích những câu văn không muốn đổi trước khi bấm **[Refactor Toàn Dự Án]**.

---

### 3.6. Chế độ Nhập tâm Tuyệt đối (Zen / Focus Mode - `F11` hoặc `Ctrl+Shift+Z`)
Dành cho lúc tác giả chỉ muốn viết mạch lạc mà không bị phân tâm bởi bất kỳ thông số kỹ thuật nào:
* Ẩn toàn bộ Sidebar trái, AI Panel phải, thanh Tab và thanh Status Bar.
* Màn hình chỉ còn lại trang giấy ở chính giữa với hiệu ứng **Typewriter Scrolling** (dòng đang gõ luôn nằm ở trung tâm màn hình theo chiều dọc) và **Paragraph Focus** (làm mờ nhẹ các đoạn văn khác, chỉ làm sáng rõ đoạn văn đang gõ).
* Mọi cảnh báo lỗi Linter tạm thời ẩn đi và chỉ hiển thị lại khi thoát khỏi Zen Mode.

---

## 4. HỆ THỐNG PHÍM TẮT CHUẨN HÓA (KEYBOARD-FIRST ERGONOMICS)

Để mang lại tốc độ thao tác của VS Code và IntelliJ cho nhà văn:

| Phím tắt (Win/Linux) | Phím tắt (macOS) | Chức năng |
| :--- | :--- | :--- |
| `Ctrl + P` | `Cmd + P` | Mở nhanh bất kỳ Chương truyện hoặc Hồ sơ Nhân vật nào |
| `Ctrl + Shift + P` | `Cmd + Shift + P` | Mở **Command Palette** (Chạy mọi lệnh của IDE) |
| `Ctrl + K` | `Cmd + K` | Gọi nhanh hộp lệnh AI Inline ngay tại vị trí con trỏ |
| `Shift + F6` | `Shift + F6` | **Refactor Rename**: Đổi tên Nhân vật/Địa danh toàn dự án |
| `Alt + F7` | `Opt + F7` | **Find Usages**: Xem toàn bộ các chương nhân vật này xuất hiện |
| `Alt + Enter` | `Opt + Enter` | Hiển thị gợi ý sửa lỗi nhanh (Quick Fix) cho cảnh báo Linter |
| `Ctrl + \` | `Cmd + \` | Chia đôi màn hình (Mở song song Bản thảo & Lorebook) |
| `Ctrl + S` | `Cmd + S` | Lưu tức thì + Tạo nhanh 1 điểm nhớ (Git Snapshot) nếu giữ `Shift` |
| `Ctrl + Shift + Z` | `Cmd + Shift + Z` | Bật/Tắt chế độ **Zen Mode** (Tập trung viết lách tối đa) |