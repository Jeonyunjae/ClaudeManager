'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface ActivityItemData {
  id: string;
  type: 'agent_status' | 'approval' | 'error' | 'completion' | 'message' | 'system';
  title: string;
  description?: string;
  timestamp: string;
  agentName?: string;
}

const TYPE_CONFIG: Record<string, { dot: string; border?: string }> = {
  agent_status: { dot: 'bg-blue-400' },
  approval: { dot: 'bg-yellow-400', border: 'border-l-yellow-400' },
  error: { dot: 'bg-red-500', border: 'border-l-red-500' },
  completion: { dot: 'bg-green-500' },
  message: { dot: 'bg-[var(--primary-500)]' },
  system: { dot: 'bg-gray-400' },
};

export function ActivityItem({ item }: { item: ActivityItemData }) {
  const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.system;

  const timeStr = (() => {
    try {
      const d = new Date(item.timestamp);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      if (diff < 60000) return 'just now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
      return d.toLocaleDateString();
    } catch {
      return '';
    }
  })();

  return (
    <div
      className={cn(
        'px-3 py-2 rounded-md border border-[var(--primary-50)] bg-white',
        config.border && `border-l-2 ${config.border}`
      )}
    >
      <div className="flex items-start gap-2">
        <span className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', config.dot)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-[var(--text-primary)] truncate">{item.title}</p>
            <span className="text-[10px] text-[var(--text-tertiary)] flex-shrink-0">{timeStr}</span>
          </div>
          {item.description && (
            <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 line-clamp-2">{item.description}</p>
          )}
          {item.agentName && (
            <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{item.agentName}</p>
          )}
        </div>
      </div>
    </div>
  );
}
