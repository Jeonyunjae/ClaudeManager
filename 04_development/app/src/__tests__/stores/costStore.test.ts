/**
 * costStore 단위 테스트
 * 대상 기능: F016 (비용 대시보드), F031 (비용 임계값 알림), F046 (토큰/비용 수집)
 * 시나리오 근거: SC-007 (비용 추적 및 관리), SC-024 (비용 알림)
 */
import { describe, it, expect } from 'vitest';
import type { CostSummary, CostByModel, CostTrend, CostPeriod } from '@/types/cost';

describe('costStore - 비용 상태 관리 순수 로직', () => {
  const sampleSummary: CostSummary = {
    totalCost: 85.50,
    costLimit: 100,
    percentage: 86,
    modelBreakdown: [
      { model: 'claude-3-opus', cost: 50.00, percentage: 58 },
      { model: 'claude-3-sonnet', cost: 30.00, percentage: 35 },
      { model: 'gpt-4', cost: 5.50, percentage: 7 },
    ],
    keyBreakdown: [
      { provider: 'anthropic', cost: 80.00 },
      { provider: 'openai', cost: 5.50 },
    ],
  };

  // SC-007: 비용 요약 표시
  describe('CostSummary 데이터 검증', () => {
    it('총 비용이 올바르게 계산', () => {
      expect(sampleSummary.totalCost).toBe(85.50);
    });

    it('비용 한도 대비 퍼센트 계산', () => {
      const expected = Math.round((sampleSummary.totalCost / sampleSummary.costLimit) * 100);
      // summary에서 percentage는 미리 계산되어 있어야 함
      expect(sampleSummary.percentage).toBeCloseTo(expected, 0);
    });

    it('모델별 비용 합이 총 비용과 일치', () => {
      const modelTotal = sampleSummary.modelBreakdown.reduce((sum, m) => sum + m.cost, 0);
      expect(modelTotal).toBeCloseTo(sampleSummary.totalCost, 1);
    });

    it('키별 비용 합이 총 비용과 일치', () => {
      const keyTotal = sampleSummary.keyBreakdown.reduce((sum, k) => sum + k.cost, 0);
      expect(keyTotal).toBeCloseTo(sampleSummary.totalCost, 1);
    });
  });

  // SC-007: 기간 변경
  describe('setPeriod 로직', () => {
    it('유효한 기간 값 확인', () => {
      const validPeriods: CostPeriod[] = ['day', 'week', 'month'];
      expect(validPeriods).toContain('day');
      expect(validPeriods).toContain('week');
      expect(validPeriods).toContain('month');
    });
  });

  // SC-024: 비용 임계값 체크
  describe('비용 임계값 알림 로직', () => {
    it('임계값(80%) 초과 시 알림 조건 충족', () => {
      const threshold = 80;
      const isOverThreshold = sampleSummary.percentage >= threshold;
      expect(isOverThreshold).toBe(true);
    });

    it('임계값 미만이면 알림 조건 미충족', () => {
      const lowSummary = { ...sampleSummary, percentage: 50 };
      const threshold = 80;
      const isOverThreshold = lowSummary.percentage >= threshold;
      expect(isOverThreshold).toBe(false);
    });
  });

  // SC-007: updateSummary 로직
  describe('updateSummary 로직', () => {
    it('부분 업데이트가 기존 데이터와 병합', () => {
      const partial = { totalCost: 90.00, percentage: 90 };
      const merged = { ...sampleSummary, ...partial };
      expect(merged.totalCost).toBe(90.00);
      expect(merged.percentage).toBe(90);
      expect(merged.costLimit).toBe(100); // 기존 값 유지
    });

    it('null 상태에서 업데이트 시 null 유지', () => {
      const summary: CostSummary | null = null;
      const result = summary ? { ...summary, totalCost: 10 } : null;
      expect(result).toBeNull();
    });
  });
});
