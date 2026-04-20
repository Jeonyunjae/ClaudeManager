'use client';

import React from 'react';
import { useAgentStore } from '@/stores/agentStore';
import { useApprovalStore } from '@/stores/approvalStore';
import { usePartStore } from '@/stores/partStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAgentDetailStore } from '@/stores/agentDetailStore';
import { cn } from '@/lib/utils';

export function MainCard() {
  const { tree, agents } = useAgentStore();
  const { pendingList } = useApprovalStore();
  const { parts } = usePartStore();
  const { openChat } = useWorkspaceStore();
  const { openAgent } = useAgentDetailStore();

  const mainAgent = tree.find((a) => a.role === 'main');
  const hasPending = pendingList.length > 0;
  const totalAgents = agents.size;

  const statusText = hasPending
    ? `승인 대기 ${pendingList.length}건`
    : mainAgent?.statusMessage || (parts.length === 0 ? '대기 중' : '정상 운영 중');

  const isActive = mainAgent?.status === 'active' || hasPending;

  return (
    <div
      className={cn(
        'rounded-xl shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-all p-3.5 cursor-pointer',
        isActive
          ? 'bg-[var(--card-dark-bg)]'
          : 'bg-[var(--bg-surface)]',
      )}
      data-agent-id={mainAgent?.id}
      onClick={() => mainAgent && openAgent(mainAgent.id)}
    >
      {/* Header: Avatar + Name */}
      <div className="flex items-center gap-2.5 mb-1.5">
        <div className="w-[var(--avatar-md)] h-[var(--avatar-md)] rounded-full bg-[var(--primary-500)] flex items-center justify-center flex-shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <span className={cn(
            'text-[13px] font-semibold truncate block',
            isActive ? 'text-[var(--card-dark-text)]' : 'text-[var(--text-primary)]',
          )}>
            Main · 비서실장
          </span>
          <p className={cn(
            'text-[11px] truncate mt-0.5',
            isActive ? 'text-[var(--card-dark-secondary)]' : 'text-[var(--text-secondary)]',
          )}>
            {statusText}
            {totalAgents > 0 && ` · 에이전트 ${totalAgents}명`}
          </p>
        </div>

        {/* Status dot */}
        <span className={cn(
          'w-2 h-2 rounded-full flex-shrink-0',
          hasPending && 'bg-[var(--status-pending)] animate-[pulse-pending_1.5s_infinite]',
          !hasPending && mainAgent?.status === 'active' && 'bg-[var(--status-active)]',
          !hasPending && mainAgent?.status === 'error' && 'bg-[var(--status-error)]',
          !hasPending && mainAgent?.status === 'idle' && 'bg-[var(--status-idle)]',
          !hasPending && !mainAgent && 'bg-[var(--status-idle)]',
        )} />
      </div>

      {/* Pending badge */}
      {hasPending && (
        <div className="text-[10px] font-medium text-[var(--status-pending)] bg-[var(--status-pending)]/10 px-2 py-0.5 rounded-full mb-1.5 text-center">
          결재 요청 {pendingList.length}건 대기
        </div>
      )}

      {/* Action icons — always visible */}
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-1">
          <button
            className={cn(
              'p-1 rounded transition-colors',
              isActive
                ? 'text-[var(--card-dark-icon)] hover:text-[var(--card-dark-secondary)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--primary-50)]',
            )}
            aria-label="완료"
            onClick={(e) => e.stopPropagation()}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
          <button
            className={cn(
              'p-1 rounded transition-colors',
              isActive
                ? 'text-[var(--card-dark-icon)] hover:text-[var(--card-dark-secondary)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--primary-50)]',
            )}
            aria-label="복사"
            onClick={(e) => e.stopPropagation()}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
          <button
            className={cn(
              'p-1 rounded transition-colors',
              isActive
                ? 'text-[var(--card-dark-icon)] hover:text-[var(--card-dark-secondary)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--primary-50)]',
            )}
            aria-label="더보기"
            onClick={(e) => e.stopPropagation()}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
              <circle cx="5" cy="12" r="1" />
            </svg>
          </button>
        </div>

        {/* Chat button — compact */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            openChat();
          }}
          className={cn(
            'text-[10px] font-medium px-2.5 py-1 rounded-full transition-colors',
            hasPending
              ? 'bg-[var(--status-pending)] text-white hover:opacity-90'
              : isActive
                ? 'bg-white/10 text-[var(--card-dark-text)] hover:bg-white/20'
                : 'bg-[var(--primary-50)] text-[var(--primary-600)] hover:bg-[var(--primary-100)]',
          )}
        >
          {hasPending ? '승인 처리' : '대화하기'}
        </button>
      </div>
    </div>
  );
}
