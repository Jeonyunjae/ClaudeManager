'use client';

import React from 'react';
import { useSystemStore } from '@/stores/systemStore';
import { cn } from '@/lib/utils';

export function RecoveryOverlay() {
  const { recoveryStatus } = useSystemStore();

  if (!recoveryStatus) return null;

  const { phase, progress, recoveredAgents } = recoveryStatus;

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg-overlay)] flex items-center justify-center p-4">
      <div className="w-full max-w-[480px] bg-[var(--bg-surface)] rounded-[var(--radius-xl)] shadow-[0_8px_32px_rgba(0,0,0,0.16)] p-6 animate-[card-fade-in_0.3s_ease-out]">
        {/* Spinner */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 border-3 border-[var(--primary-100)] border-t-[var(--primary-500)] rounded-full animate-spin" />
        </div>

        <h2 className="text-[var(--text-h2)] font-semibold text-[var(--text-primary)] text-center mb-1">
          시스템 복구 중...
        </h2>
        <p className="text-[var(--text-caption)] text-[var(--text-secondary)] text-center mb-4">
          {phase}
        </p>

        {/* Progress bar */}
        <div className="mb-2">
          <div className="h-2 bg-[var(--primary-50)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--primary-500)] rounded-full transition-all duration-500 ease-in-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[var(--text-caption)] text-[var(--text-tertiary)] text-right mt-1">
            {progress}%
          </p>
        </div>

        {/* Recovery steps */}
        {recoveredAgents.length > 0 && (
          <div className="space-y-2 mt-4">
            {recoveredAgents.map((name, i) => (
              <div
                key={name}
                className="flex items-center gap-2 text-[var(--text-small)] animate-[recovery-step_0.3s_ease-out]"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--status-complete)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="flex-shrink-0"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-[var(--text-secondary)]">{name}</span>
                <span className="ml-auto text-[var(--text-caption)] text-[var(--status-complete-text)]">
                  완료
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
