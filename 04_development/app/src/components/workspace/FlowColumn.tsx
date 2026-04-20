'use client';

import React from 'react';
import { cn } from '@/lib/utils';

type FlowColumnProps = {
  label: string;
  sublabel?: string;
  count?: number;
  children: React.ReactNode;
  delay?: number;
  isEmpty?: boolean;
};

export function FlowColumn({ label, sublabel, count, children, delay = 0, isEmpty }: FlowColumnProps) {
  return (
    <div
      className={cn(
        'flex flex-col min-w-[220px] flex-1 max-w-[320px]',
        'animate-[column-slide-in_0.4s_ease-out_both]',
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Column body — no background, cards float freely */}
      <div
        className={cn(
          'flex-1 p-2 space-y-3 overflow-y-auto',
          isEmpty && 'flex items-center justify-center',
        )}
      >
        {children}
      </div>

      {/* Column footer label */}
      <div className="px-3 py-2 mt-1 flex items-center gap-2">
        <span className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
          {label}
        </span>
        {sublabel && (
          <span className="text-[10px] text-[var(--text-tertiary)]">
            {sublabel}
          </span>
        )}
        {typeof count === 'number' && count > 0 && (
          <span className="text-[9px] font-medium text-[var(--text-tertiary)] bg-[var(--bg-base-alt)] px-1.5 py-0.5 rounded-full">
            {count}
          </span>
        )}
      </div>
    </div>
  );
}
