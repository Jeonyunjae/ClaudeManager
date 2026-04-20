/**
 * Cost API Routes 단위 테스트 (순수 로직 검증)
 * 대상 기능: F016 (비용 대시보드), F046 (토큰/비용 수집)
 * 시나리오 근거: SC-007 (비용 추적 및 관리)
 */
import { describe, it, expect } from 'vitest';

describe('Cost API - getPeriodStart 로직', () => {
  function getPeriodStart(period: string): string {
    const now = new Date('2025-03-15T12:00:00Z');
    switch (period) {
      case 'day':
        now.setDate(now.getDate() - 1);
        break;
      case 'week':
        now.setDate(now.getDate() - 7);
        break;
      case 'month':
      default:
        now.setMonth(now.getMonth() - 1);
        break;
    }
    return now.toISOString();
  }

  it('day 기간은 1일 전 반환', () => {
    const result = getPeriodStart('day');
    expect(result).toContain('2025-03-14');
  });

  it('week 기간은 7일 전 반환', () => {
    const result = getPeriodStart('week');
    expect(result).toContain('2025-03-08');
  });

  it('month 기간은 1개월 전 반환', () => {
    const result = getPeriodStart('month');
    expect(result).toContain('2025-02-15');
  });

  it('알 수 없는 기간은 month로 기본 적용', () => {
    const result = getPeriodStart('unknown');
    expect(result).toContain('2025-02-15');
  });
});

describe('Cost API - 비용 퍼센트 계산 로직', () => {
  it('총 비용 대비 모델별 퍼센트 계산', () => {
    const totalCost = 100;
    const modelCost = 40;
    const percentage = totalCost > 0 ? Math.round((modelCost / totalCost) * 100) : 0;
    expect(percentage).toBe(40);
  });

  it('총 비용이 0이면 퍼센트는 0', () => {
    const totalCost = 0;
    const modelCost = 0;
    const percentage = totalCost > 0 ? Math.round((modelCost / totalCost) * 100) : 0;
    expect(percentage).toBe(0);
  });

  it('비용 한도 대비 퍼센트 계산', () => {
    const totalCost = 85;
    const costLimit = 100;
    const percentage = costLimit > 0 ? Math.round((totalCost / costLimit) * 100) : 0;
    expect(percentage).toBe(85);
  });

  it('비용 한도가 0이면 퍼센트는 0', () => {
    const totalCost = 50;
    const costLimit = 0;
    const percentage = costLimit > 0 ? Math.round((totalCost / costLimit) * 100) : 0;
    expect(percentage).toBe(0);
  });
});
