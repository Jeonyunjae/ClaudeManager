'use client';

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useMobileRealtime } from '@/hooks/useMobileRealtime';
import { usePreventZoom } from '@/hooks/usePreventZoom';
import { useApprovalStore } from '@/stores/approvalStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useInboxStore } from '@/stores/inboxStore';
import { useAgentStore } from '@/stores/agentStore';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';

/** SCR-M02(대화)에서는 하단 탭을 숨긴다 — 입력 공간 확보 + 키보드와 겹침 방지 (DES-006) */
function isConversationScreen(pathname: string): boolean {
  return /^\/m\/chat\/[^/]+$/.test(pathname);
}

/** 공통 MobileShell (`/m` layout) — DES-006 §공통. 100dvh + safe-area, 진입 시 인박스·트리 조회 + WS 연결 */
export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // 공통 MobileShell 인증 가드 (EVT-SH-3): 미인증이면 next=현재 경로로 로그인 화면으로.
  // useAuth 자체의 기본 동작(`/login`)은 바꾸지 않고, 여기서만 redirectTo를 넘긴다.
  const { isAuthenticated } = useAuth(`/login?next=${encodeURIComponent(pathname)}`);
  useWebSocket();
  useMobileRealtime();
  usePreventZoom(); // BUG-028: iOS Safari 핀치 확대 차단 — 모바일 셸 안에서만 적용

  const { fetchPending } = useApprovalStore();
  const { fetchNotifications } = useNotificationStore();
  const { fetchInbox } = useInboxStore();
  const { fetchTree } = useAgentStore();

  useEffect(() => {
    if (isAuthenticated) {
      fetchPending();
      fetchNotifications();
      fetchInbox();
      fetchTree();
    }
  }, [isAuthenticated, fetchPending, fetchNotifications, fetchInbox, fetchTree]);

  if (!isAuthenticated) return null;

  const showBottomNav = !isConversationScreen(pathname);

  return (
    <div className="flex flex-col" style={{ height: '100dvh' }}>
      <main className={`flex-1 flex flex-col overflow-hidden ${showBottomNav ? 'pb-16' : ''}`}>
        {children}
      </main>
      {showBottomNav && <MobileBottomNav />}
    </div>
  );
}
