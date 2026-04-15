'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Monitor, LayoutDashboard, Settings, FolderOpen, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotificationStore } from '@/stores/notificationStore';
import { useApprovalStore } from '@/stores/approvalStore';

const navItems = [
  { href: '/workspace', label: '워크스페이스', icon: Monitor },
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  { href: '/settings', label: '설정', icon: Settings },
  { href: '/resources', label: '리소스 관리', icon: FolderOpen },
];

export function TopNav() {
  const pathname = usePathname();
  const { unreadCount } = useNotificationStore();
  const { pendingList } = useApprovalStore();

  return (
    <nav className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[var(--primary-50)] bg-[var(--bg-surface)] px-[var(--space-6)]">
      {/* Logo */}
      <Link href="/workspace" className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-[var(--radius-md)] bg-[var(--primary-500)] flex items-center justify-center">
          <span className="text-white font-bold text-sm">CM</span>
        </div>
        <span className="font-semibold text-[var(--text-primary)] hidden md:block">ClaudeManager</span>
      </Link>

      {/* Nav Tabs */}
      <div className="flex items-center gap-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[var(--primary-50)] text-[var(--primary-500)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--primary-50)] hover:text-[var(--primary-500)]'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden lg:block">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* Approval badge */}
        {pendingList.length > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-[var(--radius-full)] bg-[var(--status-pending-bg)] text-[var(--status-pending-text)] text-xs font-medium animate-pulse">
            <span>{pendingList.length}</span>
            <span className="hidden sm:inline">승인 대기</span>
          </div>
        )}

        {/* Notification bell */}
        <button className="relative p-2 rounded-[var(--radius-md)] text-[var(--text-secondary)] hover:bg-[var(--primary-50)] transition-colors">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--status-error)] text-[9px] text-white font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    </nav>
  );
}
