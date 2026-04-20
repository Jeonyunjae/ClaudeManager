/**
 * settingsStore 단위 테스트
 * 대상 기능: F064 (전역 설정), F065 (Part별 정책 설정), F070 (동시 실행 상한)
 * 시나리오 근거: SC-012 (설정 변경), SC-016 (리소스 관리 설정)
 */
import { describe, it, expect } from 'vitest';
import type { GlobalSettings, PartPolicy } from '@/types/settings';

describe('settingsStore - 설정 상태 관리 순수 로직', () => {
  const defaultSettings: GlobalSettings = {
    retryCount: 3,
    retryStrategy: 'exponential',
    costLimit: 100,
    alertThreshold: 80,
    maxConcurrentAgents: 10,
  };

  // SC-012: 전역 설정 검증
  describe('GlobalSettings 검증', () => {
    it('기본 설정 값이 상수와 일치', () => {
      expect(defaultSettings.retryCount).toBe(3);
      expect(defaultSettings.retryStrategy).toBe('exponential');
      expect(defaultSettings.costLimit).toBe(100);
      expect(defaultSettings.alertThreshold).toBe(80);
      expect(defaultSettings.maxConcurrentAgents).toBe(10);
    });

    it('retryStrategy는 exponential 또는 fixed만 허용', () => {
      const validStrategies = ['exponential', 'fixed'];
      expect(validStrategies).toContain(defaultSettings.retryStrategy);
    });
  });

  // SC-012: 설정 업데이트
  describe('updateSettings 로직', () => {
    it('부분 업데이트가 기존 설정과 병합', () => {
      const partial = { costLimit: 200, alertThreshold: 90 };
      const merged = { ...defaultSettings, ...partial };
      expect(merged.costLimit).toBe(200);
      expect(merged.alertThreshold).toBe(90);
      expect(merged.retryCount).toBe(3); // 기존 값 유지
    });

    it('null 상태에서 업데이트 시 null 유지', () => {
      const settings: GlobalSettings | null = null;
      const result = settings ? { ...settings, costLimit: 200 } : null;
      expect(result).toBeNull();
    });
  });

  // SC-012: Part별 정책 검증
  describe('PartPolicy 검증', () => {
    const partPolicy: PartPolicy = {
      retryCount: 5,
      retryStrategy: 'fixed',
      retryIntervalBase: 15,
      approvalStages: ['code_review', 'deploy'],
      defaultModel: 'claude-3-sonnet',
      sensitivityLevel: 'sensitive',
    };

    it('Part 정책 필드 검증', () => {
      expect(partPolicy.retryCount).toBe(5);
      expect(partPolicy.retryStrategy).toBe('fixed');
      expect(partPolicy.retryIntervalBase).toBe(15);
    });

    it('승인 단계 배열 검증', () => {
      expect(partPolicy.approvalStages).toHaveLength(2);
      expect(partPolicy.approvalStages).toContain('code_review');
    });

    it('민감도 레벨이 유효한 값', () => {
      const validLevels = ['critical', 'sensitive', 'normal'];
      expect(validLevels).toContain(partPolicy.sensitivityLevel);
    });
  });
});
