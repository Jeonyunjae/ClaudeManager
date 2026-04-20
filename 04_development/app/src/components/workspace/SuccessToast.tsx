'use client';

import React, { useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAgentStore } from '@/stores/agentStore';

export function SuccessToast() {
  const { newDepartmentId, setNewDepartmentId, openChat } = useWorkspaceStore();
  const { getAgent } = useAgentStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (newDepartmentId) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(() => setNewDepartmentId(null), 300);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [newDepartmentId, setNewDepartmentId]);

  if (!newDepartmentId) return null;

  const agent = getAgent(newDepartmentId);
  const name = agent?.name || '새 부서';

  return (
    <div
      className={`fixed top-20 right-4 z-50 max-w-sm bg-[var(--bg-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-xl)] border border-[var(--status-complete)] p-4 flex items-start gap-3 ${
        visible ? 'animate-[toast-in_0.3s_ease-out]' : 'animate-[toast-out_0.3s_ease-out_forwards]'
      }`}
    >
      {/* Check icon */}
      <div className="w-8 h-8 rounded-full bg-[var(--status-complete-bg)] flex items-center justify-center flex-shrink-0">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--status-complete)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[var(--text-body)] font-medium text-[var(--text-primary)]">
          {name}가 생성되었습니다!
        </p>
        <button
          onClick={() => openChat()}
          className="text-[var(--text-caption)] text-[var(--text-link)] hover:underline mt-1"
        >
          대화하기
        </button>
      </div>

      <button
        onClick={() => {
          setVisible(false);
          setTimeout(() => setNewDepartmentId(null), 300);
        }}
        className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] flex-shrink-0"
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
