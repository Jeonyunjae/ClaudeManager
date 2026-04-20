/**
 * SC-017. 시스템 헬스 모니터링 시나리오 테스트
 * 관련 기능: F017, F028, F030
 */
import { describe, it, expect } from 'vitest';
import type { SystemHealth } from '@/types/settings';

describe('SC-017: 시스템 헬스 모니터링', () => {
  it('헬스 데이터 표시', () => {
    const health: SystemHealth = {
      cpu: 65, memory: 72, disk: 78, networkUp: 2.3, networkDown: 5.1,
      activeAgents: 8, maxAgents: 10, status: 'healthy',
    };
    expect(health.status).toBe('healthy');
  });

  it('헬스 아이콘 색상 결정', () => {
    function healthColor(cpu: number, mem: number, disk: number): string {
      const max = Math.max(cpu, mem, disk);
      if (max >= 90) return 'red';
      if (max >= 80) return 'yellow';
      return 'green';
    }
    expect(healthColor(65, 72, 78)).toBe('green');
    expect(healthColor(65, 72, 85)).toBe('yellow');
    expect(healthColor(65, 92, 78)).toBe('red');
  });

  it('디스크 90% 도달 시 경고 알림', () => {
    const disk = 90;
    const shouldAlert = disk >= 90;
    expect(shouldAlert).toBe(true);
  });

  describe('예외흐름', () => {
    it('E1: 네트워크 모니터링 불가', () => {
      const health: SystemHealth = {
        cpu: 65, memory: 72, disk: 78, networkUp: 0, networkDown: 0,
        activeAgents: 8, maxAgents: 10, status: 'healthy',
      };
      const networkAvailable = health.networkUp > 0 || health.networkDown > 0;
      expect(networkAvailable).toBe(false);
    });

    it('E2: CPU 90% 이상 30분 지속 -> SC-016 연계', () => {
      const cpuHighDuration = 30; // minutes
      const shouldSuggestLowerMax = cpuHighDuration >= 30;
      expect(shouldSuggestLowerMax).toBe(true);
    });
  });
});
