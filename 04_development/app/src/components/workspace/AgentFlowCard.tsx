'use client';

import React from 'react';
import type { AgentTreeNode } from '@/types/agent';
import { useAgentDetailStore } from '@/stores/agentDetailStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { cn } from '@/lib/utils';

const PART_COLORS = [
  'var(--part-purple)',
  'var(--part-amber)',
  'var(--part-mint)',
  'var(--part-blue)',
  'var(--part-coral)',
];

function countDescendants(node: AgentTreeNode): number {
  let count = 0;
  for (const child of node.children) {
    count += 1 + countDescendants(child);
  }
  return count;
}

type AgentFlowCardProps = {
  agent: AgentTreeNode;
  colorIndex?: number;
  isPending?: boolean;
  isNew?: boolean;
  showProgress?: boolean;
  belongsTo?: string;
};

export function AgentFlowCard({ agent, colorIndex = 0, isPending, isNew, showProgress, belongsTo }: AgentFlowCardProps) {
  const { openAgent } = useAgentDetailStore();
  const { newDepartmentId, selectedAgentId, setSelectedAgentId } = useWorkspaceStore();

  const agentCount = countDescendants(agent);
  const isHighlighted = isNew || newDepartmentId === agent.id;
  const isSelected = selectedAgentId === agent.id;
  const isDark = agent.status === 'active';
  const color = PART_COLORS[colorIndex % PART_COLORS.length];

  // Mock progress
  const progress = agent.status === 'active' ? 60 : agent.status === 'idle' ? 0 : 100;

  return (
    <div
      className={cn(
        'rounded-xl shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-all p-3.5 cursor-pointer',
        isDark
          ? 'bg-[var(--card-dark-bg)]'
          : 'bg-[var(--bg-surface)]',
        isHighlighted && 'animate-[card-scale-up_0.4s_cubic-bezier(0.34,1.56,0.64,1)] ring-2 ring-[var(--primary-300)]',
        !isHighlighted && 'animate-[card-fade-in_0.3s_ease-out]',
        isPending && !isDark && 'border-2 border-[var(--status-pending)] bg-[var(--status-pending-bg)]',
        isSelected && !isDark && 'ring-1 ring-[var(--primary-400)]',
        agent.status === 'error' && 'border border-[var(--status-error)]',
      )}
      data-agent-id={agent.id}
      onClick={() => {
        setSelectedAgentId(agent.id);
        openAgent(agent.id);
      }}
    >
      {/* Header: Avatar + Name + Status dot */}
      <div className="flex items-center gap-2.5 mb-1.5">
        {/* Avatar */}
        <div
          className="w-[var(--avatar-md)] h-[var(--avatar-md)] rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold"
          style={{ backgroundColor: color }}
        >
          {agent.name.charAt(0)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cn(
              'text-[13px] font-semibold truncate',
              isDark ? 'text-[var(--card-dark-text)]' : 'text-[var(--text-primary)]',
            )}>
              {agent.name}
            </span>
            {isHighlighted && (
              <span className="text-[9px] font-bold text-[var(--primary-500)] bg-[var(--primary-50)] px-1.5 py-0.5 rounded-full flex-shrink-0">
                NEW
              </span>
            )}
          </div>
          {/* Status line */}
          <p className={cn(
            'text-[11px] truncate mt-0.5',
            isDark ? 'text-[var(--card-dark-secondary)]' : 'text-[var(--text-secondary)]',
          )}>
            {agent.statusMessage || (agent.status === 'active' ? '작업 중...' : agent.status === 'idle' ? '대기 중' : agent.status)}
            {agentCount > 0 && ` · ${agentCount}명`}
          </p>
        </div>

        {/* Status dot */}
        <span className={cn(
          'w-2 h-2 rounded-full flex-shrink-0',
          agent.status === 'active' && 'bg-[var(--status-active)]',
          agent.status === 'idle' && 'bg-[var(--status-idle)]',
          agent.status === 'pending' && 'bg-[var(--status-pending)] animate-[pulse-pending_1.5s_infinite]',
          agent.status === 'error' && 'bg-[var(--status-error)]',
          agent.status === 'stopped' && 'bg-[var(--status-stopped)]',
        )} />
      </div>

      {/* Belongs to (Instance only) */}
      {belongsTo && (
        <p className={cn(
          'text-[9px] truncate mb-1.5',
          isDark ? 'text-[var(--card-dark-secondary)]' : 'text-[var(--text-tertiary)]',
        )}>
          {belongsTo}
        </p>
      )}

      {/* Progress bar (Sub/Instance, only when active) */}
      {showProgress && agent.status === 'active' && (
        <div className="mb-1.5">
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--status-active)] rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className={cn(
            'text-[9px] mt-0.5 block text-right',
            isDark ? 'text-[var(--card-dark-secondary)]' : 'text-[var(--text-tertiary)]',
          )}>
            {progress}%
          </span>
        </div>
      )}

      {/* Action icons — always visible (SugarCRM style) */}
      <div className="flex items-center justify-end gap-1 mt-1">
        <button
          className={cn(
            'p-1 rounded transition-colors',
            isDark
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
            isDark
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
            isDark
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
    </div>
  );
}
