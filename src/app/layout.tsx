import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NovelForge IDE — IDE Desktop Chuyên Biệt Cho Người Viết Lách',
  description:
    'NovelForge IDE kết hợp sự linh hoạt của Notion, không gian làm việc của VS Code, trí tuệ phân tích của IntelliJ IDEA và hệ sinh thái Multi-Agent MCP.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" data-theme="obsidian">
      <body className="antialiased">{children}</body>
    </html>
  );
}
