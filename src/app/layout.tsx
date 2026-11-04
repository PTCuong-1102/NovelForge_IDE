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
      <head>
        {/* Progressive Vietnamese Typography (Literata, Plus Jakarta Sans, JetBrains Mono) - Works online & degrades gracefully offline */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Literata:ital,opsz,wght@0,7..72,400..700;1,7..72,400..700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased font-sans">{children}</body>
    </html>
  );
}
