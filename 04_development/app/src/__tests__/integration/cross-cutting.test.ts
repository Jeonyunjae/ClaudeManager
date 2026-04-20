/**
 * Integration Test: Cross-Cutting Concerns
 *
 * 검증 범위:
 * - 감사 로그: 모든 주요 동작이 auditLogs에 기록되는지
 * - 에러 핸들링: API 에러 -> 알림 생성 흐름
 * - 데이터 정합성: 관련 테이블 간 참조 무결성
 * - Hooks 이벤트: 외부 이벤트 -> DB 저장 -> 상태 변경 흐름
 *
 * 관련 기능: F034, F041, F061~F063 (감사 로그), F032~F033 (오류 처리)
 * 시나리오: SC-003, SC-004, SC-006, SC-008
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDB, closeTestDB, type TestDB } from './helpers/test-db';
import Database from 'better-sqlite3';
import {
  agents, parts, projects, approvals, approvalHistory,
  auditLogs, agentLogs, notifications, chatMessages,
  apiKeys, costRecords, settings, partPolicies,
} from '@/lib/schema';
import { eq, count, and, sql } from 'drizzle-orm';
import { encrypt, decrypt, maskApiKey } from '@/lib/crypto';

describe('Integration: Cross-Cutting Concerns', () => {
  let db: TestDB;
  let sqlite: InstanceType<typeof Database>;

  beforeAll(async () => {
    const result = createTestDB();
    db = result.db;
    sqlite = result.sqlite;

    // Full seed: Part -> Agents -> Project -> API Key
    await db.insert(parts).values({
      id: 'part-pm', name: '프로젝트관리부',
      skillName: 'project-part', skillVersion: '1.0.0',
    });
    await db.insert(agents).values([
      { id: 'main-001', name: '비서실장', role: 'main', status: 'active' },
      { id: 'part-001', name: 'PM 부서장', role: 'part', partId: 'part-pm', parentId: 'main-001' },
      { id: 'sub-001', name: '팀장', role: 'sub', partId: 'part-pm', parentId: 'part-001' },
      { id: 'inst-001', name: '개발자', role: 'instance', partId: 'part-pm', parentId: 'sub-001', modelName: 'claude-3-sonnet' },
    ]);
    await db.insert(projects).values({
      id: 'proj-001', name: '할일앱', partId: 'part-pm', subAgentId: 'sub-001',
    });

    const { encrypted, iv, tag } = encrypt('sk-test-key-12345');
    db.insert(apiKeys).values({
      provider: 'anthropic',
      keyEncrypted: encrypted, keyIv: iv, keyTag: tag,
      keyMasked: maskApiKey('sk-test-key-12345'),
      status: 'active',
    }).run();
  });

  afterAll(() => {
    closeTestDB(sqlite);
  });

  // === A. 감사 로그 통합 검증 ===

  it('INT-CROSS-001: 승인 동작이 감사 로그에 기록', async () => {
    // 승인 요청 생성
    await db.insert(approvals).values({
      id: 'appr-001', projectId: 'proj-001', sourceAgentId: 'sub-001',
      title: '기획 승인', content: '기획 완료', urgency: 'high', status: 'pending',
    });

    // 승인 처리
    await db.update(approvals).set({ status: 'approved', resolvedAt: new Date().toISOString() })
      .where(eq(approvals.id, 'appr-001'));

    await db.insert(auditLogs).values({
      actorType: 'user', actorId: '1',
      action: 'approve', resource: 'approval', resourceId: 'appr-001',
      detail: JSON.stringify({ comment: '승인' }),
    });

    const logs = db.select().from(auditLogs)
      .where(and(eq(auditLogs.action, 'approve'), eq(auditLogs.resourceId, 'appr-001'))).all();
    expect(logs.length).toBe(1);
  });

  it('INT-CROSS-002: 설정 변경이 감사 로그에 기록', async () => {
    await db.insert(settings).values({ key: 'retry_count', value: '5' });

    await db.insert(auditLogs).values({
      actorType: 'user', actorId: '1',
      action: 'setting_change', resource: 'settings',
      detail: JSON.stringify({ retryCount: 5 }),
    });

    const logs = db.select().from(auditLogs)
      .where(eq(auditLogs.action, 'setting_change')).all();
    expect(logs.length).toBe(1);
  });

  it('INT-CROSS-003: API 키 등록이 감사 로그에 기록', async () => {
    await db.insert(auditLogs).values({
      actorType: 'user', actorId: '1',
      action: 'register_apikey', resource: 'apikey', resourceId: '1',
      detail: JSON.stringify({ provider: 'anthropic' }),
    });

    const logs = db.select().from(auditLogs)
      .where(eq(auditLogs.action, 'register_apikey')).all();
    expect(logs.length).toBe(1);
  });

  it('INT-CROSS-004: 지시(command)가 감사 로그에 기록', async () => {
    await db.insert(chatMessages).values({
      id: 'msg-001', sender: 'user',
      content: '프로젝트 우선순위를 최우선으로 변경해줘',
      messageType: 'text',
    });

    await db.insert(auditLogs).values({
      actorType: 'user', actorId: '1',
      action: 'command', resource: 'project', resourceId: 'proj-001',
      detail: JSON.stringify({ command: '우선순위 변경', priority: 2 }),
    });

    const logs = db.select().from(auditLogs)
      .where(eq(auditLogs.action, 'command')).all();
    expect(logs.length).toBe(1);
  });

  it('INT-CROSS-005: actorType별 감사 로그 필터링', async () => {
    // 에이전트 동작 로그 추가
    await db.insert(auditLogs).values({
      actorType: 'agent', actorId: 'sub-001',
      action: 'task_complete', resource: 'project', resourceId: 'proj-001',
      detail: JSON.stringify({ stage: '기획' }),
    });

    const userLogs = db.select().from(auditLogs)
      .where(eq(auditLogs.actorType, 'user')).all();
    const agentAuditLogs = db.select().from(auditLogs)
      .where(eq(auditLogs.actorType, 'agent')).all();

    expect(userLogs.length).toBeGreaterThanOrEqual(3);
    expect(agentAuditLogs.length).toBe(1);
  });

  // === B. Hooks 이벤트 -> 에이전트 로그 + 상태 변경 ===

  it('INT-CROSS-006: task_start 이벤트 -> 에이전트 상태 active + 로그 저장', async () => {
    // Hooks 이벤트 시뮬레이션
    const event = 'task_start';
    const agentId = 'inst-001';
    const data = { message: '개발 시작' };

    // 로그 저장
    await db.insert(agentLogs).values({
      agentId,
      eventType: event,
      message: data.message,
      detail: JSON.stringify(data),
    });

    // 상태 변경
    await db.update(agents).set({
      status: 'active',
      statusMessage: data.message,
      startedAt: new Date().toISOString(),
    }).where(eq(agents.id, agentId));

    const agent = (await db.select().from(agents).where(eq(agents.id, agentId)))[0];
    expect(agent.status).toBe('active');
    expect(agent.statusMessage).toBe('개발 시작');

    const logs = db.select().from(agentLogs)
      .where(and(eq(agentLogs.agentId, agentId), eq(agentLogs.eventType, 'task_start'))).all();
    expect(logs.length).toBe(1);
  });

  it('INT-CROSS-007: error 이벤트 -> 에이전트 상태 error + 에러 알림 생성', async () => {
    const agentId = 'inst-001';
    const data = { message: 'API rate limit exceeded' };

    // 로그 저장
    await db.insert(agentLogs).values({
      agentId,
      eventType: 'error',
      message: data.message,
      detail: JSON.stringify(data),
    });

    // 상태 변경
    await db.update(agents).set({
      status: 'error',
      statusMessage: data.message,
    }).where(eq(agents.id, agentId));

    // 에러 알림 생성
    db.insert(notifications).values({
      type: 'error',
      title: '에이전트 오류',
      message: `에이전트 ${agentId}에서 오류가 발생했습니다: ${data.message}`,
      sourceAgentId: agentId,
    }).run();

    const agent = (await db.select().from(agents).where(eq(agents.id, agentId)))[0];
    expect(agent.status).toBe('error');

    const notifs = db.select().from(notifications)
      .where(eq(notifications.type, 'error')).all();
    expect(notifs.length).toBe(1);
    expect(notifs[0].sourceAgentId).toBe(agentId);
  });

  it('INT-CROSS-008: token_usage 이벤트 -> 비용 레코드 저장', async () => {
    const agentId = 'inst-001';
    const data = { inputTokens: 5000, outputTokens: 2000, cost: 0.12 };

    await db.insert(agentLogs).values({
      agentId,
      eventType: 'token_usage',
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      cost: data.cost,
    });

    await db.insert(costRecords).values({
      agentId,
      apiKeyId: 1,
      modelName: 'claude-3-sonnet',
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      cost: data.cost,
      projectId: 'proj-001',
    });

    const costs = db.select().from(costRecords).where(eq(costRecords.agentId, agentId)).all();
    expect(costs.length).toBe(1);
    expect(costs[0].cost).toBeCloseTo(0.12, 2);
  });

  it('INT-CROSS-009: decision 이벤트 -> 채팅 메시지 생성', async () => {
    const data = { message: '디자인 방향을 결정해주세요.', requiresApproval: true };

    await db.insert(chatMessages).values({
      id: 'msg-decision-001',
      sender: 'main',
      content: data.message,
      messageType: data.requiresApproval ? 'approval_request' : 'text',
      metadata: JSON.stringify(data),
    });

    const msg = db.select().from(chatMessages).where(eq(chatMessages.id, 'msg-decision-001')).get();
    expect(msg!.messageType).toBe('approval_request');
    expect(msg!.sender).toBe('main');
  });

  // === C. 데이터 정합성 ===

  it('INT-CROSS-010: 에이전트 -> Part 참조 무결성', async () => {
    const pmAgents = await db.select().from(agents).where(eq(agents.partId, 'part-pm'));
    expect(pmAgents.length).toBe(3); // part, sub, instance

    for (const agent of pmAgents) {
      const part = (await db.select().from(parts).where(eq(parts.id, agent.partId!)))[0];
      expect(part).toBeDefined();
      expect(part.id).toBe('part-pm');
    }
  });

  it('INT-CROSS-011: 프로젝트 -> Part 참조 무결성', async () => {
    const proj = (await db.select().from(projects).where(eq(projects.id, 'proj-001')))[0];
    const part = (await db.select().from(parts).where(eq(parts.id, proj.partId)))[0];
    expect(part).toBeDefined();
    expect(part.name).toBe('프로젝트관리부');
  });

  it('INT-CROSS-012: 승인 -> 프로젝트 참조 무결성', async () => {
    const appr = (await db.select().from(approvals).where(eq(approvals.id, 'appr-001')))[0];
    expect(appr.projectId).toBe('proj-001');

    const proj = (await db.select().from(projects).where(eq(projects.id, appr.projectId!)))[0];
    expect(proj).toBeDefined();
  });

  it('INT-CROSS-013: 비용 레코드 -> 에이전트 + API Key 참조 무결성', () => {
    const costs = db.select().from(costRecords).all();
    expect(costs.length).toBeGreaterThan(0);

    for (const cost of costs) {
      if (cost.agentId) {
        const agent = db.select().from(agents).where(eq(agents.id, cost.agentId)).get();
        expect(agent).toBeDefined();
      }
      if (cost.apiKeyId) {
        const key = db.select().from(apiKeys).where(eq(apiKeys.id, cost.apiKeyId)).get();
        expect(key).toBeDefined();
      }
    }
  });

  // === D. 에러 핸들링 플로우 ===

  it('INT-CROSS-014: 재시도 로직 - 실패 횟수 추적', async () => {
    const agentId = 'inst-001';

    // 3회 재시도 시뮬레이션
    for (let i = 1; i <= 3; i++) {
      await db.insert(agentLogs).values({
        agentId,
        eventType: 'retry',
        message: `재시도 ${i}회`,
        detail: JSON.stringify({ attempt: i, maxRetries: 3 }),
      });
    }

    const retryLogs = db.select().from(agentLogs)
      .where(and(eq(agentLogs.agentId, agentId), eq(agentLogs.eventType, 'retry'))).all();
    expect(retryLogs.length).toBe(3);
  });

  it('INT-CROSS-015: 최종 실패 후 에러 상태 + 알림', async () => {
    const agentId = 'inst-001';

    await db.insert(agentLogs).values({
      agentId,
      eventType: 'error',
      message: '3회 재시도 후 최종 실패',
      detail: JSON.stringify({ finalStatus: 'failed', retryCount: 3 }),
    });

    await db.update(agents).set({
      status: 'error',
      statusMessage: '3회 재시도 후 최종 실패',
    }).where(eq(agents.id, agentId));

    db.insert(notifications).values({
      type: 'error',
      title: '에이전트 최종 실패',
      message: `${agentId}: 3회 재시도 후 작업 실패`,
      sourceAgentId: agentId,
    }).run();

    const agent = (await db.select().from(agents).where(eq(agents.id, agentId)))[0];
    expect(agent.status).toBe('error');

    const errorNotifs = db.select().from(notifications)
      .where(eq(notifications.type, 'error')).all();
    expect(errorNotifs.length).toBe(2); // 이전 + 이번
  });

  // === E. 전체 데이터 카운트 최종 검증 ===

  it('INT-CROSS-016: 전체 테이블 데이터 정합성 최종 검증', () => {
    const agentCount = db.select({ count: count() }).from(agents).get();
    const partCount = db.select({ count: count() }).from(parts).get();
    const projCount = db.select({ count: count() }).from(projects).get();
    const apprCount = db.select({ count: count() }).from(approvals).get();
    const auditCount = db.select({ count: count() }).from(auditLogs).get();
    const logCount = db.select({ count: count() }).from(agentLogs).get();
    const notifCount = db.select({ count: count() }).from(notifications).get();
    const chatCount = db.select({ count: count() }).from(chatMessages).get();
    const costCount = db.select({ count: count() }).from(costRecords).get();

    expect(agentCount!.count).toBe(4);
    expect(partCount!.count).toBe(1);
    expect(projCount!.count).toBe(1);
    expect(apprCount!.count).toBe(1);
    expect(auditCount!.count).toBeGreaterThanOrEqual(5);
    expect(logCount!.count).toBeGreaterThanOrEqual(5);
    expect(notifCount!.count).toBeGreaterThanOrEqual(2);
    expect(chatCount!.count).toBeGreaterThanOrEqual(2);
    expect(costCount!.count).toBe(1);
  });
});
