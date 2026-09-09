'use client';

/**
 * 복원 컴포넌트 — 원본은 저장소에 없다.
 *
 * `.gitignore`의 `data/` 패턴이 앵커링되지 않아 `src/components/data/` 전체가
 * 커밋에서 누락됐다. 원본 구현은 어느 커밋에도 존재하지 않으므로
 * costStore의 계약(CostSummary)에 맞춰 최소 기능으로 다시 작성한 것이다.
 * 원본 디자인(dashboard-design-spec.md §3-6)과 다를 수 있다.
 */

import React from 'react';
import { useCostStore } from '@/stores/costStore';

export function CostSummaryBar() {
  const summary = useCostStore((s) => s.summary);

  if (!summary) {
    return <div className="text-[var(--text-small)] text-[var(--text-tertiary)]">데이터 없음</div>;
  }

  // 0~60% 초록 / 60~90% 앰버 / 90%+ 레드 (dashboard-design-spec.md §3-6)
  const pct = Math.max(0, Math.min(100, summary.percentage));
  const barColor = pct >= 90 ? '#F06060' : pct >= 60 ? '#F5A623' : '#4ADE80';

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[var(--text-h2)] font-semibold">
          ${summary.overage.toFixed(2)}
        </span>
        <span className="text-[var(--text-small)] text-[var(--text-secondary)]">
          / ${summary.overageLimit.toFixed(2)} ({pct.toFixed(0)}%)
        </span>
      </div>

      <div className="h-2 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[var(--text-small)] sm:grid-cols-4">
        <div>
          <dt className="text-[var(--text-tertiary)]">오늘</dt>
          <dd>${summary.todayCost.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-[var(--text-tertiary)]">이번 달</dt>
          <dd>${summary.monthlyCost.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-[var(--text-tertiary)]">입력 토큰</dt>
          <dd>{summary.totalInputTokens.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-[var(--text-tertiary)]">출력 토큰</dt>
          <dd>{summary.totalOutputTokens.toLocaleString()}</dd>
        </div>
      </dl>
    </div>
  );
}

export default CostSummaryBar;
