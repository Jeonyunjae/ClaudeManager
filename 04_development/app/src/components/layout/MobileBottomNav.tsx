'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, Bell, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotificationStore } from '@/stores/notificationStore';
import { useInboxStore } from '@/stores/inboxStore';

const mobileNavItems = [
  { href: '/m/chat', label: '대화', icon: MessageSquare },
  { href: '/m/notifications', label: '알림', icon: Bell },
  { href: '/m/status', label: '상태', icon: BarChart3 },
];

/** 탭 배지 숫자 — DES-006 접근성: "대화, 대기 N건" 형식으로 읽힌다 */
function badgeLabel(label: string, count: number): string {
  if (label === '대화') return `${label}, 대기 ${count}건`;
  if (label === '알림') return `${label}, 안 읽은 알림 ${count}건`;
  return label;
}

/** MobileBottomNav — 대화·알림·상태 3탭 (DES-004, DES-006). safe-area 하단 여백 포함 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const { unreadCount } = useNotificationStore();
  const { count: inboxCount } = useInboxStore();

  const badgeByHref: Record<string, number> = {
    '/m/chat': inboxCount,
    '/m/notifications': unreadCount,
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-[var(--primary-50)] bg-[var(--bg-surface)] safe-area-pb">
      {mobileNavItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        const Icon = item.icon;
        const count = badgeByHref[item.href] ?? 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={badgeLabel(item.label, count)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] px-4 py-2 transition-colors relative',
              isActive
                ? 'text-[var(--primary-500)]'
                : 'text-[var(--text-tertiary)]'
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
            {count > 0 && (
              <span className="absolute top-1 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--status-error)] text-[9px] text-white font-bold">
                {count > 9 ? '9+' : count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
