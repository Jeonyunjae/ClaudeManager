'use client';

import React from 'react';
import type { AgentTreeNode } from '@/types/agent';
import { AgentCard } from './AgentCard';

type AgentListSectionProps = {
  tree: AgentTreeNode[];
  selectedPartId: string | null;
};

type FlatAgent = {
  agent: AgentTreeNode;
  belongsTo: string;
};

function flattenAgents(
  nodes: AgentTreeNode[],
  parentPath: string = '',
): FlatAgent[] {
  const result: FlatAgent[] = [];
  for (const node of nodes) {
    if (node.role === 'main') {
      // Skip main in agent list, it has its own card
      result.push(...flattenAgents(node.children, ''));
      continue;
    }
    const currentPath = parentPath ? `${parentPath} > ${node.name}` : node.name;
    result.push({ agent: node, belongsTo: parentPath || '-' });
    result.push(...flattenAgents(node.children, currentPath));
  }
  return result;
}

export function AgentListSection({ tree, selectedPartId }: AgentListSectionProps) {
  const allAgents = flattenAgents(tree);

  const filtered = selectedPartId
    ? allAgents.filter((a) => a.agent.partId === selectedPartId)
    : allAgents;

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--text-small)] text-[var(--text-secondary)]">
          표시할 에이전트가 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filtered.map((item) => (
        <AgentCard
          key={item.agent.id}
          agent={item.agent}
          belongsTo={item.belongsTo}
        />
      ))}
    </div>
  );
}
