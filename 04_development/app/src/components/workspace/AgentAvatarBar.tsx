'use client';

import React from 'react';
import type { AgentTreeNode } from '@/types/agent';
import { useAgentStore } from '@/stores/agentStore';
import { useApprovalStore } from '@/stores/approvalStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { cn } from '@/lib/utils';

const ROLE_BG: Record<string, string> = {
  main: 'bg-[var(--primary-500)]',
  part: 'bg-[var(--part-purple)]',
  sub: 'bg-[var(--part-blue)]',
  instance: 'bg-[var(--part-mint)]',
};

const BADGE_COLORS = [
  'bg-[var(--badge-coral)]',
  'bg-[var(--part-blue)]',
  'bg-[var(--badge-lavender)]',
  'bg-[var(--part-amber)]',
  'bg-[var(--part-mint)]',
];

function flattenAllAgents(nodes: AgentTreeNode[]): AgentTreeNode[] {
  const result: AgentTreeNode[] = [];
  function walk(node: AgentTreeNode) {
    result.push(node);
    node.children.forEach(walk);
  }
  nodes.forEach(walk);
  return result;
}

function countChildren(node: AgentTreeNode): number {
  return node.children.length + node.children.reduce((sum, c) => sum + countChildren(c), 0);
}

type AvatarItemProps = {
  agent: AgentTreeNode;
  index: number;
  isSelected: boolean;
  isPendingApproval: boolean;
  onClick: () => void;
};

function AvatarItem({ agent, index, isSelected, isPendingApproval, onClick }: AvatarItemProps) {
  const bgColor = ROLE_BG[agent.role] || ROLE_BG.instance;
  const initial = agent.name.charAt(0) || '?';
  const childCount = countChildren(agent);
  const badgeColor = BADGE_COLORS[index % BADGE_COLORS.length];

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center gap-0.5 group flex-shrink-0',
      )}
      title={agent.name}
    >
      <div
        className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-bold transition-transform group-hover:scale-110',
          bgColor,
          isSelected && 'ring-2 ring-[var(--primary-500)] ring-offset-1',
        )}
      >
        {initial}
      </div>

      {/* Count badge (SugarCRM style) */}
      {childCount > 0 && (
        <span className={cn(
          'absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full text-white text-[8px] font-bold flex items-center justify-center border-2 border-[var(--bg-base)]',
          badgeColor,
        )}>
          {childCount}
        </span>
      )}

      {/* Pending exclamation */}
      {isPendingApproval && (
        <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[var(--status-pending)] text-white text-[8px] font-bold flex items-center justify-center animate-[pulse-pending_1.5s_infinite]">
          !
        </span>
      )}

      {/* Name tooltip */}
      <span className="hidden group-hover:block absolute top-full mt-1.5 text-[9px] text-[var(--text-secondary)] whitespace-nowrap bg-[var(--bg-surface)] shadow-[var(--shadow-sm)] px-1.5 py-0.5 rounded z-50">
        {agent.name}
      </span>
    </button>
  );
}

export function AgentAvatarBar() {
  const { tree } = useAgentStore();
  const { pendingList } = useApprovalStore();
  const { selectedAgentId, setSelectedAgentId } = useWorkspaceStore();

  const allAgents = flattenAllAgents(tree);

  const pendingAgentIds = new Set<string>(
    pendingList.map((p) => p.sourceAgentId).filter((id): id is string => !!id)
  );

  return (
    <div className="w-full px-4 pt-3 pb-1 flex items-center gap-3 overflow-x-auto scrollbar-hide">
      {allAgents.map((agent, i) => (
        <AvatarItem
          key={agent.id}
          agent={agent}
          index={i}
          isSelected={selectedAgentId === agent.id}
          isPendingApproval={pendingAgentIds.has(agent.id)}
          onClick={() => setSelectedAgentId(selectedAgentId === agent.id ? null : agent.id)}
        />
      ))}
      {allAgents.length === 0 && (
        <p className="text-[11px] text-[var(--text-tertiary)]">
          에이전트가 없습니다
        </p>
      )}
    </div>
  );
}
