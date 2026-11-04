# TÀI LIỆU ĐẶC TẢ THIẾT KẾ GIAO DIỆN & TRẢI NGHIỆM NGƯỜI DÙNG (UI/UX SPECIFICATION)
**Dự án:** NovelForge IDE  
**Phiên bản:** 2.0.0 (Editorial Atelier & Precision IDE)  
**Triết lý Thiết kế:** *"Tập trung như Notion, Quyền năng như VS Code, Sâu sắc như IntelliJ IDEA, Tinh tế như Trang Sách Xuất Bản"*  
**Thư viện UI cốt lõi:** TailwindCSS + Next.js Google Fonts (`Literata`, `Plus Jakarta Sans`, `JetBrains Mono`) + Dockview + React Flow

---

## 1. TRIẾT LÝ THIẾT KẾ & HỆ THỐNG MÀU SẮC (DESIGN SYSTEM)

Khác với IDE lập trình chỉ ưu tiên hiển thị mật độ thông tin dày đặc, **NovelForge IDE** phân tách rõ rệt giữa **Bề mặt Trang Giấy Văn Học (`--bg-paper`)** ở trung tâm và **Khung Điều Khiển Kỹ Thuật (`--bg-panel` / `--bg-canvas`)** ở xung quanh để không làm mỏi mắt tác giả khi nhìn màn hình 6–8 tiếng mỗi ngày, đồng thời **đảm bảo độ tương phản chuẩn WCAG AAA (không có bất kỳ chữ nào bị chìm trong nền ở bất cứ theme nào)**.

### 1.1. Hệ thống 3 Chủ đề Giao diện (Themes) & Tương Phản Thích Ứng
1. **Obsidian Ink (Dark Mode - Mặc định cho quản lý cấu trúc & làm việc đêm):**
   * Nền xung quanh (`--bg-canvas`): `#0B0D11` | Nền khung phụ (`--bg-panel`): `#12151C` | Bề mặt trang giấy (`--bg-paper`): `#131720`
   * Văn bản chính (`--text-primary`): `#F1F5F9` | Văn bản phụ (`--text-muted`): `#94A3B8`
   * Màu ngữ nghĩa (Semantic Text): Sáng rõ trên nền tối (`#FCA5A5` cho lỗi, `#FDE68A` cho cảnh báo, `#6EE7B7` cho thành công/AI).
2. **Warm Parchment (Sepia Mode - Tối ưu chống mỏi mắt khi sáng tác dài kỳ):**
   * Nền xung quanh (`--bg-canvas`): `#EFE9DC` | Nền khung phụ (`--bg-panel`): `#E6DEC8` | Bề mặt trang giấy (`--bg-paper`): `#FBF8F1`
   * Văn bản chính (`--text-primary`): `#231D18` (Màu mực tàu đậm) | Văn bản phụ (`--text-muted`): `#574C41`
   * Màu ngữ nghĩa (Semantic Text): Mực đậm độ tương phản cao (`#991B1B` cho lỗi, `#78350F` cho cảnh báo, `#065F46` cho thành công/AI).
3. **Daylight Paper (Clean Light Mode - Phong cách Notion / Editorial):**
   * Nền xung quanh (`--bg-canvas`): `#F1F5F9` | Nền khung phụ (`--bg-panel`): `#F8FAFC` | Bề mặt trang giấy (`--bg-paper`): `#FFFFFF`
   * Văn bản chính (`--text-primary`): `#0F172A` | Văn bản phụ (`--text-muted`): `#475569`
   * Màu ngữ nghĩa (Semantic Text): Đậm sắc nét (`#991B1B` cho lỗi, `#92400E` cho cảnh báo, `#065F46` cho thành công/AI).

### 1.2. Bảng màu Ngữ nghĩa Thích ứng (Adaptive Semantic Tokens)
* **Entity Mention (`@Nhân_Vật`):** Sử dụng `--entity-pill-bg` và `--entity-pill-text` (`#34D399` trên nền tối, `#065F46` trên nền giấy sáng/sepia).
* **Location/Lore Tag (`#Địa_Danh`):** Sử dụng `--lore-pill-bg` và `--lore-pill-text` (`#60A5FA` trên nền tối, `#1E40AF` trên nền giấy sáng/sepia).
* **Continuity Error (Lỗi mâu thuẫn cốt truyện nghiêm trọng):** Gạch chân răng cưa Đỏ san hô (`#EF4444`) kèm hộp thông báo `.semantic-error-box`.
* **Style/Pacing Warning (Cảnh báo lặp từ, câu quá dài):** Gạch chân răng cưa Vàng hổ phách (`#F59E0B`) kèm hộp thông báo `.semantic-warning-box`.
* **AI Diff Inline Card:** Sử dụng `.semantic-error-box` (đoạn gốc gạch ngang) và `.semantic-success-box` (đoạn đề xuất mới).

### 1.3. Hệ thống Phông chữ Tiếng Việt (Vietnamese Typography)
* **UI & Sidebar & Inspector (`--font-sans`):** `Plus Jakarta Sans` (hỗ trợ dấu tiếng Việt sắc nét ở cỡ chữ `12px - 14px`).
* **Trình soạn thảo Bản thảo (`--font-serif`):** `Literata` (Font serif chuyên biệt cho sách điện tử dài kỳ, xử lý hoàn hảo dấu chồng tiếng Việt như *ế, ắ, ộ, ử*, cỡ chữ tùy chỉnh `14px - 26px`, `line-height: 1.85`, hỗ trợ thụt đầu dòng văn học `text-indent: 1.75em`).
* **Code / Markdown Raw / AI Terminal (`--font-mono`):** `JetBrains Mono` (cỡ chữ `12px - 13px`).

---

## 2. BỐ CỤC TỔNG THỂ WORKBENCH (MASTER WIREFRAME)

Giao diện chính gồm **Top Workbench Header Bar**, **Left Activity Bar**, **Collapsible Sidebar**, **Elevated Paper Canvas Editor**, **Right AI & MCP Hub**, và **Bottom Status Bar**:

```text
+------------------------------------------------------------------------------------------------------+
| [✨ NovelForge] Huyết Cảng 2026 › Hồi 1 › Ch.08   [🔍 Tìm nhanh / Lệnh (Ctrl+P)]   [🌙|📜|☀️] [◧][◨] |
+----+----------------------+------------------------------------------------+-------------------------+
|    | EXPLORER / LORE      | [📄 Ch.08: Đêm Mưa (x)] [👤 Lâm Vũ Linh (x)]   | 🤖 AI AGENT & INSPECTOR |
| 📚 |----------------------|------------------------------------------------|-------------------------|
|    | ▼ 📁 Hồi 1           |  [Chèn/Lệnh (/)] [***] [Thụt dòng] [Literata]  | [Composer] [Bridge][MCP]|
| 🧬 |   📄 Ch.01           |  +------------------------------------------+  |-------------------------|
|    |   📄 Ch.08 (Đang mở) |  | [✍️ Đang biên tập] [👁️ POV: Linh] [🎯 85%]|  | 📌 Ngữ cảnh nạp tự động:|
| 🔍 | ▼ 🧬 Lorebook        |  |                                          |  | [@Lâm Vũ Linh] [Ch.07]  |
|    |   👤 Nhân vật (4)    |  | Chương 8: Đêm Mưa Tại Bến Cảng           |  |-------------------------|
| 🌿 |   🗺️ Địa danh (2)    |  |                                          |  | 💬 Story Composer:      |
|    |   ⚔️ Vật phẩm (1)    |  |   Mưa như trút nước xuống #Bến Cảng Đông.|  | Đã phân tích và đẩy     |
| 🛡️ |----------------------|  | @Lâm Vũ Linh siết chặt khẩu súng. Cô     |  | Inline Diff tại đoạn 3. |
| (2)| ⚠️ CẢNH BÁO (2)      |  | không ngờ Trần Hạo lại xuất hiện...      |  |                         |
|    | • Ch.08: Trần Hạo    |  |           ~~~~~~~~ (Nhấp vào đoạn bất kỳ |  | [✍️ Viết tiếp dồn dập]  |
| ⚙️ |   đã chết ở Ch.05    |  |            để sửa trực tiếp tại chỗ)     |  | [Nhập yêu cầu sáng tác] |
+----+----------------------+--+------------------------------------------+--+-------------------------+
| 🌿 main | ✓ Đã lưu | ⚡ MCP: 3 Agents Connected      | ⚠️ 1 Lỗi, 1 Cảnh báo | 142 từ | Xuất bản | Zen |
+------------------------------------------------------------------------------------------------------+
```

---

## 3. CHI TIẾT CÁC NÂNG CẤP TRẢI NGHIỆM CỐT LÕI

### 3.1. Vùng Soạn thảo Trang Giấy Liền Mạch (True In-Place Paper Canvas)
* **Trang giấy nâng nổi (`--bg-paper`):** Đặt giữa vùng làm việc với bóng đổ dịu (`--shadow-paper`), tách biệt khỏi khung điều khiển xung quanh.
* **Sửa trực tiếp tại chỗ (In-Place Paragraph Editing):**
  * Mặc định hiển thị văn bản văn học liền mạch cùng các thẻ `@Nhân_vật`, `#Địa_danh` và đường gạch chân Linter.
  * Khi tác giả **nhấp trực tiếp vào bất kỳ đoạn văn nào**, đoạn văn đó chuyển ngay sang chế độ gõ tại chỗ (giữ nguyên phông chữ `Literata`, cỡ chữ và độ thụt đầu dòng), không còn khung `<textarea>` phụ bên dưới.
  * Nhấn `Enter` để tạo đoạn văn mới ngay bên dưới, `Esc` hoặc nhấp ra ngoài để đóng chế độ sửa và khôi phục tức thì lớp trang trí thực thể.

### 3.2. Dải Thuộc Tính Đầu Chương Gọn Nhẹ (Compact Notion Property Pills)
* Thu gọn các trường YAML Frontmatter thành một hàng Pill ngang ngay trên tiêu đề chương:
  * Pill trạng thái (`Bản nháp` / `Đang biên tập` / `Hoàn tất` — bấm để đổi nhanh).
  * Pill chọn nhanh góc nhìn (`POV: Lâm Vũ Linh`), mốc thời gian (`15/10/2026`), địa điểm (`#Bến Cảng Đông`) và thanh tiến trình mục tiêu số từ.
  * Nút mở rộng ngăn kéo cấu hình YAML chi tiết khi cần chỉnh sửa sâu.

### 3.3. Thanh Tiêu Đề Toàn Cục (Top Workbench Header Bar)
* Tích hợp đường dẫn Breadcrumb của chương đang mở, nút kích hoạt nhanh `CommandPalette (Ctrl+P)` ở trung tâm, bộ chuyển đổi trực tiếp 3 chủ đề (`🌙 Obsidian` | `📜 Parchment` | `☀️ Daylight`) và nút đóng/mở nhanh Sidebar trái & Right AI Dock.
