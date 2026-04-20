/**
 * Integration Test: DB <-> API Cost Flow
 *
 * 검증 범위:
 * - 비용 레코드 삽입 -> 모델별 집계 -> 키별 집계 -> 추이 검증
 * - 비용 한도 설정 -> 임계값 초과 여부 검증
 *
 * 관련 기능: F016 (비용 대시보드), F031 (비용 임계값 알림), F046 (토큰/비용 수집)
 * 시나리오: SC-007 (비용 모니터링)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDB, closeTestDB, type TestDB } from './helpers/test-db';
import Database from 'better-sqlite3';
import { parts, agents, projects, apiKeys, costRecords, settings } from '@/lib/schema';
import { encrypt, maskApiKey } from '@/lib/crypto';
import { eq, sql, gte } from 'drizzle-orm';

describe('Integration: DB <-> API Cost Flow', () => {
  let db: TestDB;
  let sqlite: InstanceType<typeof Database>;

  beforeAll(async () => {
    const result = createTestDB();
    db = result.db;
    sqlite = result.sqlite;

    // Seed: Part, Agent, Project, API Key
    await db.insert(parts).values({
      id: 'part-pm',
      name: '프로젝트관리부',
      skillName: 'project-part',
      skillVersion: '1.0.0',
    });
    await db.insert(agents).values([
      { id: 'inst-001', name: '개발자A', role: 'instance', partId: 'part-pm' },
      { id: 'inst-002', name: '개발자B', role: 'instance', partId: 'part-pm' },
    ]);
    await db.insert(projects).values({
      id: 'proj-001',
      name: '할일관리앱',
      partId: 'part-pm',
    });

    const { encrypted, iv, tag } = encrypt('sk-test-key');
    db.insert(apiKeys).values({
      provider: 'anthropic',
      keyEncrypted: encrypted,
      keyIv: iv,
      keyTag: tag,
      keyMasked: maskApiKey('sk-test-key'),
      status: 'active',
    }).run();
  });

  afterAll(() => {
    closeTestDB(sqlite);
  });

  // === 비용 레코드 삽입 ===

  it('INT-COST-001: 비용 레코드 여러 건 삽입', async () => {
    const now = new Date().toISOString();

    await db.insert(costRecords).values([
      {
        agentId: 'inst-001',
        apiKeyId: 1,
        modelName: 'claude-3-opus',
        inputTokens: 5000,
        outputTokens: 2000,
        cost: 0.15,
        projectId: 'proj-001',
        createdAt: now,
      },
      {
        agentId: 'inst-001',
        apiKeyId: 1,
        modelName: 'claude-3-sonnet',
        inputTokens: 10000,
        outputTokens: 3000,
        cost: 0.05,
        projectId: 'proj-001',
        createdAt: now,
      },
      {
        agentId: 'inst-002',
        apiKeyId: 1,
        modelName: 'claude-3-opus',
        inputTokens: 8000,
        outputTokens: 4000,
        cost: 0.24,
        projectId: 'proj-001',
        createdAt: now,
      },
      {
        agentId: 'inst-002',
        apiKeyId: 1,
        modelName: 'claude-3-haiku',
        inputTokens: 20000,
        outputTokens: 5000,
        cost: 0.01,
        projectId: 'proj-001',
        createdAt: now,
      },
    ]);

    const records = db.select().from(costRecords).all();
    expect(records.length).toBe(4);
  });

  // === 집계 검증 ===

  it('INT-COST-002: 총 비용 합계 계산', () => {
    const result = db.select({
      totalCost: sql<number>`COALESCE(SUM(cost), 0)`,
    }).from(costRecords).get();

    expect(result!.totalCost).toBeCloseTo(0.45, 2);
  });

  it('INT-COST-003: 모델별 비용 집계', () => {
    const modelBreakdown = db.select({
      model: costRecords.modelName,
      cost: sql<number>`COALESCE(SUM(cost), 0)`,
    })
      .from(costRecords)
      .groupBy(costRecords.modelName)
      .all();

    expect(modelBreakdown.length).toBe(3);

    const opusCost = modelBreakdown.find(m => m.model === 'claude-3-opus');
    expect(opusCost!.cost).toBeCloseTo(0.39, 2);

    const sonnetCost = modelBreakdown.find(m => m.model === 'claude-3-sonnet');
    expect(sonnetCost!.cost).toBeCloseTo(0.05, 2);

    const haikuCost = modelBreakdown.find(m => m.model === 'claude-3-haiku');
    expect(haikuCost!.cost).toBeCloseTo(0.01, 2);
  });

  it('INT-COST-004: 모델별 비율 계산', () => {
    const totalResult = db.select({
      totalCost: sql<number>`COALESCE(SUM(cost), 0)`,
    }).from(costRecords).get();
    const totalCost = totalResult!.totalCost;

    const modelBreakdown = db.select({
      model: costRecords.modelName,
      cost: sql<number>`COALESCE(SUM(cost), 0)`,
    })
      .from(costRecords)
      .groupBy(costRecords.modelName)
      .all()
      .map(row => ({
        ...row,
        percentage: totalCost > 0 ? Math.round((row.cost / totalCost) * 100) : 0,
      }));

    const opus = modelBreakdown.find(m => m.model === 'claude-3-opus');
    expect(opus!.percentage).toBeGreaterThan(80); // 0.39/0.45 = ~87%
  });

  it('INT-COST-005: 키별 비용 집계', () => {
    const keyBreakdown = db.select({
      apiKeyId: costRecords.apiKeyId,
      cost: sql<number>`COALESCE(SUM(cost), 0)`,
    })
      .from(costRecords)
      .groupBy(costRecords.apiKeyId)
      .all();

    expect(keyBreakdown.length).toBe(1);
    expect(keyBreakdown[0].apiKeyId).toBe(1);
    expect(keyBreakdown[0].cost).toBeCloseTo(0.45, 2);
  });

  it('INT-COST-006: 토큰 총 사용량 집계', () => {
    const result = db.select({
      totalInput: sql<number>`COALESCE(SUM(input_tokens), 0)`,
      totalOutput: sql<number>`COALESCE(SUM(output_tokens), 0)`,
    }).from(costRecords).get();

    expect(result!.totalInput).toBe(43000);
    expect(result!.totalOutput).toBe(14000);
  });

  // === 비용 한도/임계값 ===

  it('INT-COST-007: 비용 한도 설정 저장', async () => {
    await db.insert(settings).values([
      { key: 'cost_limit', value: '100' },
      { key: 'alert_threshold', value: '80' },
    ]);

    const costLimit = db.select().from(settings).where(eq(settings.key, 'cost_limit')).get();
    expect(costLimit!.value).toBe('100');
  });

  it('INT-COST-008: 한도 대비 사용률 계산', () => {
    const totalResult = db.select({
      totalCost: sql<number>`COALESCE(SUM(cost), 0)`,
    }).from(costRecords).get();

    const costLimitSetting = db.select().from(settings).where(eq(settings.key, 'cost_limit')).get();
    const costLimit = parseFloat(costLimitSetting!.value);

    const percentage = Math.round((totalResult!.totalCost / costLimit) * 100);
    expect(percentage).toBeLessThan(1); // 0.45/100 = 0.45%
  });

  it('INT-COST-009: 비용이 0일 때 안전한 비율 계산', () => {
    const costLimit = 0;
    const totalCost = 10;
    const percentage = costLimit > 0 ? Math.round((totalCost / costLimit) * 100) : 0;
    expect(percentage).toBe(0);
  });

  it('INT-COST-010: 에이전트별 비용 집계', () => {
    const agentCosts = db.select({
      agentId: costRecords.agentId,
      totalCost: sql<number>`COALESCE(SUM(cost), 0)`,
    })
      .from(costRecords)
      .groupBy(costRecords.agentId)
      .all();

    expect(agentCosts.length).toBe(2);
    const inst001 = agentCosts.find(a => a.agentId === 'inst-001');
    expect(inst001!.totalCost).toBeCloseTo(0.20, 2);
    const inst002 = agentCosts.find(a => a.agentId === 'inst-002');
    expect(inst002!.totalCost).toBeCloseTo(0.25, 2);
  });
});
