'use client';

import React, { useMemo } from 'react';
import { useAgentStore } from '@/stores/agentStore';
import { useApprovalStore } from '@/stores/approvalStore';
import type { AgentTreeNode } from '@/types/agent';

function countAgentsByStatus(tree: AgentTreeNode[]): { total: number; active: number } {
  let total = 0;
  let active = 0;
  function walk(node: AgentTreeNode) {
    total++;
    if (node.status === 'active') active++;
    node.children.forEach(walk);
  }
  tree.forEach(walk);
  return { total, active };
}

type ContextItem = {
  label: string;
  value: number;
  dotColor: string;
};

export function ContextBar() {
  const { tree } = useAgentStore();
  const { pendingList } = useApprovalStore();

  const { total, active } = useMemo(() => countAgentsByStatus(tree), [tree]);

  const items: ContextItem[] = [
    {
      label: 'Active',
      value: active,
      dotColor: 'var(--status-active, #22C55E)',
    },
    {
      label: 'Pending',
      value: pendingList.length,
      dotColor: 'var(--status-pending-text, #F59E0B)',
    },
    {
      label: 'Total',
      value: total,
      dotColor: 'var(--text-secondary, #6B7280)',
    },
  ];

  return (
    <div
      className="flex items-center gap-5 px-6 py-2.5"
      style={{
        background: 'var(--bg-card, #FFFFFF)',
        borderBottom: '1px solid var(--border-light, #E5E7EB)',
      }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-1.5 text-[13px]"
          style={{ color: 'var(--text-secondary, #6B7280)' }}
        >
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: item.dotColor }}
          />
          <span>{item.label}</span>
          <span
            className="font-semibold"
            style={{ color: 'var(--text-primary, #10141A)' }}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
