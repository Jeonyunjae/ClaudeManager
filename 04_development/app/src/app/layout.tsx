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
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var t = localStorage.getItem('theme') || 'light';
            if (t === 'system') t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', t);
          })();
        `}} />
      </head>
      <body className="min-h-screen bg-[var(--bg-base)]" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", fontSize: '13px', lineHeight: 1.5 }}>
        {children}
      </body>
    </html>
  );
}
