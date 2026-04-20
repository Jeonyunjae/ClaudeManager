'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export type Priority = 'urgent' | 'high' | 'normal' | 'low';

interface PriorityBadgeProps {
  priority: Priority;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

const PRIORITY_CONFIG: Record<Priority, { color: string; bg: string; label: string; dot: string }> = {
  urgent: {
    color: 'text-red-700',
    bg: 'bg-red-50 border-red-200',
    label: 'Urgent',
    dot: 'bg-red-500',
  },
  high: {
    color: 'text-orange-700',
    bg: 'bg-orange-50 border-orange-200',
    label: 'High',
    dot: 'bg-orange-500',
  },
  normal: {
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
    label: 'Normal',
    dot: 'bg-blue-500',
  },
  low: {
    color: 'text-gray-500',
    bg: 'bg-gray-50 border-gray-200',
    label: 'Low',
    dot: 'bg-gray-400',
  },
};

export function PriorityBadge({ priority, size = 'sm', showLabel = true, className }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        config.bg,
        config.color,
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        className
      )}
    >
      <span className={cn('rounded-full', config.dot, size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2')} />
      {showLabel && config.label}
    </span>
  );
}
