'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useNotificationStore } from '@/stores/notificationStore';
import { useApprovalStore } from '@/stores/approvalStore';
import { useAuthStore } from '@/stores/authStore';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/resources', label: 'Resources' },
  { href: '/settings', label: 'Settings' },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { unreadCount } = useNotificationStore();
  const { pendingList } = useApprovalStore();
  const { logout } = useAuthStore();
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false);
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

        {/* Notification bell */}
        <button style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--text-secondary, #6B7280)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
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
