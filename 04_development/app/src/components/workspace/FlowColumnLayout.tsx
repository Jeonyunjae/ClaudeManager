'use client';

import React, { useRef } from 'react';
import type { AgentTreeNode } from '@/types/agent';
import { useAgentStore } from '@/stores/agentStore';
import { useApprovalStore } from '@/stores/approvalStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { FlowColumn } from './FlowColumn';
import { FlowConnectionLine } from './FlowConnectionLine';
import { MainCard } from './MainCard';
import { AgentFlowCard } from './AgentFlowCard';
import { EmptyStateGuide } from './EmptyStateGuide';
import { cn } from '@/lib/utils';

function collectByRole(nodes: AgentTreeNode[]): {
  main: AgentTreeNode | null;
  parts: AgentTreeNode[];
  subs: AgentTreeNode[];
  instances: AgentTreeNode[];
} {
  let main: AgentTreeNode | null = null;
  const parts: AgentTreeNode[] = [];
  const subs: AgentTreeNode[] = [];
  const instances: AgentTreeNode[] = [];

  function walk(node: AgentTreeNode) {
    switch (node.role) {
      case 'main':
        main = node;
        break;
      case 'part':
        parts.push(node);
        break;
      case 'sub':
        subs.push(node);
        break;
      case 'instance':
        instances.push(node);
        break;
    }
    node.children.forEach(walk);
  }
  nodes.forEach(walk);
  return { main, parts, subs, instances };
}

function findParentPath(tree: AgentTreeNode[], targetId: string, path: string[] = []): string {
  for (const node of tree) {
    if (node.id === targetId) {
      return path.join(' > ');
    }
    const found = findParentPath(node.children, targetId, [...path, node.name]);
    if (found) return found;
  }
  return '';
}

function MobileFlowList({ parts, subs, instances, tree, pendingAgentIds, newDepartmentId }: {
  parts: AgentTreeNode[];
  subs: AgentTreeNode[];
  instances: AgentTreeNode[];
  tree: AgentTreeNode[];
  pendingAgentIds: Set<string>;
  newDepartmentId: string | null;
}) {
  return (
    <div className="space-y-4 p-4">
      <div>
        <h3 className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2 px-1">
          Main
        </h3>
        <MainCard />
      </div>

      {parts.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2 px-1">
            Part
          </h3>
          <div className="space-y-2">
            {parts.map((part, i) => (
              <AgentFlowCard
                key={part.id}
                agent={part}
                colorIndex={i}
                isPending={pendingAgentIds.has(part.id)}
                isNew={newDepartmentId === part.id}
              />
            ))}
          </div>
        </div>
      )}

      {subs.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2 px-1">
            Sub
          </h3>
          <div className="space-y-2">
            {subs.map((sub) => (
              <AgentFlowCard
                key={sub.id}
                agent={sub}
                showProgress
                isPending={pendingAgentIds.has(sub.id)}
              />
            ))}
          </div>
        </div>
      )}

      {instances.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2 px-1">
            Instance
          </h3>
          <div className="space-y-2">
            {instances.map((inst) => (
              <AgentFlowCard
                key={inst.id}
                agent={inst}
                showProgress
                isPending={pendingAgentIds.has(inst.id)}
                belongsTo={findParentPath(tree, inst.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function FlowColumnLayout() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { tree } = useAgentStore();
  const { pendingList } = useApprovalStore();
  const { newDepartmentId } = useWorkspaceStore();
  const isMobile = useIsMobile();

  const { main, parts, subs, instances } = collectByRole(tree);
  const hasParts = parts.length > 0;

  const pendingAgentIds = new Set<string>(
    pendingList.map((p) => p.sourceAgentId).filter((id): id is string => !!id)
  );

  if (isMobile) {
    return (
      <MobileFlowList
        parts={parts}
        subs={subs}
        instances={instances}
        tree={tree}
        pendingAgentIds={pendingAgentIds}
        newDepartmentId={newDepartmentId}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative flex-1 flex gap-6 p-4 overflow-x-auto"
    >
      {/* Connection lines SVG overlay */}
      {hasParts && (
        <FlowConnectionLine
          containerRef={containerRef}
          tree={tree}
          newDepartmentId={newDepartmentId}
        />
      )}

      {/* Column 1: Main */}
      <FlowColumn label="Main" count={1} delay={0}>
        <MainCard />
      </FlowColumn>

      {/* Column 2: Part */}
      <FlowColumn label="Part" sublabel="부서" count={parts.length} delay={150} isEmpty={!hasParts}>
        {hasParts ? (
          parts.map((part, i) => (
            <AgentFlowCard
              key={part.id}
              agent={part}
              colorIndex={i}
              isPending={pendingAgentIds.has(part.id)}
              isNew={newDepartmentId === part.id}
            />
          ))
        ) : (
          <EmptyFlowPlaceholder label="Part" />
        )}
      </FlowColumn>

      {/* Column 3: Sub */}
      <FlowColumn label="Sub" sublabel="팀" count={subs.length} delay={300} isEmpty={subs.length === 0}>
        {subs.length > 0 ? (
          subs.map((sub) => (
            <AgentFlowCard
              key={sub.id}
              agent={sub}
              showProgress
              isPending={pendingAgentIds.has(sub.id)}
            />
          ))
        ) : (
          <EmptyFlowPlaceholder label="Sub" />
        )}
      </FlowColumn>

      {/* Column 4: Instance */}
      <FlowColumn label="Instance" sublabel="에이전트" count={instances.length} delay={450} isEmpty={instances.length === 0}>
        {instances.length > 0 ? (
          instances.map((inst) => (
            <AgentFlowCard
              key={inst.id}
              agent={inst}
              showProgress
              isPending={pendingAgentIds.has(inst.id)}
              belongsTo={findParentPath(tree, inst.id)}
            />
          ))
        ) : (
          <EmptyFlowPlaceholder label="Instance" />
        )}
      </FlowColumn>
    </div>
  );
}

function EmptyFlowPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-full min-h-[120px]">
      <div className="text-center">
        <div className="w-10 h-10 mx-auto mb-2 rounded-full border-2 border-dashed border-[var(--column-border)] flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
        <p className="text-[11px] text-[var(--text-tertiary)]">
          {label} 없음
        </p>
      </div>
    </div>
  );
}
