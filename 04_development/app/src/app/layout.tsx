import type { Metadata, Viewport } from 'next';
import './globals.css';

// PWA 설치(FR-003) — manifest·아이콘·iOS 홈 화면 메타 태그. 데스크톱 표시에는 영향 없음.
export const metadata: Metadata = {
  title: 'ClaudeManager',
  description: '나와 AI 동료들이 함께 일하는 메타버스 워크스페이스',
  manifest: '/manifest.json',
  icons: {
    apple: '/icons/apple-touch-icon-180.png',
  },
  appleWebApp: {
    capable: true,
    title: 'ClaudeManager',
    statusBarStyle: 'default',
  },
};

// iOS Safe Area(`viewport-fit=cover`) + 테마색 — SCR-M01~M04 safe-area 대응 (DES-006 §공통)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#6366f1',
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
