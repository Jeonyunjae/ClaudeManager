'use client';

import React, { useState } from 'react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { cn } from '@/lib/utils';

type SidebarIconProps = {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

function SidebarIcon({ icon, label, isActive, disabled, onClick }: SidebarIconProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={cn(
          'w-full flex items-center justify-center h-10 transition-colors relative',
          isActive && 'text-[var(--primary-500)]',
          !isActive && !disabled && 'text-[var(--text-secondary)] hover:bg-[var(--primary-50)] hover:text-[var(--primary-500)]',
          disabled && 'text-[var(--text-tertiary)] opacity-50 cursor-not-allowed',
        )}
        aria-label={label}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[var(--primary-500)] rounded-r-full" />
        )}
        {icon}
      </button>
      {showTooltip && !disabled && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-[var(--text-primary)] text-[var(--text-inverse)] text-[var(--text-caption)] rounded-[var(--radius-sm)] whitespace-nowrap z-50">
          {label}
        </div>
      )}
    </div>
  );
}

export function IconSidebar() {
  const { sidebarCollapsed, isChatOpen, toggleChat } = useWorkspaceStore();
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  if (sidebarCollapsed) return null;

  return (
    <div className="hidden lg:flex flex-col w-[var(--sidebar-width)] bg-[var(--sidebar-bg)] border-r border-[var(--column-border)] flex-shrink-0">
      <div className="flex-1 flex flex-col py-2 gap-1">
        <SidebarIcon
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          }
          label="Skill"
          onClick={() => {}}
        />
        <SidebarIcon
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
          }
          label="Filter"
          isActive={activeFilter !== null}
          onClick={() => setActiveFilter(activeFilter ? null : 'status')}
        />
        <SidebarIcon
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          }
          label={isChatOpen ? 'Hide Chat' : 'Show Chat'}
          isActive={isChatOpen}
          onClick={toggleChat}
        />
        <SidebarIcon
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          }
          label="Search"
          onClick={() => {}}
        />
      </div>
      <div className="py-2 border-t border-[var(--column-border)]">
        <SidebarIcon
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          }
          label="Settings"
          onClick={() => {}}
        />
      </div>
    </div>
  );
}
