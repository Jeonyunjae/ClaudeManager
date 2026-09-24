'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useNotificationStore } from '@/stores/notificationStore';
import { NotificationItem } from '@/components/mobile/NotificationItem';
import { Skeleton } from '@/components/ui/skeleton';
import type { Notification } from '@/types/notification';

/** SCR-M03 알림 `/m/notifications` — DES-006, FR-009·FR-013 (목록 부분. 푸시 카드는 다음 배치) */
export default function MobileNotificationsPage() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    isLoading,
    loadingMore,
    error,
    hasMore,
    fetchNotifications,
    loadMore,
    markRead,
    markAllRead,
  } = useNotificationStore();

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // EVT-M03-1: 행 탭 -> targetUrl로 이동 + 읽음 처리 (이동은 하고, 읽음 실패는 무시한다)
  function handleOpen(notification: Notification): void {
    if (notification.targetUrl) {
      router.push(notification.targetUrl);
    }
    markRead([notification.id]).catch(() => {});
  }

  // EVT-M03-2: [모두 읽음]
  function handleMarkAllRead(): void {
    markAllRead().catch(() => {});
  }

  // EVT-M03-7: 목록 끝 스크롤 -> 다음 30건
  function handleScroll(): void {
    const el = containerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom && hasMore && !loadingMore) {
      loadMore();
    }
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--primary-50)] bg-[var(--bg-surface)]">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">알림</h1>
        <button
          type="button"
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0}
          className="min-h-[44px] px-3 text-sm font-medium text-[var(--primary-600)] disabled:text-[var(--text-tertiary)] disabled:cursor-not-allowed"
        >
          모두 읽음
        </button>
      </header>

      {/* 푸시 카드 자리 — 다음 배치에서 PushCard(usePushSubscription)를 채운다 */}

      <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-4 space-y-2" data-testid="notifications-loading">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {!isLoading && error && (
          <div className="flex flex-col items-center justify-center gap-2 h-full text-sm text-[var(--status-error-text)]">
            <span>불러오지 못했습니다</span>
            <button
              type="button"
              onClick={() => fetchNotifications()}
              className="text-[var(--primary-500)] font-medium underline-offset-2 hover:underline"
            >
              다시 시도
            </button>
          </div>
        )}

        {!isLoading && !error && notifications.length === 0 && (
          <div className="flex items-center justify-center h-full text-sm text-[var(--text-tertiary)]">
            알림이 없습니다
          </div>
        )}

        {!isLoading && !error && notifications.length > 0 && (
          <div className="divide-y divide-[var(--primary-50)]">
            {notifications.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} onOpen={handleOpen} />
            ))}
          </div>
        )}

        {loadingMore && (
          <p className="text-center text-xs text-[var(--text-tertiary)] py-3">불러오는 중…</p>
        )}
      </div>
    </div>
  );
}
