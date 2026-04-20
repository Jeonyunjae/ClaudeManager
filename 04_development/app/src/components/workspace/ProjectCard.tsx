'use client';

import React from 'react';
import { PriorityBadge, type Priority } from './PriorityBadge';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ProjectCardProps {
  id: string;
  name: string;
  priority: Priority;
  status: string;
  currentStage?: string;
  progressPercent: number;
  partName?: string;
  partColor?: string;
  onClick?: () => void;
}

const STATUS_VARIANT: Record<string, 'active' | 'idle' | 'error' | 'pending'> = {
  active: 'active',
  paused: 'pending',
  stopped: 'idle',
  completed: 'active',
};

export function ProjectCard({
  id,
  name,
  priority,
  status,
  currentStage,
  progressPercent,
  partName,
  partColor,
  onClick,
}: ProjectCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'p-3 rounded-lg border border-[var(--primary-50)] bg-white',
        'hover:shadow-sm hover:border-[var(--primary-200)] transition-all cursor-pointer',
        priority === 'urgent' && 'border-l-2 border-l-red-500'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium text-[var(--text-primary)] truncate flex-1">{name}</h4>
        <PriorityBadge priority={priority} size="sm" />
      </div>

      {partName && (
        <div className="flex items-center gap-1.5 mb-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: partColor || 'var(--primary-500)' }}
          />
          <span className="text-[10px] text-[var(--text-tertiary)] truncate">{partName}</span>
        </div>
      )}

      {currentStage && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-[var(--text-secondary)]">{currentStage}</span>
          <Badge variant={STATUS_VARIANT[status] || 'idle'} className="text-[9px] px-1.5 py-0">
            {status}
          </Badge>
        </div>
      )}

      {/* Progress bar */}
      <div className="w-full bg-[var(--primary-50)] rounded-full h-1.5">
        <div
          className={cn(
            'h-1.5 rounded-full transition-all duration-300',
            status === 'completed' ? 'bg-[var(--status-complete)]' : 'bg-[var(--primary-500)]'
          )}
          style={{ width: `${Math.min(100, progressPercent)}%` }}
        />
      </div>
      <p className="text-[10px] text-[var(--text-tertiary)] mt-1 text-right">{progressPercent}%</p>
    </div>
  );
}
