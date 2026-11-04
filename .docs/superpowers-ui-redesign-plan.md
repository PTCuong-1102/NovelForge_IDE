# Editorial Atelier & Precision IDE Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp toàn diện giao diện NovelForge IDE theo kiến trúc "Editorial Atelier & Precision IDE" với vùng soạn thảo trang giấy trực tiếp (In-Place Editing), hệ thống 3 chủ đề màu chuẩn độ tương phản WCAG không bị chìm chữ ở bất cứ theme nào, bộ Google Fonts tiếng Việt (`Literata`, `Plus Jakarta Sans`, `JetBrains Mono`), và khung Workbench đồng bộ có Top Titlebar.

**Architecture:** Mở rộng hệ thống CSS Variables trong `src/app/globals.css` và `tailwind.config.js` với bộ biến màu ngữ nghĩa thích ứng Sáng/Tối/Giấy cổ (`--semantic-error-text`, `--semantic-warning-text`, `--semantic-success-text`, `--semantic-info-text`, `--bg-paper`) để loại bỏ toàn bộ các màu chữ/nền gán cứng. Tái cấu trúc `NovelEditor.tsx` sang cơ chế In-Place Paragraph Editing (nhấp vào đoạn văn để sửa trực tiếp tại chỗ, xóa bỏ `<textarea>` phụ bên dưới) kết hợp dải `ChapterHeaderProperties.tsx` dạng Compact Notion Pills và thanh `TopTitleBar` điều hướng toàn cục trong `src/app/page.tsx`.

**Tech Stack:** Next.js 15 (`next/font/google`), React 19, TailwindCSS 3.4, Zustand 5, Lucide React.

**Spec:** `.docs/superpowers-ui-redesign-spec.md` & `.docs/ui-ux-specification.md`

## Global Constraints

- Tài liệu/tiết lệnh bằng tiếng Việt; code, tên biến, comment code bằng tiếng Anh.
- Cấu trúc thư mục và đường dẫn file phải khớp đúng với `master-execution-plan.md` (mục 1).
- Mọi thay đổi kiến trúc/thiết kế phải cập nhật lại file spec tương ứng trong `.docs/ui-ux-specification.md`.
- Tuyệt đối không để chữ bị chìm trong nền ở bất cứ theme nào (`obsidian`, `parchment`, `daylight`): cấm dùng các class chữ sáng cố định (`text-red-200`, `text-red-300`, `text-amber-200`, `text-emerald-200`, `text-emerald-300`, `text-blue-300`, `bg-emerald-950/20`, `bg-red-950/20`) trên nền trong suốt hoặc nền nhạt.

## Review Focus

- Chữ cảnh báo lỗi/warning trong `Sidebar.tsx`, `NovelEditor.tsx`, `RightDock.tsx`, `RefactorRenameModal.tsx` và `RelationshipGraph.tsx` khi chuyển sang theme `parchment` (`#FBF8F1`) hoặc `daylight` (`#FFFFFF`) phải dùng biến màu ngữ nghĩa đậm (`--semantic-error-text: #B91C1C`, `--semantic-warning-text: #92400E`, `--semantic-success-text: #065F46`, `--semantic-info-text: #1E40AF`) để đạt tỉ lệ tương phản > 7:1.
- Các thẻ `<select>` và `<option>` trên mọi trình duyệt khi ở chế độ `obsidian` hoặc `parchment` phải có `background-color: var(--bg-elevated)` và `color: var(--text-primary)` để chữ trong menu thả xuống không bị trắng trên nền trắng hoặc đen trên nền đen.
- Khi nhấp vào thẻ `@Nhân_vật`, `#Địa_danh` hoặc từ bị gạch chân lỗi Linter trong `NovelEditor.tsx`, sự kiện phải mở Hover Card / Linter Popover chứ không kích hoạt nhầm chế độ sửa văn bản thô khiến người dùng mất thẻ tra cứu.
- Khi đang sửa trực tiếp một đoạn văn (`editingParagraphIndex === pIdx`), nhấn `Escape` hoặc nhấp ra ngoài (`onBlur`) phải đóng chế độ sửa và hiển thị lại ngay đoạn văn đã trang trí thẻ thực thể.
- Nút chuyển đổi 3 Theme trên thanh Top Workbench Bar phải hiển thị rõ trạng thái đang chọn và đồng bộ tức thì với thuộc tính `data-theme` trên `<html>`.

---

### Task 1: Hệ thống Token Màu sắc Thích ứng 3 Theme (Zero Low-Contrast Text) & Google Fonts Tiếng Việt

**Files:**
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.js`
- Modify: `src/app/layout.tsx`
- Create: `src/lib/__tests__/ui-theme-contrast.test.ts`

**Interfaces:**
- Produces: CSS variables `--bg-paper`, `--shadow-paper`, `--semantic-error-bg`, `--semantic-error-border`, `--semantic-error-text`, `--semantic-warning-bg`, `--semantic-warning-border`, `--semantic-warning-text`, `--semantic-success-bg`, `--semantic-success-border`, `--semantic-success-text`, `--semantic-info-bg`, `--semantic-info-border`, `--semantic-info-text`, `--entity-pill-bg`, `--entity-pill-text`, `--lore-pill-bg`, `--lore-pill-text` across `:root, [data-theme="obsidian"]`, `[data-theme="parchment"]`, and `[data-theme="daylight"]`, plus utility classes `.semantic-error-box`, `.semantic-warning-box`, `.semantic-success-box`, `.semantic-info-box`, `.semantic-error-text`, `.semantic-warning-text`, `.semantic-success-text`, `.semantic-info-text`.

- [ ] **Step 1: Write the failing test in `src/lib/__tests__/ui-theme-contrast.test.ts`**

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('UI Theme Contrast & Typography Guard Tests', () => {
  const rootDir = process.cwd();

  it('1. Defines adaptive semantic color variables for all 3 themes in globals.css', () => {
    const css = fs.readFileSync(path.join(rootDir, 'src/app/globals.css'), 'utf8');
    assert(css.includes('--bg-paper:'), 'Must define --bg-paper');
    assert(css.includes('--semantic-error-text:'), 'Must define --semantic-error-text');
    assert(css.includes('--semantic-warning-text:'), 'Must define --semantic-warning-text');
    assert(css.includes('--semantic-success-text:'), 'Must define --semantic-success-text');
    assert(css.includes('--semantic-info-text:'), 'Must define --semantic-info-text');
    assert(css.includes('--entity-pill-text:'), 'Must define --entity-pill-text');
    assert(css.includes('--lore-pill-text:'), 'Must define --lore-pill-text');
  });

  it('2. Loads Vietnamese Google Fonts (Literata, Plus Jakarta Sans, JetBrains Mono) in layout.tsx', () => {
    const layout = fs.readFileSync(path.join(rootDir, 'src/app/layout.tsx'), 'utf8');
    assert(layout.includes('Literata'), 'Must load Literata font');
    assert(layout.includes('Plus_Jakarta_Sans'), 'Must load Plus Jakarta Sans font');
    assert(layout.includes('JetBrains_Mono'), 'Must load JetBrains Mono font');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL on `Must define --bg-paper` and `Must load Literata font`.

- [ ] **Step 3: Implement adaptive 3-theme CSS tokens in `src/app/globals.css`, `tailwind.config.js`, and Google Fonts in `src/app/layout.tsx`**

Update `src/app/globals.css` with high-contrast semantic variables for all 3 themes:
- In `obsidian` (dark): `--bg-canvas: #0B0D11`, `--bg-panel: #12151C`, `--bg-elevated: #1A1E28`, `--bg-paper: #131720`, `--border-color: #252B38`, `--text-primary: #F1F5F9`, `--text-muted: #94A3B8`, `--accent-color: #10B981`, `--entity-pill-text: #34D399`, `--lore-pill-text: #60A5FA`, `--semantic-error-text: #FCA5A5`, `--semantic-warning-text: #FCD34D`, `--semantic-success-text: #6EE7B7`, `--semantic-info-text: #93C5FD`.
- In `parchment` (sepia): `--bg-canvas: #F3EDE2`, `--bg-panel: #EAE2D3`, `--bg-elevated: #DFD5C3`, `--bg-paper: #FCF9F2`, `--border-color: #CFC3AE`, `--text-primary: #261F1A`, `--text-muted: #5C5248`, `--accent-color: #0F766E`, `--entity-pill-text: #065F46`, `--lore-pill-text: #1E40AF`, `--semantic-error-text: #991B1B`, `--semantic-warning-text: #92400E`, `--semantic-success-text: #065F46`, `--semantic-info-text: #1E3A8A`.
- In `daylight` (light): `--bg-canvas: #F1F5F9`, `--bg-panel: #F8FAFC`, `--bg-elevated: #E2E8F0`, `--bg-paper: #FFFFFF`, `--border-color: #CBD5E1`, `--text-primary: #0F172A`, `--text-muted: #475569`, `--accent-color: #059669`, `--entity-pill-text: #047857`, `--lore-pill-text: #1D4ED8`, `--semantic-error-text: #B91C1C`, `--semantic-warning-text: #B45309`, `--semantic-success-text: #047857`, `--semantic-info-text: #1D4ED8`.
- Style `select option` to use `background-color: var(--bg-elevated); color: var(--text-primary);`.
- Update `tailwind.config.js` to expose `paper: "var(--bg-paper)"` and configure `src/app/layout.tsx` with `next/font/google` (`Plus_Jakarta_Sans`, `Literata`, `JetBrains_Mono` with `subsets: ['latin', 'vietnamese']`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

---

### Task 2: Vùng Soạn thảo Trang giấy Liền mạch (In-Place Editing) & Compact Chapter Header

**Files:**
- Modify: `src/stores/useEditorStore.ts`
- Modify: `src/components/editor/ChapterHeaderProperties.tsx`
- Modify: `src/components/editor/NovelEditor.tsx`
- Modify: `src/lib/__tests__/ui-theme-contrast.test.ts`

**Interfaces:**
- Consumes: CSS classes and variables from Task 1.
- Produces: `firstLineIndent: boolean` and `toggleFirstLineIndent: () => void` in `useEditorStore.ts`; seamless click-to-edit paragraph surface in `NovelEditor.tsx` without any permanent secondary `<textarea>` under paragraphs; compact Notion-style property pills in `ChapterHeaderProperties.tsx`.

- [ ] **Step 1: Add test for In-Place Editor and absence of hardcoded low-contrast classes in `src/lib/__tests__/ui-theme-contrast.test.ts`**

```typescript
  it('3. NovelEditor uses seamless in-place editing and adaptive semantic styles', () => {
    const editorCode = fs.readFileSync(
      path.join(rootDir, 'src/components/editor/NovelEditor.tsx'),
      'utf8'
    );
    assert(
      !editorCode.includes('group-hover:opacity-60'),
      'Must remove permanent hover-revealed secondary raw textarea'
    );
    assert(
      !editorCode.includes('text-red-300') && !editorCode.includes('text-emerald-300') && !editorCode.includes('text-blue-300'),
      'Must not use hardcoded pale dark-only text classes in NovelEditor'
    );
    assert(
      editorCode.includes('editingParagraphIndex'),
      'Must support in-place paragraph editing state'
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL on `Must remove permanent hover-revealed secondary raw textarea`.

- [ ] **Step 3: Implement `firstLineIndent` in `src/stores/useEditorStore.ts`, Compact Pills in `src/components/editor/ChapterHeaderProperties.tsx`, and In-Place Paper Canvas in `src/components/editor/NovelEditor.tsx`**

- In `src/stores/useEditorStore.ts`: add `firstLineIndent: boolean` (default `true`) and `toggleFirstLineIndent: () => void`.
- In `src/components/editor/ChapterHeaderProperties.tsx`: redesign into a sleek Notion/Linear horizontal pill bar (`Trạng thái`, `👁️ POV`, `📅 Mốc thời gian`, `📍 Địa điểm`, `🎯 Tiến trình số từ` with inline progress bar) that can expand/collapse a detail drawer smoothly, using high-contrast semantic colors.
- In `src/components/editor/NovelEditor.tsx`:
  - Wrap the chapter manuscript in an elevated paper sheet (`backgroundColor: 'var(--bg-paper)'`, `boxShadow: 'var(--shadow-paper)'`, `borderColor: 'var(--border-color)'`).
  - Add `editingParagraphIndex: number | null` state. When `editingParagraphIndex === pIdx`, render an auto-resizing `<textarea>` in-place with the exact same `fontClass`, `fontSize: proseFontSize`, `lineHeight: 1.85`, and `textIndent: firstLineIndent ? '1.75em' : '0'`.
  - When `editingParagraphIndex !== pIdx`, render the decorated literary paragraph (`renderDecoratedParagraph`) with `onClick` activating `setEditingParagraphIndex(pIdx)`. Clicking `@Entity` or Linter squiggly calls `e.stopPropagation()` to open the Hover Card / Linter Popover directly.
  - Replace all pale hardcoded classes (`text-blue-300`, `text-red-300`, `text-emerald-300`, `bg-emerald-950/20`) with the adaptive semantic classes (`.semantic-info-box`, `.semantic-error-box`, `.semantic-success-box`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

---

### Task 3: Đồng bộ toàn bộ Workbench, Top Titlebar & Xóa bỏ 100% Chữ Chìm ở Mọi Component

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/workbench/ActivityBar.tsx`
- Modify: `src/components/workbench/Sidebar.tsx`
- Modify: `src/components/workbench/TabBar.tsx`
- Modify: `src/components/workbench/StatusBar.tsx`
- Modify: `src/components/ai-hub/RightDock.tsx`
- Modify: `src/components/lorebook/LoreDatabaseView.tsx`
- Modify: `src/components/lorebook/CharacterSheet.tsx`
- Modify: `src/components/lorebook/RelationshipGraph.tsx`
- Modify: `src/components/modals/RefactorRenameModal.tsx`
- Modify: `src/components/modals/PublishModal.tsx`
- Modify: `.docs/ui-ux-specification.md`
- Modify: `src/lib/__tests__/ui-theme-contrast.test.ts`

**Interfaces:**
- Consumes: Adaptive semantic CSS classes and variables from Task 1, editor store from Task 2.
- Produces: Complete zero-low-contrast UI across all 17 frontend files and updated `.docs/ui-ux-specification.md`.

- [ ] **Step 1: Add codebase-wide low-contrast class scan test to `src/lib/__tests__/ui-theme-contrast.test.ts`**

```typescript
  it('4. Ensures zero hardcoded low-contrast pale text classes exist across all components', () => {
    const forbiddenClasses = [
      'text-red-200',
      'text-red-300',
      'text-amber-200',
      'text-emerald-200',
      'text-emerald-300',
      'text-blue-300',
      'bg-emerald-950/20',
      'bg-red-950/20',
    ];
    const filesToCheck = [
      'src/components/workbench/Sidebar.tsx',
      'src/components/ai-hub/RightDock.tsx',
      'src/components/editor/NovelEditor.tsx',
      'src/components/lorebook/RelationshipGraph.tsx',
      'src/components/modals/RefactorRenameModal.tsx',
    ];
    for (const relPath of filesToCheck) {
      const content = fs.readFileSync(path.join(rootDir, relPath), 'utf8');
      for (const badClass of forbiddenClasses) {
        assert(
          !content.includes(badClass),
          `File ${relPath} must not contain low-contrast class "${badClass}"`
        );
      }
    }
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL on `File src/components/workbench/Sidebar.tsx must not contain low-contrast class "text-red-200"`.

- [ ] **Step 3: Update all Workbench, AI Hub, Lorebook, Modal components and `.docs/ui-ux-specification.md`**

- In `src/app/page.tsx`: Add the unified **Top Workbench Header Bar** (hidden in Zen Mode) featuring Project Brand, active Chapter Breadcrumb, centered Quick Search / Command Palette trigger (`Ctrl+P`), explicit 3-Theme Segmented Switcher (`🌙 Obsidian` | `📜 Parchment` | `☀️ Daylight`), and Left Sidebar / Right AI Dock toggle buttons.
- In `Sidebar.tsx`, `RightDock.tsx`, `RelationshipGraph.tsx`, `RefactorRenameModal.tsx`, `PublishModal.tsx`, `LoreDatabaseView.tsx`, `CharacterSheet.tsx`, `ActivityBar.tsx`, `TabBar.tsx`, `StatusBar.tsx`: replace all low-contrast hardcoded classes (`text-red-200`, `text-amber-200`, `text-emerald-200`, `text-emerald-300`, `text-emerald-400`, `text-red-400`, `text-amber-400`, `text-purple-400`, `text-blue-400`, `bg-emerald-950/20`, `bg-red-950/20`) with theme-adaptive semantic classes (`semantic-error-box`, `semantic-warning-box`, `semantic-success-box`, `semantic-info-box`, `semantic-error-text`, `semantic-warning-text`, `semantic-success-text`, `semantic-info-text`).
- Update `.docs/ui-ux-specification.md` to document the new Editorial Atelier & Precision IDE design system, `--bg-paper` surface, adaptive semantic contrast rules, Top Workbench Header, and In-Place Paragraph Editing.

- [ ] **Step 4: Run tests and production build to verify everything passes**

Run: `npm test && npm run build`
Expected: PASS all unit tests and static export build succeeds with 0 errors.

