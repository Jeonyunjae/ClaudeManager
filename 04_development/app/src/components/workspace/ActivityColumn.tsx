'use client';

import React from 'react';
import { Activity } from 'lucide-react';
import { ActivityItem, type ActivityItemData } from './ActivityItem';
import { useNotificationStore } from '@/stores/notificationStore';
import { useApprovalStore } from '@/stores/approvalStore';

export function ActivityColumn() {
  const { notifications } = useNotificationStore();
  const { pendingList } = useApprovalStore();

  // Convert notifications and approvals into activity items
  const activityItems: ActivityItemData[] = [
    ...pendingList.map((a) => ({
      id: `approval-${a.id}`,
      type: 'approval' as const,
      title: `Approval: ${a.title}`,
      description: a.content,
      timestamp: a.createdAt,
    })),
    ...notifications.map((n) => ({
      id: `notif-${n.id}`,
      type: (n.type === 'error' ? 'error' : n.type === 'complete' ? 'completion' : 'system') as ActivityItemData['type'],
      title: n.title,
      description: n.message,
      timestamp: n.createdAt,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--primary-50)]">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[var(--primary-500)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Activity</h3>
          {pendingList.length > 0 && (
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--status-pending-bg)] text-[var(--status-pending-text)] text-[10px] font-bold">
              {pendingList.length}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {activityItems.length === 0 ? (
          <div className="text-center py-8 text-sm text-[var(--text-tertiary)]">
            No recent activity.
          </div>
        ) : (
          activityItems.map((item) => (
            <ActivityItem key={item.id} item={item} />
          ))
        )}
      </div>
    </div>
  );
}
