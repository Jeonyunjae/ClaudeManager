'use client';

/**
 * 복원 컴포넌트 — 원본은 저장소에 없다. CostSummaryBar.tsx 주석 참조.
 *
 * 원 설계(SB-018)는 도넛 차트지만 프로젝트에 차트 라이브러리가 없다
 * (package.json에 chart 계열 의존성 미포함). 수평 바로 대체한다.
 */

import React from 'react';
import { useCostStore } from '@/stores/costStore';

const PALETTE = ['#7C5CFC', '#5B9BF7', '#3EC9A0', '#F5A623', '#E8606D'];

export function CostByModelChart() {
  const byModel = useCostStore((s) => s.byModel);

  if (!byModel.length) {
    return <div className="text-[var(--text-small)] text-[var(--text-tertiary)]">데이터 없음</div>;
  }

  const max = Math.max(...byModel.map((m) => m.cost), 0.000001);

  return (
    <ul className="space-y-3">
      {byModel.map((m, i) => (
        <li key={m.model} className="space-y-1">
          <div className="flex items-baseline justify-between text-[var(--text-small)]">
            <span className="font-medium">{m.model}</span>
            <span className="text-[var(--text-secondary)]">${m.cost.toFixed(2)}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(m.cost / max) * 100}%`,
                backgroundColor: PALETTE[i % PALETTE.length],
              }}
            />
          </div>
          <div className="text-[var(--text-caption)] text-[var(--text-tertiary)]">
            in {m.inputTokens.toLocaleString()} · out {m.outputTokens.toLocaleString()}
          </div>
        </li>
      ))}
    </ul>
  );
}

export default CostByModelChart;
