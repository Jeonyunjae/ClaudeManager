'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import type { AgentTreeNode } from '@/types/agent';
import { useApprovalStore } from '@/stores/approvalStore';

type ConnectionLine = {
  id: string;
  fromId: string;
  toId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  isPending: boolean;
  isError: boolean;
  isNew: boolean;
};

type FlowConnectionLineProps = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  tree: AgentTreeNode[];
  newDepartmentId: string | null;
};

function buildConnections(
  nodes: AgentTreeNode[],
  pendingAgentIds: Set<string>,
  newDepartmentId: string | null,
): { fromId: string; toId: string; isPending: boolean; isError: boolean; isNew: boolean }[] {
  const connections: { fromId: string; toId: string; isPending: boolean; isError: boolean; isNew: boolean }[] = [];

  function walk(node: AgentTreeNode) {
    for (const child of node.children) {
      connections.push({
        fromId: node.id,
        toId: child.id,
        isPending: pendingAgentIds.has(child.id) || pendingAgentIds.has(node.id),
        isError: child.status === 'error',
        isNew: child.id === newDepartmentId,
      });
      walk(child);
    }
  }
  nodes.forEach(walk);
  return connections;
}

export function FlowConnectionLine({ containerRef, tree, newDepartmentId }: FlowConnectionLineProps) {
  const { pendingList } = useApprovalStore();
  const [lines, setLines] = useState<ConnectionLine[]>([]);
  const rafRef = useRef<number>(0);

  const pendingAgentIds = new Set<string>(
    pendingList.map((p) => p.sourceAgentId).filter((id): id is string => !!id)
  );

  const computeLines = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const connections = buildConnections(tree, pendingAgentIds, newDepartmentId);

    const computedLines: ConnectionLine[] = [];

    for (const conn of connections) {
      const fromEl = container.querySelector(`[data-agent-id="${conn.fromId}"]`);
      const toEl = container.querySelector(`[data-agent-id="${conn.toId}"]`);

      if (!fromEl || !toEl) continue;

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();

      computedLines.push({
        id: `${conn.fromId}-${conn.toId}`,
        fromId: conn.fromId,
        toId: conn.toId,
        fromX: fromRect.right - containerRect.left,
        fromY: fromRect.top + fromRect.height / 2 - containerRect.top,
        toX: toRect.left - containerRect.left,
        toY: toRect.top + toRect.height / 2 - containerRect.top,
        isPending: conn.isPending,
        isError: conn.isError,
        isNew: conn.isNew,
      });
    }

    setLines(computedLines);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, tree, newDepartmentId, pendingList]);

  useEffect(() => {
    // Compute on mount and after layout settles
    const timer = setTimeout(computeLines, 100);

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(computeLines);
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    window.addEventListener('scroll', computeLines, true);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(rafRef.current);
      observer.disconnect();
      window.removeEventListener('scroll', computeLines, true);
    };
  }, [computeLines, containerRef]);

  if (lines.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-[1]"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 6 3, 0 6" fill="var(--connection-line)" />
        </marker>
        <marker
          id="arrowhead-active"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 6 3, 0 6" fill="var(--connection-line-active)" />
        </marker>
        <marker
          id="arrowhead-pending"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 6 3, 0 6" fill="var(--status-pending)" />
        </marker>
        <marker
          id="arrowhead-error"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 6 3, 0 6" fill="var(--status-error)" />
        </marker>
      </defs>

      {lines.map((line) => {
        const dx = line.toX - line.fromX;
        const midX = line.fromX + dx * 0.5;

        const path = `M ${line.fromX} ${line.fromY} C ${midX} ${line.fromY}, ${midX} ${line.toY}, ${line.toX} ${line.toY}`;

        const pathLength = Math.sqrt(
          Math.pow(line.toX - line.fromX, 2) + Math.pow(line.toY - line.fromY, 2)
        ) * 1.5;

        let strokeColor = 'var(--connection-line)';
        let strokeWidth = 2;
        let markerEnd = 'url(#arrowhead)';
        let dashArray = 'none';
        let animationClass = '';

        if (line.isPending) {
          strokeColor = 'var(--status-pending)';
          markerEnd = 'url(#arrowhead-pending)';
          animationClass = 'animate-[connection-pulse_1.5s_infinite]';
        } else if (line.isError) {
          strokeColor = 'var(--status-error)';
          markerEnd = 'url(#arrowhead-error)';
          dashArray = '4 4';
        } else if (line.isNew) {
          strokeColor = 'var(--connection-line-active)';
          strokeWidth = 3;
          markerEnd = 'url(#arrowhead-active)';
        }

        return (
          <path
            key={line.id}
            d={path}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={line.isNew ? `${pathLength}` : dashArray}
            strokeDashoffset={line.isNew ? `${pathLength}` : '0'}
            markerEnd={markerEnd}
            className={animationClass}
            style={line.isNew ? {
              animation: `connection-draw 0.5s ease-in-out forwards`,
              strokeDasharray: `${pathLength}`,
              strokeDashoffset: `${pathLength}`,
            } : undefined}
          />
        );
      })}
    </svg>
  );
}
