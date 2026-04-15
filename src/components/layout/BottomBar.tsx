'use client';

import React from 'react';
import { Users, DollarSign, Activity } from 'lucide-react';
import { useAgentStore } from '@/stores/agentStore';
import { useCostStore } from '@/stores/costStore';
import { useSystemStore } from '@/stores/systemStore';
import { cn } from '@/lib/utils';

export function BottomBar() {
  const { agents } = useAgentStore();
  const { summary } = useCostStore();
  const { health } = useSystemStore();

  const activeCount = Array.from(agents.values()).filter((a) => a.status === 'active').length;
  const totalCount = agents.size;

  const healthStatus = health?.status ?? 'healthy';
  const healthColor = {
    healthy: 'text-[var(--status-complete-text)]',
    warning: 'text-[var(--status-pending-text)]',
    critical: 'text-[var(--status-error-text)]',
  }[healthStatus];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 flex h-10 items-center justify-between border-t border-[var(--primary-50)] bg-[var(--bg-surface)] px-[var(--space-6)] text-xs text-[var(--text-secondary)]">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          <span>에이전트 {activeCount}/{totalCount}</span>
        </div>
        <div className="flex items-center gap-1">
          <DollarSign className="h-3.5 w-3.5" />
          <span>
            {summary ? `$${summary.totalCost.toFixed(2)} / $${summary.costLimit}` : '--'}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Activity className={cn('h-3.5 w-3.5', healthColor)} />
        <span className={healthColor}>
          {health ? `CPU ${health.cpu.toFixed(0)}% | MEM ${health.memory.toFixed(0)}%` : 'System --'}
        </span>
      </div>
    </div>
  );
}
