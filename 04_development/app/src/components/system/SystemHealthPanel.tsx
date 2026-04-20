'use client';

import React from 'react';
import { useSystemStore } from '@/stores/systemStore';
import { cn } from '@/lib/utils';

function HealthMeter({ label, value, unit = '%' }: { label: string; value: number; unit?: string }) {
  const color = value >= 90 ? 'var(--status-error)'
    : value >= 70 ? 'var(--status-pending)'
    : 'var(--status-active)';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <span className="font-medium" style={{ color }}>{value}{unit}</span>
      </div>
      <div className="w-full h-2 rounded-full bg-[var(--primary-50)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function SystemHealthPanel() {
  const { health } = useSystemStore();

  if (!health) {
    return (
      <div className="text-center py-8 text-sm text-[var(--text-tertiary)]">
        System health data unavailable.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className={cn(
          'w-3 h-3 rounded-full',
          health.status === 'healthy' ? 'bg-[var(--status-active)]' :
          health.status === 'warning' ? 'bg-[var(--status-pending)]' :
          'bg-[var(--status-error)]'
        )} />
        <span className="text-sm font-medium text-[var(--text-primary)] capitalize">
          {health.status}
        </span>
      </div>

      <div className="space-y-3">
        <HealthMeter label="CPU" value={health.cpu} />
        <HealthMeter label="Memory" value={health.memory} />
        <HealthMeter label="Disk" value={health.disk} />
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="text-center p-3 rounded-[var(--radius-md)] bg-[var(--primary-50)]">
          <p className="text-lg font-bold text-[var(--primary-600)]">{health.activeAgents}</p>
          <p className="text-[10px] text-[var(--text-secondary)]">Active Agents</p>
        </div>
        <div className="text-center p-3 rounded-[var(--radius-md)] bg-[var(--primary-50)]">
          <p className="text-lg font-bold text-[var(--primary-600)]">{health.maxAgents}</p>
          <p className="text-[10px] text-[var(--text-secondary)]">Max Agents</p>
        </div>
      </div>
    </div>
  );
}
