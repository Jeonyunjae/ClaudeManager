'use client';

/**
 * 복원 컴포넌트 — 원본은 저장소에 없다. CostSummaryBar.tsx 주석 참조.
 *
 * 원 설계(SB-018)는 선 그래프지만 차트 라이브러리가 없어 인라인 SVG로 그린다.
 */

import React from 'react';
import { useCostStore } from '@/stores/costStore';

const W = 320;
const H = 96;
const PAD = 4;

export function CostTrendChart() {
  const trend = useCostStore((s) => s.trend);

  if (trend.length < 2) {
    return <div className="text-[var(--text-small)] text-[var(--text-tertiary)]">데이터 없음</div>;
  }

  const max = Math.max(...trend.map((t) => t.cost), 0.000001);
  const stepX = (W - PAD * 2) / (trend.length - 1);
  const points = trend
    .map((t, i) => {
      const x = PAD + i * stepX;
      const y = H - PAD - (t.cost / max) * (H - PAD * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const total = trend.reduce((sum, t) => sum + t.cost, 0);

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-24"
        role="img"
        aria-label="기간별 비용 추이"
      >
        <polyline
          points={points}
          fill="none"
          stroke="#7C5CFC"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="flex justify-between text-[var(--text-caption)] text-[var(--text-tertiary)]">
        <span>{trend[0].date}</span>
        <span>합계 ${total.toFixed(2)}</span>
        <span>{trend[trend.length - 1].date}</span>
      </div>
    </div>
  );
}

export default CostTrendChart;
