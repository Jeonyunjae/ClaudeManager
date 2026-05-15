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

  const { fetchTree, initMain, initialized } = useAgentStore();
  const { fetchParts } = usePartStore();
  const { fetchPending } = useApprovalStore();
  const { fetchNotifications } = useNotificationStore();
  const { fetchHealth } = useSystemStore();

  useEffect(() => {
    if (isAuthenticated) {
      initMain();
      fetchTree();
      fetchParts();
      fetchPending();
      fetchNotifications();
      fetchHealth();
    }
  }, [isAuthenticated, initMain, fetchTree, fetchParts, fetchPending, fetchNotifications, fetchHealth]);

  if (isLoading || !isAuthenticated) {
    return null;
  }

  if (!initialized) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-page, #E8ECEF)',
        gap: 16,
      }}>
        <div style={{
          width: 40, height: 40, border: '3px solid #E5E7EB',
          borderTopColor: '#7C5CFC', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <span style={{ fontSize: 14, color: '#6B7280', fontWeight: 500 }}>Loading...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

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
