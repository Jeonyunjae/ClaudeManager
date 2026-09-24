'use client';

import React from 'react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { formatRelativeTime } from '@/lib/mobile-format';
import type { Notification, NotificationType } from '@/types/notification';

/** 유형별 표시 라벨 — DES-009 §NotificationType (완료·오류·경고 + 기존 유형) */
const TYPE_LABELS: Record<NotificationType, string> = {
  info: '완료',
  complete: '완료',
  error: '오류',
  warning: '경고',
  key_expiry_warning: '경고',
  approval: '승인',
  cost: '비용',
  recovery: '복구',
};

const TYPE_BADGE_VARIANT: Record<NotificationType, BadgeProps['variant']> = {
  info: 'complete',
  complete: 'complete',
  error: 'error',
  warning: 'pending',
  key_expiry_warning: 'pending',
  approval: 'active',
  cost: 'default',
  recovery: 'active',
};

function typeLabel(type: string): string {
  return (TYPE_LABELS as Record<string, string>)[type] ?? type;
}

function typeBadgeVariant(type: string): BadgeProps['variant'] {
  return (TYPE_BADGE_VARIANT as Record<string, BadgeProps['variant']>)[type] ?? 'default';
}

type NotificationItemProps = {
  notification: Notification;
  onOpen: (notification: Notification) => void;
};

/** SCR-M03 알림 목록 행 — DES-006 §NotificationItem, EVT-M03-1 */
export function NotificationItem({ notification, onOpen }: NotificationItemProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={`w-full min-h-[44px] text-left px-4 py-3 flex items-start gap-2 hover:bg-[var(--primary-50)] transition-colors ${
        !notification.isRead ? 'bg-[var(--primary-50)]/50' : ''
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
          !notification.isRead ? 'bg-[var(--primary-500)]' : 'bg-transparent'
        }`}
        aria-hidden="true"
      />
      <Badge variant={typeBadgeVariant(notification.type)} className="mt-0.5 shrink-0">
        {typeLabel(notification.type)}
      </Badge>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{notification.title}</p>
        <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{notification.message}</p>
        <p className="text-[10px] text-[var(--text-tertiary)] mt-1">{formatRelativeTime(notification.createdAt)}</p>
      </div>
    </button>
  );
}
