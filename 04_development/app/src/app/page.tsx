'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { resolveView, normalizeViewMode, VIEW_MODE_STORAGE_KEY } from '@/hooks/useViewMode';
import { BREAKPOINTS } from '@/lib/constants';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.replace('/login');
      return;
    }

    // FR-001: 로그인 상태에서 폭<768이면 /m/chat, 아니면 기존 /dashboard.
    // 마운트 시점에 한 번만 판정하므로 매체 쿼리를 직접 읽는다(훅의 초기값 지연 회피).
    const mode = normalizeViewMode(sessionStorage.getItem(VIEW_MODE_STORAGE_KEY));
    const isMobile = window.matchMedia(`(max-width: ${BREAKPOINTS.MOBILE - 1}px)`).matches;
    const shouldUseMobile = resolveView({ isMobile, mode });

    router.replace(shouldUseMobile ? '/m/chat' : '/dashboard');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-[var(--text-tertiary)]">Loading...</div>
    </div>
  );
}
