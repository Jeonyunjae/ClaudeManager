'use client';

import React from 'react';
import type { AgentTreeNode } from '@/types/agent';
import { useAgentDetailStore } from '@/stores/agentDetailStore';
import { cn } from '@/lib/utils';

type AgentCardProps = {
  agent: AgentTreeNode;
  belongsTo?: string;
};

function getRoleIcon(role: string) {
  switch (role) {
    case 'part':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
        </svg>
      );
    case 'sub':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
        </svg>
      );
    default:
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
  }
}

const STATUS_BORDER: Record<string, string> = {
  active: 'border-l-[var(--status-active)]',
  pending: 'border-l-[var(--status-pending)]',
  error: 'border-l-[var(--status-error)]',
  idle: 'border-l-[var(--status-idle)]',
  stopped: 'border-l-[var(--status-stopped)]',
};

const STATUS_DOT: Record<string, string> = {
  active: 'bg-[var(--status-active)]',
  pending: 'bg-[var(--status-pending)]',
  error: 'bg-[var(--status-error)]',
  idle: 'bg-[var(--status-idle)]',
  stopped: 'bg-[var(--status-stopped)]',
};

export function AgentCard({ agent, belongsTo }: AgentCardProps) {
  const { openAgent } = useAgentDetailStore();

  const borderClass = STATUS_BORDER[agent.status] || STATUS_BORDER.idle;
  const dotClass = STATUS_DOT[agent.status] || STATUS_DOT.idle;

  const roleLabel =
    agent.role === 'part'
      ? 'Part장'
      : agent.role === 'sub'
        ? 'Sub장'
        : '인스턴스';

  return (
    <button
      onClick={() => openAgent(agent.id)}
      className={cn(
        'w-full text-left rounded-[var(--radius-card)] bg-[var(--bg-surface)] shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-shadow border-l-4 p-3 sm:p-4 animate-[card-fade-in_0.3s_ease-out]',
        borderClass,
      )}
    >
      <div className="flex items-start gap-3">
        {/* Role icon */}
        <div className="w-8 h-8 rounded-full bg-[var(--primary-50)] text-[var(--primary-500)] flex items-center justify-center flex-shrink-0 mt-0.5">
          {getRoleIcon(agent.role)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-body)] font-medium text-[var(--text-primary)] truncate">
              {agent.name}
            </span>
            <span className="text-[10px] text-[var(--text-tertiary)] bg-[var(--primary-50)] px-1.5 py-0.5 rounded-[var(--radius-badge)] flex-shrink-0">
              {roleLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dotClass)} />
            <span className="text-[var(--text-caption)] text-[var(--text-secondary)] truncate">
              {agent.statusMessage || (agent.status === 'active' ? '작업 중' : '대기 중')}
            </span>
          </div>

          {belongsTo && (
            <p className="text-[10px] text-[var(--text-tertiary)] mt-1 truncate">
              소속: {belongsTo}
            </p>
          )}
        </div>

        {/* View button */}
        <span className="text-[var(--text-caption)] text-[var(--text-link)] flex-shrink-0 mt-1">
          보기
        </span>
      </div>
    </button>
  );
}
