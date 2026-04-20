'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { usePartStore } from '@/stores/partStore';

export function PartTabs() {
  const { parts, selectedPartId, selectPart } = usePartStore();

  if (parts.length === 0) {
    return (
      <div className="flex h-10 items-center px-[var(--space-6)] border-b border-[var(--primary-50)] bg-[var(--bg-surface)] text-sm text-[var(--text-tertiary)]">
        아직 부서가 없습니다. Skill을 실행하여 첫 부서를 만들어보세요.
      </div>
    );
  }

  return (
    <div className="flex h-10 items-center gap-1 px-[var(--space-6)] border-b border-[var(--primary-50)] bg-[var(--bg-surface)] overflow-x-auto">
      <button
        onClick={() => selectPart(null)}
        className={cn(
          'flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-sm)] text-sm font-medium transition-colors whitespace-nowrap',
          selectedPartId === null
            ? 'bg-[var(--primary-50)] text-[var(--primary-500)]'
            : 'text-[var(--text-secondary)] hover:bg-[var(--primary-50)]'
        )}
      >
        전체
      </button>
      {parts.map((part) => (
        <button
          key={part.id}
          onClick={() => selectPart(part.id)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-sm font-medium transition-colors whitespace-nowrap',
            selectedPartId === part.id
              ? 'text-white'
              : 'text-[var(--text-secondary)] hover:opacity-80'
          )}
          style={{
            backgroundColor: selectedPartId === part.id ? (part.color ?? 'var(--primary-500)') : 'transparent',
          }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: part.color ?? 'var(--primary-500)' }}
          />
          {part.name}
        </button>
      ))}
    </div>
  );
}
