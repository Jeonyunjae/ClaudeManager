'use client';

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useApprovalStore } from '@/stores/approvalStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';

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

  const { fetchPending } = useApprovalStore();
  const { fetchNotifications } = useNotificationStore();

  useEffect(() => {
    if (isAuthenticated) {
      fetchPending();
      fetchNotifications();
    }
  }, [isAuthenticated, fetchPending, fetchNotifications]);

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen flex flex-col pb-16">
      <main className="flex-1 flex flex-col">
        {children}
      </main>
      <MobileBottomNav />
    </div>
  );
}
