'use client';

import React, { useEffect } from 'react';
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
  const { isAuthenticated } = useAuth();
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
