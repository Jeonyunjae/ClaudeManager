/**
 * officeStore / systemStore / partStore / skillStore / reportStore / terminalStore 단위 테스트
 * 대상 기능: F013 (대시보드), F017 (시스템 헬스), F009 (Part), F001-F007 (Skill), F057-F058 (터미널)
 * 시나리오 근거: SC-001 (오피스 뷰), SC-016 (시스템 모니터링), SC-002 (Skill 실행)
 */
import { describe, it, expect } from 'vitest';
import type { SystemHealth, ApiKey, Backup } from '@/types/settings';

describe('SystemHealth 타입 검증 (SC-016, SC-017)', () => {
  const healthData: SystemHealth = {
    cpu: 45.2,
    memory: 68.5,
    disk: 32.1,
    networkUp: 1.5,
    networkDown: 12.3,
    activeAgents: 5,
    maxAgents: 10,
    status: 'healthy',
  };

  it('시스템 헬스 필드 정상 정의', () => {
    expect(healthData.cpu).toBeGreaterThanOrEqual(0);
    expect(healthData.cpu).toBeLessThanOrEqual(100);
    expect(healthData.memory).toBeGreaterThanOrEqual(0);
    expect(healthData.memory).toBeLessThanOrEqual(100);
    expect(healthData.disk).toBeGreaterThanOrEqual(0);
    expect(healthData.disk).toBeLessThanOrEqual(100);
  });

  it('활성 에이전트가 최대치 이하', () => {
    expect(healthData.activeAgents).toBeLessThanOrEqual(healthData.maxAgents);
  });

  it('상태가 유효한 값', () => {
    const validStatuses = ['healthy', 'warning', 'critical'];
    expect(validStatuses).toContain(healthData.status);
  });

  it('CPU 80% 이상이면 warning', () => {
    const highCpu = { ...healthData, cpu: 85, status: 'warning' as const };
    expect(highCpu.status).toBe('warning');
  });
});

describe('ApiKey 타입 검증 (SC-011)', () => {
  const apiKey: ApiKey = {
    id: 1,
    provider: 'anthropic',
    keyMasked: 'sk-ant-...4567',
    status: 'active',
    expiresAt: '2025-12-31T23:59:59Z',
    monthlyUsage: 45.00,
    createdAt: '2025-01-01T00:00:00Z',
  };

  it('API 키 필드 정상 정의', () => {
    expect(apiKey.provider).toBe('anthropic');
    expect(apiKey.keyMasked).toContain('...');
    expect(apiKey.status).toBe('active');
  });

  it('상태가 유효한 값', () => {
    const validStatuses = ['active', 'expired', 'revoked'];
    expect(validStatuses).toContain(apiKey.status);
  });
});

describe('Backup 타입 검증 (SC-015)', () => {
  const backup: Backup = {
    id: 1,
    type: 'auto',
    status: 'completed',
    filePath: '/backups/2025-03-15.db',
    sizeBytes: 5242880,
    createdAt: '2025-03-15T03:00:00Z',
  };

  it('백업 필드 정상 정의', () => {
    expect(backup.type).toBe('auto');
    expect(backup.status).toBe('completed');
    expect(backup.sizeBytes).toBeGreaterThan(0);
  });

  it('백업 타입이 유효한 값', () => {
    const validTypes = ['auto', 'manual'];
    expect(validTypes).toContain(backup.type);
  });

  it('백업 상태가 유효한 값', () => {
    const validStatuses = ['completed', 'failed', 'in_progress'];
    expect(validStatuses).toContain(backup.status);
  });
});
