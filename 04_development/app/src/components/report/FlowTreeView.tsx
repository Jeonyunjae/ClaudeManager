'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';

interface FlowNode {
  id: string;
  agentId: string;
  agentName: string;
  action: string;
  timestamp: string;
  detail: string;
}

interface FlowEdge {
  from: string;
  to: string;
  type: string;
}

interface FlowData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export function FlowTreeView() {
  const [flow, setFlow] = useState<FlowData>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<FlowData>('/api/reports/flow')
      .then((res) => setFlow(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="animate-pulse h-64 bg-[var(--primary-50)] rounded-[var(--radius-md)]" />;
  }

  if (flow.nodes.length === 0) {
    return <p className="text-sm text-[var(--text-tertiary)] text-center py-8">No flow data.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--text-secondary)] mb-4">
        {flow.nodes.length} nodes, {flow.edges.length} edges
      </p>

      {/* Simple timeline view of flow nodes */}
      <div className="relative pl-6">
        <div className="absolute left-2.5 top-0 bottom-0 w-0.5 bg-[var(--primary-100)]" />

        {flow.nodes.map((node) => (
          <div key={node.id} className="relative mb-4 pl-4">
            <div className="absolute left-[-14px] top-1.5 w-3 h-3 rounded-full bg-[var(--primary-300)] border-2 border-[var(--bg-surface)]" />
            <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--primary-50)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--primary-600)]">{node.agentName}</span>
                <span className="text-[10px] text-[var(--text-tertiary)]">{formatRelativeTime(node.timestamp)}</span>
              </div>
              <p className="text-xs text-[var(--text-primary)] mt-1">{node.action}</p>
              {node.detail && (
                <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 truncate">{node.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
