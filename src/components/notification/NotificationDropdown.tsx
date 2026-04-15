'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useNotificationStore } from '@/stores/notificationStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/lib/utils';

const typeVariant: Record<string, 'active' | 'pending' | 'error' | 'complete'> = {
  approval: 'pending',
  error: 'error',
  complete: 'complete',
  cost: 'pending',
  recovery: 'active',
  info: 'active',
};

export function NotificationDropdown() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotificationStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-[var(--radius-md)] hover:bg-[var(--primary-50)] transition-colors"
      >
        <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[var(--status-error)] text-white text-[10px] flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[var(--bg-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] border border-[var(--primary-100)] z-50 max-h-[400px] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--primary-50)]">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Button size="sm" variant="ghost" onClick={() => markAllRead()}>
                Mark all read
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-center text-sm text-[var(--text-tertiary)]">No notifications</p>
            ) : (
              notifications.slice(0, 20).map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => {
                    if (!notif.isRead) markRead([notif.id]);
                  }}
                  className={`w-full text-left px-4 py-2.5 border-b border-[var(--primary-50)] hover:bg-[var(--primary-50)] transition-colors ${
                    !notif.isRead ? 'bg-[var(--primary-50)]/30' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <Badge variant={typeVariant[notif.type] || 'active'} className="mt-0.5 shrink-0 text-[10px]">
                      {notif.type}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[var(--text-primary)] truncate">{notif.title}</p>
                      <p className="text-[10px] text-[var(--text-secondary)] line-clamp-1">{notif.message}</p>
                      <p className="text-[9px] text-[var(--text-tertiary)] mt-0.5">{formatRelativeTime(notif.createdAt)}</p>
                    </div>
                    {!notif.isRead && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary-500)] mt-1.5 shrink-0" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
