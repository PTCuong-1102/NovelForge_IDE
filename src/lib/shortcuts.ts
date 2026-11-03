export interface ShortcutDefinition {
  id: string;
  keysWinLinux: string;
  keysMac: string;
  description: string;
  category: 'Navigation' | 'Editor' | 'Refactor & Intelligence' | 'AI & VCS';
}

export const KEYBOARD_SHORTCUTS: ShortcutDefinition[] = [
  {
    id: 'quick_open',
    keysWinLinux: 'Ctrl + P',
    keysMac: 'Cmd + P',
    description: 'Mở nhanh bất kỳ Chương truyện hoặc Hồ sơ Nhân vật nào',
    category: 'Navigation',
  },
  {
    id: 'command_palette',
    keysWinLinux: 'Ctrl + Shift + P',
    keysMac: 'Cmd + Shift + P',
    description: 'Mở Command Palette (Chạy mọi lệnh của IDE)',
    category: 'Navigation',
  },
  {
    id: 'inline_ai',
    keysWinLinux: 'Ctrl + K',
    keysMac: 'Cmd + K',
    description: 'Gọi nhanh hộp lệnh AI Inline ngay tại vị trí con trỏ',
    category: 'AI & VCS',
  },
  {
    id: 'refactor_rename',
    keysWinLinux: 'Shift + F6',
    keysMac: 'Shift + F6',
    description: 'Refactor Rename: Đổi tên Nhân vật/Địa danh toàn dự án',
    category: 'Refactor & Intelligence',
  },
  {
    id: 'find_usages',
    keysWinLinux: 'Alt + F7',
    keysMac: 'Opt + F7',
    description: 'Find Usages: Xem toàn bộ các chương nhân vật này xuất hiện',
    category: 'Refactor & Intelligence',
  },
  {
    id: 'quick_fix',
    keysWinLinux: 'Alt + Enter',
    keysMac: 'Opt + Enter',
    description: 'Hiển thị gợi ý sửa lỗi nhanh (Quick Fix) cho cảnh báo Linter',
    category: 'Refactor & Intelligence',
  },
  {
    id: 'split_editor',
    keysWinLinux: 'Ctrl + \\',
    keysMac: 'Cmd + \\',
    description: 'Chia đôi màn hình (Mở song song Bản thảo & Lorebook)',
    category: 'Editor',
  },
  {
    id: 'save_snapshot',
    keysWinLinux: 'Ctrl + S',
    keysMac: 'Cmd + S',
    description: 'Lưu tức thì + Tạo nhanh 1 điểm nhớ (Git Snapshot)',
    category: 'AI & VCS',
  },
  {
    id: 'zen_mode',
    keysWinLinux: 'Ctrl + Shift + Z',
    keysMac: 'Cmd + Shift + Z',
    description: 'Bật/Tắt chế độ Zen Mode (Tập trung viết lách tối đa)',
    category: 'Editor',
  },
];
