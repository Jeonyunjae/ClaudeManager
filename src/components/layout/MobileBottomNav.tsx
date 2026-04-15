'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, Bell, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotificationStore } from '@/stores/notificationStore';

const mobileNavItems = [
  { href: '/m/chat', label: '채팅', icon: MessageSquare },
  { href: '/m/notifications', label: '알림', icon: Bell },
  { href: '/m/status', label: '상태', icon: BarChart3 },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const { unreadCount } = useNotificationStore();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-[var(--primary-50)] bg-[var(--bg-surface)] safe-area-pb">
      {mobileNavItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center gap-0.5 px-4 py-2 transition-colors relative',
              isActive
                ? 'text-[var(--primary-500)]'
                : 'text-[var(--text-tertiary)]'
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
            {item.href === '/m/notifications' && unreadCount > 0 && (
              <span className="absolute top-1 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--status-error)] text-[9px] text-white font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
