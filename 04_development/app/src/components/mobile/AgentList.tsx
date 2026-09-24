'use client';

import React from 'react';
import type { AgentTreeNode } from '@/types/agent';
import { cn } from '@/lib/utils';
import { agentInitial, agentRoleLabel, agentStatusLabel } from '@/lib/mobile-format';

type AgentListProps = {
  tree: AgentTreeNode[];
  waitingAgentIds: Set<string>;
  loading: boolean;
  onOpen: (agentId: string) => void;
};

/** role별 statusDot 색 토큰 */
function statusDotClass(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-[var(--status-active)]';
    case 'error':
      return 'bg-[var(--status-error)]';
    case 'pending':
    case 'retrying':
      return 'bg-[var(--status-pending)]';
    default:
      return 'bg-[var(--status-idle)]';
  }
}

/**
 * 트리를 role별로 모아 Main → Sub → Part 순으로 평탄화한다 (DES-006 §AgentList).
 * instance는 대표에게 직접 보고하지 않는 계층이라 제외한다 (DES-009).
 */
export function flattenAgentTree(nodes: AgentTreeNode[]): AgentTreeNode[] {
  const buckets: Record<'main' | 'sub' | 'part', AgentTreeNode[]> = { main: [], sub: [], part: [] };

  function walk(list: AgentTreeNode[]): void {
    for (const node of list) {
      if (node.role === 'main' || node.role === 'sub' || node.role === 'part') {
        buckets[node.role].push(node);
      }
      walk(node.children);
    }
  }
  walk(nodes);

  return [...buckets.main, ...buckets.sub, ...buckets.part];
}

/** SCR-M01 전체 에이전트 섹션 (DES-006 §AgentList, FR-004·FR-014) */
export function AgentList({ tree, waitingAgentIds, loading, onOpen }: AgentListProps) {
  const flat = flattenAgentTree(tree);

  return (
    <section className="px-4 py-3">
      <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-2">전체 에이전트</h2>

      {loading && <p className="text-sm text-[var(--text-tertiary)] py-2">불러오는 중…</p>}

      {!loading && flat.length === 0 && (
        <p className="text-sm text-[var(--text-tertiary)] py-2">
          등록된 에이전트가 없습니다 — 데스크톱에서 Main을 시작하세요
        </p>
      )}

      {!loading && flat.length > 0 && (
        <ul className="divide-y divide-[var(--primary-50)]">
          {flat.map((agent) => (
            <li key={agent.id}>
              <button
                type="button"
                onClick={() => onOpen(agent.id)}
                className="w-full min-h-[44px] flex items-center gap-3 py-2 text-left"
              >
                <div className="shrink-0 w-8 h-8 rounded-full bg-[var(--primary-100)] flex items-center justify-center">
                  <span className="text-xs font-bold text-[var(--primary-600)]">{agentInitial(agent.name)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">{agent.name}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">{agentRoleLabel(agent.role)}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {waitingAgentIds.has(agent.id) && (
                    <span
                      aria-label="답변 대기"
                      className="w-1.5 h-1.5 rounded-full bg-[var(--status-pending)]"
                    />
                  )}
                  <span className={cn('w-2 h-2 rounded-full', statusDotClass(agent.status))} />
                  <span className="text-xs text-[var(--text-secondary)]">{agentStatusLabel(agent.status)}</span>
                  <span className="text-[var(--text-tertiary)]">{'›'}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
