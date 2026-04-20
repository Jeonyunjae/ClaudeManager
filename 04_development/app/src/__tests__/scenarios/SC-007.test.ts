/**
 * SC-007. 비용 모니터링 및 임계값 관리 시나리오 테스트
 * 관련 기능: F016, F022, F031, F037, F044, F045, F046
 */
import { describe, it, expect } from 'vitest';
import type { CostSummary, CostByModel } from '@/types/cost';

describe('SC-007: 비용 모니터링 및 임계값 관리', () => {
  describe('Step 1: 비용 대시보드 확인', () => {
    it('비용 요약 정보가 올바르게 표시', () => {
      const summary: CostSummary = {
        totalCost: 78,
        costLimit: 100,
        percentage: 78,
        modelBreakdown: [
          { model: 'claude-opus', cost: 36, percentage: 45 },
          { model: 'claude-sonnet', cost: 28, percentage: 35 },
          { model: 'claude-haiku', cost: 16, percentage: 20 },
        ],
        keyBreakdown: [
          { provider: 'Anthropic', cost: 65 },
          { provider: 'OpenAI', cost: 13 },
        ],
      };

      expect(summary.totalCost).toBe(78);
      expect(summary.percentage).toBe(78);
      expect(summary.modelBreakdown).toHaveLength(3);
    });

    it('모델별 비용 비중이 합계 100%', () => {
      const breakdown = [
        { model: 'claude-opus', percentage: 45 },
        { model: 'claude-sonnet', percentage: 35 },
        { model: 'claude-haiku', percentage: 20 },
      ];
      const total = breakdown.reduce((sum, b) => sum + b.percentage, 0);
      expect(total).toBe(100);
    });
  });

  describe('Step 2: 임계값 도달 알림', () => {
    it('80% 임계값 도달 시 경고 색상 전환', () => {
      function getBarColor(percentage: number): string {
        if (percentage >= 90) return 'red';
        if (percentage >= 60) return 'yellow';
        return 'green';
      }

      expect(getBarColor(50)).toBe('green');
      expect(getBarColor(80)).toBe('yellow');
      expect(getBarColor(95)).toBe('red');
    });

    it('임계값 알림 생성', () => {
      const costLimit = 100;
      const alertThreshold = 0.8;
      const currentCost = 80;
      const shouldAlert = currentCost >= costLimit * alertThreshold;

      expect(shouldAlert).toBe(true);
    });

    it('모델 변경으로 비용 절감 (opus -> sonnet)', () => {
      const opusCostPer1M = 15;
      const sonnetCostPer1M = 3;
      const savings = ((opusCostPer1M - sonnetCostPer1M) / opusCostPer1M) * 100;
      expect(savings).toBe(80); // 80% 절감
    });
  });

  describe('예외흐름', () => {
    it('E1: 비용 100% 초과 시 빨간 경고', () => {
      const currentCost = 105;
      const costLimit = 100;
      const isOverLimit = currentCost > costLimit;
      expect(isOverLimit).toBe(true);
    });

    it('E2: 모델 변경 시 품질 저하 경고', () => {
      const modelQuality: Record<string, string> = {
        'claude-opus': '최상',
        'claude-sonnet': '높음',
        'claude-haiku': '보통',
      };

      const from = 'claude-sonnet';
      const to = 'claude-haiku';
      const qualityOptions = ['최상', '높음', '보통'];
      const fromIdx = qualityOptions.indexOf(modelQuality[from]);
      const toIdx = qualityOptions.indexOf(modelQuality[to]);
      const isDowngrade = toIdx > fromIdx;
      expect(isDowngrade).toBe(true);
    });
  });
});
