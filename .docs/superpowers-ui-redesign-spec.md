# Bản Thiết Kế Nâng Cấp Giao Diện: Editorial Atelier & Precision IDE
**Dự án:** NovelForge IDE  
**Ngày:** 2026-11-04  
**Trạng thái:** Đề xuất phê duyệt (Design Specification)

---

## 1. Mục đích & Tầm nhìn (Intent & Why)
Nâng cấp toàn diện giao diện và trải nghiệm người dùng của **NovelForge IDE** theo phong cách **"Editorial Atelier & Precision IDE"** — kết hợp cảm giác viết trên trang giấy xuất bản cao cấp (Sudowrite / Notion / Ulysses) ở vùng trung tâm với sự sắc sảo, tốc độ và độ tương phản chuẩn xác của IDE hiện đại (Cursor / Linear / IntelliJ) ở các khung điều khiển xung quanh.

## 2. Mục tiêu, Phi mục tiêu & Chống mục tiêu (Goals, Non-Goals & Anti-Goals)
* **Mục tiêu (Goals):**
  1. **Soạn thảo trực tiếp trên trang giấy (True In-Place Paper Canvas):** Xóa bỏ hoàn toàn ô `<textarea>` phụ bằng font monospace bên dưới mỗi đoạn văn. Cho phép tác giả nhấp vào bất kỳ đoạn văn nào để sửa trực tiếp tại chỗ (in-place editing) với đúng phông chữ văn học (`Literata`), cỡ chữ và chiều cao dòng, đồng thời khôi phục tức thì các thẻ `@Nhân_vật`, `#Địa_danh` và gạch chân Linter khi rời đoạn văn.
  2. **Hệ thống Màu sắc Thích ứng & Font chữ Tiếng Việt chuẩn xuất bản:** Nạp bộ font `Literata`, `Plus Jakarta Sans`, `JetBrains Mono` (subset `vietnamese`) trong `layout.tsx` và định nghĩa hệ thống CSS Variables ngữ nghĩa đầy đủ cho cả 3 chủ đề (**Obsidian Ink**, **Warm Parchment**, **Daylight Paper**), loại bỏ 100% các class màu tối gán cứng (`text-red-200`, `text-emerald-200`, `bg-emerald-950/20`) gây mù chữ ở chế độ sáng/giấy cổ.
  3. **Đồng bộ hóa toàn bộ Workbench:** Bổ sung thanh **Top Workbench Header / Titlebar** chuẩn IDE (Breadcrumb chương, nút tìm kiếm trung tâm `Ctrl+P`, bộ chuyển đổi nhanh 3 Theme có nhãn rõ ràng, nút bật/tắt nhanh Sidebar trái & AI Dock phải), thu gọn bảng thuộc tính đầu chương thành dải **Compact Property Pills** kiểu Notion.
* **Phi mục tiêu (Non-Goals):**
  - Không thay đổi kiến trúc dữ liệu Rust/Tauri hay cấu trúc store Zustand hiện có.
  - Không thêm thư viện bên ngoài làm nặng bundle.
* **Chống mục tiêu (Anti-Goals):**
  - Tuyệt đối không để giao diện bị rối mắt bởi quá nhiều khung viền (boxes-inside-boxes) làm mất sự tập trung khi viết tiểu thuyết dài kỳ.

## 3. Các phương án đã cân nhắc (Approaches)
1. **Hướng 1 (Đã chọn — Editorial Atelier & Precision IDE):** Trang giấy văn học nâng nổi nhẹ ở trung tâm với chế độ sửa trực tiếp tại chỗ từng đoạn văn (In-Place Paragraph Editing), kết hợp dải thuộc tính Compact Pills, Top Titlebar đồng bộ và hệ thống token màu thích ứng 3 theme.
2. **Hướng 2 (Pure TipTap Single-Canvas):** Đưa toàn bộ chương vào một vùng TipTap duy nhất và đẩy các thẻ thực thể/cảnh báo xuống đáy. *Loại bỏ vì làm mất tính năng tương tác trực tiếp trên từng từ bị lỗi Linter và thẻ Hover Card.*
3. **Hướng 3 (Dense Cockpit):** Giữ nguyên các hộp biểu mẫu lớn và khung viền dày. *Loại bỏ vì gây mỏi mắt và chiếm dụng không gian dọc.*

## 4. Chi tiết Thiết kế Kỹ thuật (Technical Design)

### 4.1. Hệ thống Font chữ & Bảng màu 3 Themes (`src/app/layout.tsx` & `src/app/globals.css`)
* **Google Fonts (`next/font/google`):**
  - `--font-sans`: `Plus Jakarta Sans` (weights: 400, 500, 600, 700, subset `vietnamese`).
  - `--font-serif`: `Literata` (weights: 400, 500, 600, 700, style normal/italic, subset `vietnamese`).
  - `--font-mono`: `JetBrains Mono` (weights: 400, 500, 600, subset `vietnamese`).
* **Bảng Token Màu sắc Mở rộng (`globals.css`):**
  - Bổ sung `--bg-paper` (Nền tờ giấy soạn thảo tách biệt tinh tế với `--bg-canvas` xung quanh), `--border-subtle`, `--shadow-paper`.
  - Bổ sung các biến ngữ nghĩa thích ứng Sáng/Tối/Sepia:
    - `--semantic-error-bg`, `--semantic-error-border`, `--semantic-error-text`
    - `--semantic-warning-bg`, `--semantic-warning-border`, `--semantic-warning-text`
    - `--semantic-success-bg`, `--semantic-success-border`, `--semantic-success-text`
    - `--semantic-info-bg`, `--semantic-info-border`, `--semantic-info-text`

### 4.2. Vùng Soạn thảo Trang giấy Liền mạch (`NovelEditor.tsx` & `ChapterHeaderProperties.tsx`)
* **Trang giấy trung tâm (`max-w-[820px]`):** Được đặt trên bề mặt `--bg-paper` với viền mảnh và bóng đổ dịu (`--shadow-paper`), hỗ trợ tùy chọn **Thụt đầu dòng văn học (First-line Indent)** và **Chế độ Đọc/Sửa trực tiếp (In-Place Editing)**.
* **Cơ chế In-Place Editing:**
  - Khi người dùng nhấp chuột vào đoạn văn `pIdx` (và không phải nhấp vào thẻ `@Nhân_vật` hay từ gạch chân lỗi), đoạn văn đó chuyển sang thẻ `<textarea>` tự động giãn chiều cao (`auto-resize`), khớp 100% font chữ (`Literata`/`Sans`/`Mono`), cỡ chữ (`proseFontSize`), `line-height: 1.85` và padding của đoạn văn.
  - Hỗ trợ phím `Enter` để tách/tạo đoạn văn mới ngay bên dưới, `ArrowUp`/`ArrowDown` để di chuyển mượt giữa các đoạn, và `/` để mở `SlashMenu`.
* **Compact Chapter Header (`ChapterHeaderProperties.tsx`):**
  - Hiển thị dưới dạng một hàng thuộc tính gọn gàng (Status badge, POV selector pill, Story Date pill, Location pill, và thanh tiến trình từ khóa nhỏ gọn), có thể mở rộng khi cần chỉnh sửa sâu.

### 4.3. Đồng bộ hóa Workbench (`page.tsx`, `ActivityBar.tsx`, `Sidebar.tsx`, `RightDock.tsx`, `StatusBar.tsx`)
* **Top Workbench Bar (trong `page.tsx`):** Cao `38px`, hiển thị Logo + Tên dự án + Breadcrumb chương đang mở ở bên trái; Thanh nút mở nhanh `CommandPalette (Ctrl+P)` ở giữa; Bộ chọn nhanh 3 Theme (`Obsidian` / `Parchment` / `Daylight`) + nút đóng/mở Sidebar trái & Right Dock ở bên phải.
* **Sửa toàn bộ màu gán cứng:** Trong `Sidebar.tsx` (Continuity Inspector), `RightDock.tsx` (Composer Chat & Diff), `NovelEditor.tsx` (Author Note, Diff Card), và `RefactorRenameModal.tsx` sang các class/biến ngữ nghĩa mới để hiển thị đẹp hoàn hảo trên cả 3 chủ đề.
* **Cập nhật tài liệu `.docs/ui-ux-specification.md`:** Đồng bộ lại thông số thiết kế mới vào tài liệu đặc tả theo đúng quy ước trong `AGENTS.md`.

