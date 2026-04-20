'use client';

import React from 'react';
import { useApprovalStore } from '@/stores/approvalStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export function ApprovalBanner() {
  const { pendingList } = useApprovalStore();
  const { showApprovalBanner, setShowApprovalBanner, openChat } = useWorkspaceStore();

  if (pendingList.length === 0 || !showApprovalBanner) return null;

  return (
    <div className="w-full bg-[var(--status-pending-bg)] border-l-4 border-l-[var(--status-pending)] px-4 py-2.5 flex items-center gap-3 animate-[slide-down_0.3s_ease-out]">
      {/* Warning icon */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--status-pending-text)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="flex-shrink-0"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>

      <p className="flex-1 text-[var(--text-small)] text-[var(--status-pending-text)] font-medium">
        승인 대기 {pendingList.length}건이 있습니다.
      </p>

      <button
        onClick={() => openChat()}
        className="px-3 py-1 rounded-[var(--radius-sm)] bg-[var(--status-pending)] text-white text-[var(--text-caption)] font-medium hover:opacity-90 transition-opacity flex-shrink-0"
      >
        지금 확인
      </button>

      <button
        onClick={() => setShowApprovalBanner(false)}
        className="p-1 text-[var(--status-pending-text)] hover:opacity-70 flex-shrink-0"
        aria-label="닫기"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
