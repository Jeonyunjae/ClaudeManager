'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { agentInitial, agentRoleLabel, agentStatusLabel, formatRelativeTime } from '@/lib/mobile-format';
import type { InboxItem } from '@/stores/inboxStore';

type InboxSectionProps = {
  items: InboxItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onAck: (agentId: string) => void;
  onOpen: (agentId: string) => void;
};

/** SCR-M01 답변 대기 섹션 (DES-006 §InboxSection, FR-006·FR-007) */
export function InboxSection({ items, loading, error, onRetry, onAck, onOpen }: InboxSectionProps) {
  return (
    <section className="px-4 py-3 border-b border-[var(--primary-50)]">
      <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-2">답변 대기 {items.length}</h2>

      {loading && (
        <div className="space-y-2" data-testid="inbox-loading">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center justify-between text-sm text-[var(--status-error-text)] py-2">
          <span>불러오지 못했습니다</span>
          <button
            type="button"
            onClick={onRetry}
            className="text-[var(--primary-500)] font-medium underline-offset-2 hover:underline"
          >
            다시 시도
          </button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--primary-50)] shadow-[var(--shadow-sm)] py-6 flex items-center justify-center">
          <p className="text-sm text-[var(--text-tertiary)]">대기 없음</p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.agentId}
              className="bg-[var(--bg-surface)] border border-[var(--primary-50)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] p-3"
            >
              <button
                type="button"
                onClick={() => onOpen(item.agentId)}
                className="w-full text-left flex gap-3"
              >
                <div className="shrink-0 w-9 h-9 rounded-full bg-[var(--primary-100)] flex items-center justify-center">
                  <span className="text-xs font-bold text-[var(--primary-600)]">{agentInitial(item.agentName)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {item.agentName}
                      <span className="text-[var(--text-tertiary)] font-normal">
                        {' '}
                        · {agentRoleLabel(item.role)} · {agentStatusLabel(item.agentStatus)}
                      </span>
                    </p>
                    <span className="text-[10px] text-[var(--text-tertiary)] shrink-0">
                      {formatRelativeTime(item.lastMessageAt)}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">{item.preview}</p>
                </div>
              </button>
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={() => onAck(item.agentId)}
                  aria-label={`${item.agentName} 확인함`}
                  className={cn(
                    'min-h-[44px] px-4 flex items-center rounded-[var(--radius-md)]',
                    'border border-[var(--primary-200)] text-xs font-medium text-[var(--primary-600)]',
                    'hover:bg-[var(--primary-50)]'
                  )}
                >
                  확인함
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
