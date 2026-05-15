'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useNotificationStore } from '@/stores/notificationStore';
import { useApprovalStore } from '@/stores/approvalStore';
import { useAuthStore } from '@/stores/authStore';
import { formatRelativeTime } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/resources', label: 'Resources' },
  { href: '/settings', label: 'Settings' },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { notifications, unreadCount, markRead, markAllRead } = useNotificationStore();
  const { pendingList } = useApprovalStore();
  const { logout } = useAuthStore();
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', height: 56,
      background: 'var(--bg-nav, rgba(232,236,239,0.92))',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-light, #E5E7EB)',
    }}>
      {/* Logo */}
      <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', fontWeight: 700, fontSize: 16, color: 'var(--text-primary, #10141A)' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-dark-card, #10141A)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
          YJ
        </div>
        YJ Manager
      </Link>

      {/* Nav Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: '6px 20px', borderRadius: 20,
                fontSize: 14, fontWeight: isActive ? 600 : 500,
                color: isActive ? 'white' : 'var(--text-secondary, #6B7280)',
                cursor: 'pointer', transition: 'all 0.15s',
                border: 'none', background: isActive ? 'var(--text-primary, #10141A)' : 'transparent',
                textDecoration: 'none', letterSpacing: '-0.01em',
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Right section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Approval badge */}
        {pendingList.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 9999, background: 'var(--status-pending-bg, #FFF8EB)', color: 'var(--status-pending-text, #D48806)', fontSize: 12, fontWeight: 500 }}>
            <span>{pendingList.length}</span>
            <span>pending</span>
          </div>
        )}

        {/* Notification bell + dropdown */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: showNotifications ? 'rgba(0,0,0,0.06)' : 'transparent', color: 'var(--text-secondary, #6B7280)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span style={{ position: 'absolute', top: -2, right: -2, display: 'flex', width: 16, height: 16, alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'var(--status-error, #EF4444)', fontSize: 9, color: 'white', fontWeight: 700 }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div style={{
              position: 'absolute', top: 44, right: 0, width: 340,
              background: 'var(--bg-card, #FFFFFF)', borderRadius: 12,
              boxShadow: '0 4px 24px rgba(0,0,0,0.14)',
              border: '1px solid var(--border-light, #E5E7EB)',
              overflow: 'hidden', zIndex: 200,
              maxHeight: 420, display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-light, #E5E7EB)' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #10141A)' }}>Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={() => { markAllRead(); setShowNotifications(false); }}
                    style={{ fontSize: 11, fontWeight: 500, color: 'var(--accent-purple, #7C5CFC)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {notifications.filter(n => !n.isRead).length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary, #9CA3AF)' }}>
                    No unread notifications
                  </div>
                ) : (
                  notifications.filter(n => !n.isRead).slice(0, 20).map((notif) => {
                    const typeColor: Record<string, string> = {
                      error: '#EF4444', approval: '#F59E0B', complete: '#10B981',
                      cost: '#F59E0B', recovery: '#3B82F6', info: '#3B82F6',
                    };
                    return (
                      <div
                        key={notif.id}
                        onClick={() => {
                          markRead([notif.id]);
                          if (notif.targetUrl) {
                            setShowNotifications(false);
                            router.push(notif.targetUrl);
                          }
                        }}
                        style={{
                          padding: '10px 16px', cursor: 'pointer',
                          borderBottom: '1px solid var(--border-light, #E5E7EB)',
                          background: notif.isRead ? 'transparent' : 'rgba(124,92,252,0.04)',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.03)')}
                        onMouseLeave={e => (e.currentTarget.style.background = notif.isRead ? 'transparent' : 'rgba(124,92,252,0.04)')}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <span style={{
                            display: 'inline-block', fontSize: 9, fontWeight: 600,
                            padding: '2px 6px', borderRadius: 4, flexShrink: 0, marginTop: 2,
                            background: `${typeColor[notif.type] || '#3B82F6'}18`,
                            color: typeColor[notif.type] || '#3B82F6',
                          }}>
                            {notif.type}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #10141A)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {notif.title}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary, #6B7280)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                              {notif.message}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary, #9CA3AF)', marginTop: 2 }}>
                              {formatRelativeTime(notif.createdAt)}
                            </div>
                          </div>
                          {!notif.isRead && (
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-purple, #7C5CFC)', flexShrink: 0, marginTop: 6 }} />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile avatar + dropdown */}
        <div ref={profileRef} style={{ position: 'relative' }}>
          <div
            onClick={() => setShowProfile(!showProfile)}
            style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, background: 'var(--border-light, #E5E7EB)', color: 'var(--text-secondary, #6B7280)', cursor: 'pointer' }}
          >
            YJ
          </div>
          {showProfile && (
            <div style={{
              position: 'absolute', top: 40, right: 0, width: 200,
              background: 'var(--bg-card)', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
              border: '1px solid var(--border-light, #E5E7EB)', overflow: 'hidden', zIndex: 200,
            }}>
              <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--bg-content-card, #F3F4F6)' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--border-light, #E5E7EB)', color: 'var(--text-secondary, #6B7280)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, margin: '0 auto 8px' }}>
                  YJ
                </div>
                <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Admin</div>
                <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary, #9CA3AF)', marginTop: 2 }}>YJ Manager</div>
              </div>
              <button
                onClick={handleLogout}
                style={{
                  width: '100%', padding: '10px 16px', border: 'none',
                  background: 'transparent', fontSize: 13, color: 'var(--text-secondary, #6B7280)',
                  cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface, #F9FAFB)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
