'use client';

import React from 'react';
import { useAgentStore } from '@/stores/agentStore';
import { useApprovalStore } from '@/stores/approvalStore';
import { usePartStore } from '@/stores/partStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { cn } from '@/lib/utils';

export function MainOrchestratorCard() {
  const { tree, agents } = useAgentStore();
  const { pendingList } = useApprovalStore();
  const { parts } = usePartStore();
  const { openChat } = useWorkspaceStore();

  const mainAgent = tree.find((a) => a.role === 'main');
  const hasPending = pendingList.length > 0;

  const totalAgents = agents.size;
  const activeParts = parts.filter((p) => p.status === 'active').length;

  const statusColor = hasPending
    ? 'bg-[var(--status-pending)]'
    : mainAgent?.status === 'active'
      ? 'bg-[var(--status-active)]'
      : mainAgent?.status === 'error'
        ? 'bg-[var(--status-error)]'
        : 'bg-[var(--status-idle)]';

  const statusText = hasPending
    ? `승인 대기 ${pendingList.length}건`
    : mainAgent?.statusMessage || (parts.length === 0 ? '대기 중 - 첫 부서를 기다리는 중' : '정상 운영 중');

  return (
    <div
      className={cn(
        'w-full rounded-[var(--radius-card)] bg-[var(--bg-surface)] border shadow-[var(--shadow-card)] p-4 sm:p-5 animate-[card-fade-in_0.3s_ease-out]',
        hasPending
          ? 'border-[var(--status-pending)]'
          : 'border-[var(--primary-200)]',
      )}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-[var(--primary-500)] flex items-center justify-center">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          {/* Status indicator */}
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--bg-surface)]',
              statusColor,
              hasPending && 'animate-[pulse-pending_1.5s_infinite]',
            )}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-[var(--text-body)] font-semibold text-[var(--text-primary)]">
              Main
            </h2>
            <span className="text-[var(--text-caption)] text-[var(--text-secondary)]">
              비서실장
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-1">
            <span className={cn('w-2 h-2 rounded-full flex-shrink-0', statusColor)} />
            <p className="text-[var(--text-small)] text-[var(--text-secondary)] truncate">
              {statusText}
            </p>
          </div>

          {parts.length > 0 && (
            <div className="flex items-center gap-3 mt-2 text-[var(--text-caption)] text-[var(--text-tertiary)]">
              <span>활성 Part: {activeParts}개</span>
              <span className="text-[var(--primary-200)]">|</span>
              <span>총 에이전트: {totalAgents}명</span>
              {hasPending && (
                <>
                  <span className="text-[var(--primary-200)]">|</span>
                  <span className="text-[var(--status-pending-text)] font-medium">
                    승인 대기: {pendingList.length}건
                  </span>
                </>
              )}
            </div>
          )}

          {mainAgent?.statusMessage && parts.length > 0 && (
            <p className="mt-2 text-[var(--text-caption)] text-[var(--text-tertiary)] truncate">
              최근 보고: &quot;{mainAgent.statusMessage}&quot;
            </p>
          )}
        </div>

        {/* Chat button */}
        <button
          onClick={() => openChat()}
          className={cn(
            'flex-shrink-0 px-3 py-1.5 rounded-[var(--radius-md)] text-[var(--text-small)] font-medium transition-colors',
            hasPending
              ? 'bg-[var(--status-pending)] text-white hover:opacity-90'
              : 'bg-[var(--primary-500)] text-white hover:bg-[var(--primary-600)]',
          )}
        >
          {hasPending ? '승인 처리하기' : '대화하기'}
        </button>
      </div>
    </div>
  );
}
