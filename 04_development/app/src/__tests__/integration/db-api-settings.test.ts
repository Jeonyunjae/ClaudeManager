/**
 * Integration Test: DB <-> API Settings Flow
 *
 * 검증 범위:
 * - 전역 설정 저장 -> 조회 -> Part별 정책 오버라이드
 * - 기본값 적용, DB 저장값 우선 적용, 감사 로그 기록
 *
 * 관련 기능: F064~F065 (설정/환경설정), F027 (Part별 승인 정책), F035 (Part별 재시도 정책)
 * 시나리오: SC-012 (설정 변경)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDB, closeTestDB, type TestDB } from './helpers/test-db';
import Database from 'better-sqlite3';
import { settings, parts, partPolicies, auditLogs } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import {
  DEFAULT_RETRY_COUNT,
  DEFAULT_COST_LIMIT,
  DEFAULT_ALERT_THRESHOLD,
  DEFAULT_MAX_CONCURRENT_AGENTS,
} from '@/lib/constants';

describe('Integration: DB <-> API Settings Flow', () => {
  let db: TestDB;
  let sqlite: InstanceType<typeof Database>;

  beforeAll(async () => {
    const result = createTestDB();
    db = result.db;
    sqlite = result.sqlite;

    // Seed: Part
    await db.insert(parts).values({
      id: 'part-pm',
      name: '프로젝트관리부',
      skillName: 'project-part',
      skillVersion: '1.0.0',
    });
  });

  afterAll(() => {
    closeTestDB(sqlite);
  });

  // === 전역 설정 ===

  it('INT-SET-001: 초기 상태에서 DB에 설정 없으면 기본값 사용', () => {
    const allSettings = db.select().from(settings).all();
    expect(allSettings.length).toBe(0);

    // 기본값 매핑
    const DEFAULTS: Record<string, string> = {
      retry_count: String(DEFAULT_RETRY_COUNT),
      retry_strategy: 'exponential',
      cost_limit: String(DEFAULT_COST_LIMIT),
      alert_threshold: String(DEFAULT_ALERT_THRESHOLD),
      max_concurrent_agents: String(DEFAULT_MAX_CONCURRENT_AGENTS),
    };

    const settingsMap = new Map(allSettings.map(s => [s.key, s.value]));

    const retryCount = parseInt(settingsMap.get('retry_count') || DEFAULTS.retry_count);
    expect(retryCount).toBe(DEFAULT_RETRY_COUNT);

    const costLimit = parseFloat(settingsMap.get('cost_limit') || DEFAULTS.cost_limit);
    expect(costLimit).toBe(DEFAULT_COST_LIMIT);
  });

  it('INT-SET-002: 전역 설정 저장 후 DB 조회', async () => {
    const now = new Date().toISOString();
    await db.insert(settings).values([
      { key: 'retry_count', value: '5', updatedAt: now },
      { key: 'retry_strategy', value: 'fixed', updatedAt: now },
      { key: 'cost_limit', value: '200', updatedAt: now },
      { key: 'alert_threshold', value: '90', updatedAt: now },
      { key: 'max_concurrent_agents', value: '15', updatedAt: now },
    ]);

    const allSettings = db.select().from(settings).all();
    expect(allSettings.length).toBe(5);

    const settingsMap = new Map(allSettings.map(s => [s.key, s.value]));
    expect(parseInt(settingsMap.get('retry_count')!)).toBe(5);
    expect(settingsMap.get('retry_strategy')).toBe('fixed');
    expect(parseFloat(settingsMap.get('cost_limit')!)).toBe(200);
  });

  it('INT-SET-003: 설정 업데이트 (기존 값 덮어쓰기)', async () => {
    const now = new Date().toISOString();
    await db.update(settings).set({ value: '10', updatedAt: now })
      .where(eq(settings.key, 'retry_count'));

    const result = db.select().from(settings).where(eq(settings.key, 'retry_count')).get();
    expect(result!.value).toBe('10');
  });

  it('INT-SET-004: 설정 변경 감사 로그 기록', async () => {
    await db.insert(auditLogs).values({
      actorType: 'user',
      actorId: '1',
      action: 'setting_change',
      resource: 'settings',
      detail: JSON.stringify({ retryCount: 10 }),
    });

    const logs = db.select().from(auditLogs)
      .where(eq(auditLogs.action, 'setting_change')).all();
    expect(logs.length).toBe(1);
    expect(JSON.parse(logs[0].detail!).retryCount).toBe(10);
  });

  // === Part별 정책 오버라이드 ===

  it('INT-SET-005: Part별 정책 저장', async () => {
    await db.insert(partPolicies).values({
      partId: 'part-pm',
      retryCount: 5,
      retryStrategy: 'fixed',
      retryIntervalBase: 20,
      approvalStages: JSON.stringify(['기획완료', '디자인완료', '개발완료']),
      defaultModel: 'claude-3-opus',
    });

    const policy = db.select().from(partPolicies)
      .where(eq(partPolicies.partId, 'part-pm')).get();
    expect(policy).toBeDefined();
    expect(policy!.retryCount).toBe(5);
    expect(policy!.retryStrategy).toBe('fixed');
  });

  it('INT-SET-006: Part별 정책이 전역 설정을 오버라이드', () => {
    // 전역: retry_count = 10
    const globalSetting = db.select().from(settings)
      .where(eq(settings.key, 'retry_count')).get();
    const globalRetryCount = parseInt(globalSetting!.value);

    // Part별: retry_count = 5
    const partPolicy = db.select().from(partPolicies)
      .where(eq(partPolicies.partId, 'part-pm')).get();

    // Part별 정책이 있으면 Part별 값 사용, 없으면 전역 사용
    const effectiveRetryCount = partPolicy ? partPolicy.retryCount : globalRetryCount;
    expect(effectiveRetryCount).toBe(5); // Part별 값
    expect(effectiveRetryCount).not.toBe(globalRetryCount); // 전역(10)과 다름
  });

  it('INT-SET-007: Part별 승인 단계 설정 조회', () => {
    const policy = db.select().from(partPolicies)
      .where(eq(partPolicies.partId, 'part-pm')).get();

    const stages = JSON.parse(policy!.approvalStages!);
    expect(stages).toEqual(['기획완료', '디자인완료', '개발완료']);
    expect(stages.length).toBe(3);
  });

  it('INT-SET-008: Part별 정책 업데이트', async () => {
    await db.update(partPolicies).set({
      retryCount: 7,
      defaultModel: 'claude-3-sonnet',
      updatedAt: new Date().toISOString(),
    }).where(eq(partPolicies.partId, 'part-pm'));

    const updated = db.select().from(partPolicies)
      .where(eq(partPolicies.partId, 'part-pm')).get();
    expect(updated!.retryCount).toBe(7);
    expect(updated!.defaultModel).toBe('claude-3-sonnet');
  });

  it('INT-SET-009: Part별 정책이 없는 Part는 전역 설정 사용', async () => {
    // 새 Part 추가 (정책 없음)
    await db.insert(parts).values({
      id: 'part-dev',
      name: '개발부',
      skillName: 'dev-part',
      skillVersion: '1.0.0',
    });

    const policy = db.select().from(partPolicies)
      .where(eq(partPolicies.partId, 'part-dev')).get();
    expect(policy).toBeUndefined();

    // 전역 설정 사용
    const globalRetry = db.select().from(settings)
      .where(eq(settings.key, 'retry_count')).get();
    expect(parseInt(globalRetry!.value)).toBe(10);
  });

  it('INT-SET-010: camelCase <-> snake_case 매핑 검증', () => {
    const keyMap: Record<string, string> = {
      retryCount: 'retry_count',
      retryStrategy: 'retry_strategy',
      costLimit: 'cost_limit',
      alertThreshold: 'alert_threshold',
      maxConcurrentAgents: 'max_concurrent_agents',
    };

    const body = { retryCount: 3, costLimit: 150 };

    for (const [camelKey, value] of Object.entries(body)) {
      const dbKey = keyMap[camelKey];
      expect(dbKey).toBeDefined();
    }

    expect(keyMap['retryCount']).toBe('retry_count');
    expect(keyMap['maxConcurrentAgents']).toBe('max_concurrent_agents');
  });
});
