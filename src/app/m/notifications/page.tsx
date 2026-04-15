'use client';

import React, { useEffect } from 'react';
import { useNotificationStore } from '@/stores/notificationStore';
import { Badge } from '@/components/ui/badge';
import { formatRelativeTime } from '@/lib/utils';

const typeVariant: Record<string, 'active' | 'pending' | 'error' | 'complete'> = {
  approval: 'pending',
  error: 'error',
  complete: 'complete',
  cost: 'pending',
  recovery: 'active',
  info: 'active',
};

export default function MobileNotificationsPage() {
  const { notifications, fetchNotifications, markRead } = useNotificationStore();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleNotificationClick = (id: number) => {
    markRead([id]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="px-4 py-3 border-b border-[var(--primary-50)] bg-[var(--bg-surface)]">
        <h1 className="text-lg font-semibold">알림</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-[var(--text-tertiary)]">
            알림이 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-[var(--primary-50)]">
            {notifications.map((notif) => (
              <button
                key={notif.id}
                onClick={() => handleNotificationClick(notif.id)}
                className={`w-full text-left px-4 py-3 hover:bg-[var(--primary-50)] transition-colors ${
                  !notif.isRead ? 'bg-[var(--primary-50)]/50' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  <Badge variant={typeVariant[notif.type] || 'active'} className="mt-0.5 shrink-0">
                    {notif.type}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">{notif.title}</p>
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{notif.message}</p>
                    <p className="text-[10px] text-[var(--text-tertiary)] mt-1">{formatRelativeTime(notif.createdAt)}</p>
                  </div>
                  {!notif.isRead && (
                    <span className="w-2 h-2 rounded-full bg-[var(--primary-500)] mt-1.5 shrink-0" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
