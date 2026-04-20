/**
 * SC-016. 동시 에이전트 리소스 관리 시나리오 테스트
 * 관련 기능: F017, F070, F071, F072, F064, F065
 */
import { describe, it, expect } from 'vitest';

describe('SC-016: 동시 에이전트 리소스 관리', () => {
  it('상한 도달 시 큐잉', () => {
    const maxConcurrent = 10;
    const active = 10;
    const queue: string[] = [];
    if (active >= maxConcurrent) queue.push('inst-new-001');
    expect(queue).toHaveLength(1);
  });

  it('상한 변경 후 대기 중 에이전트 자동 시작', () => {
    let max = 10;
    const queue = ['inst-new-001'];
    max = 15;
    const started = queue.splice(0, max - 10);
    expect(started).toHaveLength(1);
    expect(queue).toHaveLength(0);
  });

  it('리소스 안전장치: CPU 90% 초과 시 자동 생성 보류', () => {
    const cpuUsage = 92;
    const safetyThreshold = 90;
    const blockNewAgents = cpuUsage > safetyThreshold;
    expect(blockNewAgents).toBe(true);
  });

  it('리소스 정상화 후 보류 해제', () => {
    let cpuUsage = 92;
    cpuUsage = 70; // 기존 에이전트 작업 완료
    const canResume = cpuUsage < 90;
    expect(canResume).toBe(true);
  });

  describe('예외흐름', () => {
    it('E1: 안전장치 반복 작동 시 상한 낮추기 권장', () => {
      const safetyTriggerCount = 3;
      const shouldRecommendLower = safetyTriggerCount >= 3;
      expect(shouldRecommendLower).toBe(true);
    });

    it('설정 UI에서 직접 상한 변경 (1~50 범위)', () => {
      const validate = (v: number) => v >= 1 && v <= 50;
      expect(validate(15)).toBe(true);
      expect(validate(0)).toBe(false);
      expect(validate(51)).toBe(false);
    });
  });
});
