'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAgentStore } from '@/stores/agentStore';
import { usePartStore } from '@/stores/partStore';
import { useApprovalStore } from '@/stores/approvalStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useSystemStore } from '@/stores/systemStore';
import { TopNav } from '@/components/layout/TopNav';
import { AgentDetailPopup } from '@/components/workspace/AgentDetailPopup';
import { BottomBar } from '@/components/layout/BottomBar';
import { Skeleton } from '@/components/ui/skeleton';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  useWebSocket();

  const { fetchTree } = useAgentStore();
  const { fetchParts } = usePartStore();
  const { fetchPending } = useApprovalStore();
  const { fetchNotifications } = useNotificationStore();
  const { fetchHealth } = useSystemStore();

  useEffect(() => {
    if (isAuthenticated) {
      fetchTree();
      fetchParts();
      fetchPending();
      fetchNotifications();
      fetchHealth();
    }
  }, [isAuthenticated, fetchTree, fetchParts, fetchPending, fetchNotifications, fetchHealth]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div style={{ background: 'var(--bg-page, #E8ECEF)', minHeight: '100vh' }}>
      <TopNav />
      <div style={{ height: 'calc(100vh - 56px)', overflowY: 'auto' }}>
        {children}
      </div>
      <BottomBar />
      <AgentDetailPopup />
    </div>
  );
}
