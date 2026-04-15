import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ClaudeManager',
  description: '나와 AI 동료들이 함께 일하는 메타버스 워크스페이스',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-[var(--bg-base)]">
        {children}
      </body>
    </html>
  );
}
