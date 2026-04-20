'use client';

import React from 'react';

type EmptyStateGuideProps = {
  onCreatePart?: () => void;
};

export function EmptyStateGuide({ onCreatePart }: EmptyStateGuideProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 animate-[card-fade-in_0.3s_ease-out]">
      {/* Flow illustration placeholder */}
      <div className="w-full max-w-xs mb-6">
        <svg
          viewBox="0 0 320 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full"
        >
          {/* Dashed placeholder columns */}
          <rect x="10" y="10" width="60" height="60" rx="8" stroke="var(--primary-300)" strokeWidth="1.5" strokeDasharray="4 4" />
          <rect x="90" y="10" width="60" height="60" rx="8" stroke="var(--column-border)" strokeWidth="1.5" strokeDasharray="4 4" />
          <rect x="170" y="10" width="60" height="60" rx="8" stroke="var(--column-border)" strokeWidth="1.5" strokeDasharray="4 4" />
          <rect x="250" y="10" width="60" height="60" rx="8" stroke="var(--column-border)" strokeWidth="1.5" strokeDasharray="4 4" />
          {/* Dashed arrows */}
          <line x1="72" y1="40" x2="88" y2="40" stroke="var(--column-border)" strokeWidth="1.5" strokeDasharray="3 3" markerEnd="url(#arrow-empty)" />
          <line x1="152" y1="40" x2="168" y2="40" stroke="var(--column-border)" strokeWidth="1.5" strokeDasharray="3 3" markerEnd="url(#arrow-empty)" />
          <line x1="232" y1="40" x2="248" y2="40" stroke="var(--column-border)" strokeWidth="1.5" strokeDasharray="3 3" markerEnd="url(#arrow-empty)" />
          {/* Labels */}
          <text x="40" y="44" textAnchor="middle" fill="var(--primary-400)" fontSize="10" fontWeight="600">Main</text>
          <text x="120" y="44" textAnchor="middle" fill="var(--text-tertiary)" fontSize="10">Part</text>
          <text x="200" y="44" textAnchor="middle" fill="var(--text-tertiary)" fontSize="10">Sub</text>
          <text x="280" y="44" textAnchor="middle" fill="var(--text-tertiary)" fontSize="10">Inst</text>
          <defs>
            <marker id="arrow-empty" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <polygon points="0 0, 6 3, 0 6" fill="var(--column-border)" />
            </marker>
          </defs>
        </svg>
      </div>

      <h3 className="text-[var(--text-h3)] font-semibold text-[var(--text-primary)] mb-2">
        첫 번째 부서를 만들어보세요
      </h3>
      <p className="text-[var(--text-small)] text-[var(--text-secondary)] text-center max-w-sm mb-6">
        Skill을 실행하면 새 부서가 생성됩니다. 부서를 만들고 에이전트들을 배치해보세요.
      </p>

      {/* Steps */}
      <div className="flex flex-col gap-3 w-full max-w-xs mb-6">
        {[
          { step: 1, text: 'Skill 선택' },
          { step: 2, text: '부서 정보 입력' },
          { step: 3, text: '부서 생성 완료!' },
        ].map(({ step, text }) => (
          <div
            key={step}
            className="flex items-center gap-3 text-[var(--text-small)]"
          >
            <span className="w-6 h-6 rounded-full bg-[var(--primary-100)] text-[var(--primary-600)] flex items-center justify-center text-[var(--text-caption)] font-bold flex-shrink-0">
              {step}
            </span>
            <span className="text-[var(--text-secondary)]">{text}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onCreatePart}
        className="px-5 py-2.5 rounded-[var(--radius-md)] bg-[var(--primary-500)] text-white text-[var(--text-body)] font-medium hover:bg-[var(--primary-600)] transition-colors shadow-[var(--shadow-md)]"
      >
        부서 만들기
      </button>
    </div>
  );
}
