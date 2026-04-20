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

type DepartmentCardProps = {
  partAgent: AgentTreeNode;
  partIndex: number;
  isNew?: boolean;
};

function getStatusBadge(status: string) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: 'var(--status-active-bg)', text: 'var(--status-active-text)', label: '활성' },
    idle: { bg: 'var(--status-idle-bg)', text: 'var(--status-idle-text)', label: '대기' },
    pending: { bg: 'var(--status-pending-bg)', text: 'var(--status-pending-text)', label: '승인 대기' },
    error: { bg: 'var(--status-error-bg)', text: 'var(--status-error-text)', label: '오류' },
    stopped: { bg: 'var(--status-stopped-bg)', text: 'var(--status-stopped-text)', label: '정지' },
  };
  return map[status] || map.idle;
}

function countDescendants(node: AgentTreeNode): number {
  let count = 0;
  for (const child of node.children) {
    count += 1 + countDescendants(child);
  }
  return count;
}

export function DepartmentCard({ partAgent, partIndex, isNew }: DepartmentCardProps) {
  const { openAgent } = useAgentDetailStore();
  const { newDepartmentId } = useWorkspaceStore();
  const color = PART_COLORS[partIndex % PART_COLORS.length];
  const badge = getStatusBadge(partAgent.status);
  const agentCount = countDescendants(partAgent) + 1;
  const subTeams = partAgent.children.filter((c) => c.role === 'sub');
  const isHighlighted = isNew || newDepartmentId === partAgent.id;

  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] bg-[var(--bg-surface)] shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-shadow overflow-hidden',
        isHighlighted
          ? 'animate-[card-scale-up_0.4s_cubic-bezier(0.34,1.56,0.64,1)] ring-2 ring-[var(--primary-300)]'
          : 'animate-[card-fade-in_0.3s_ease-out]',
        partAgent.status === 'pending' && 'border-l-4 border-l-[var(--status-pending)]',
      )}
    >
      {/* Part color bar */}
      <div className="h-[5px] w-full" style={{ backgroundColor: color }} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: color + '22' }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8" />
                <path d="M12 17v4" />
              </svg>
            </div>
            <h3 className="text-[var(--text-body)] font-semibold text-[var(--text-primary)] truncate">
              {partAgent.name}
            </h3>
            {isHighlighted && (
              <span className="text-[10px] font-bold text-[var(--primary-500)] bg-[var(--primary-50)] px-1.5 py-0.5 rounded-[var(--radius-badge)]">
                NEW
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-[var(--radius-badge)]"
              style={{
                backgroundColor: badge.bg,
                color: badge.text,
              }}
            >
              {badge.label}
            </span>
            <span className="text-[var(--text-caption)] text-[var(--text-tertiary)]">
              {agentCount}명
            </span>
          </div>
        </div>

        {/* Sub teams */}
        {subTeams.length > 0 ? (
          <div className="space-y-3">
            {subTeams.map((sub) => (
              <SubTeamItem key={sub.id} sub={sub} />
            ))}
          </div>
        ) : (
          <p className="text-[var(--text-caption)] text-[var(--text-tertiary)] py-3 text-center">
            첫 프로젝트를 시작해보세요
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-[var(--primary-50)]">
          <button
            onClick={() => openAgent(partAgent.id)}
            className="text-[var(--text-caption)] text-[var(--text-link)] hover:underline font-medium"
          >
            상세 보기
          </button>
        </div>
      </div>
    </div>
  );
}

function SubTeamItem({ sub }: { sub: AgentTreeNode }) {
  const instanceCount = sub.children.length;
  const statusDot =
    sub.status === 'active'
      ? 'bg-[var(--status-active)]'
      : sub.status === 'pending'
        ? 'bg-[var(--status-pending)]'
        : sub.status === 'error'
          ? 'bg-[var(--status-error)]'
          : 'bg-[var(--status-idle)]';

  // Mock progress -- in real implementation, comes from project:progress websocket
  const progress = sub.status === 'active' ? 60 : sub.status === 'idle' ? 0 : 100;

  return (
    <div className="bg-[var(--primary-50)] rounded-[var(--radius-md)] p-2.5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', statusDot)} />
          <span className="text-[var(--text-small)] font-medium text-[var(--text-primary)] truncate">
            {sub.name}
          </span>
        </div>
        <span className="text-[10px] text-[var(--text-tertiary)] flex-shrink-0">
          인스턴스: {instanceCount}명
        </span>
      </div>
      {sub.statusMessage && (
        <p className="text-[10px] text-[var(--text-tertiary)] truncate mb-1.5 ml-3">
          {sub.statusMessage}
        </p>
      )}
      {/* Progress bar */}
      <div className="h-1.5 bg-[var(--bg-surface)] rounded-full overflow-hidden ml-3">
        <div
          className="h-full bg-[var(--status-active)] rounded-full transition-all duration-500 ease-in-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
