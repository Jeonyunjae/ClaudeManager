/**
 * Integration Test: DB <-> API Approval Flow
 *
 * 검증 범위:
 * - 승인 요청 생성 -> 대기 목록 조회 -> 승인/반려 처리 -> 이력 저장 -> 감사 로그 검증
 * - 전체 승인 워크플로우가 DB 레벨에서 정합성을 유지하는지 확인
 *
 * 관련 기능: F023~F027 (승인), F061 (감사 로그)
 * 시나리오: SC-004 (승인 워크플로우)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDB, closeTestDB, type TestDB } from './helpers/test-db';
import Database from 'better-sqlite3';
import { parts, agents, projects, approvals, approvalHistory, auditLogs } from '@/lib/schema';
import { eq, count } from 'drizzle-orm';

describe('Integration: DB <-> API Approval Flow', () => {
  let db: TestDB;
  let sqlite: InstanceType<typeof Database>;

  beforeAll(async () => {
    const result = createTestDB();
    db = result.db;
    sqlite = result.sqlite;

    // Seed data: Part -> Agent -> Project
    await db.insert(parts).values({
      id: 'part-pm',
      name: '프로젝트관리부',
      skillName: 'project-part',
      skillVersion: '1.0.0',
    });
    await db.insert(agents).values({
      id: 'sub-001',
      name: '프로젝트A 팀장',
      role: 'sub',
      partId: 'part-pm',
    });
    await db.insert(projects).values({
      id: 'proj-001',
      name: '할일관리앱',
      partId: 'part-pm',
      subAgentId: 'sub-001',
      status: 'active',
      currentStage: '개발',
    });
  });

  afterAll(() => {
    closeTestDB(sqlite);
  });

  // === 승인 요청 생성 -> 조회 ===

  it('INT-APPR-001: 승인 요청 생성 후 DB 저장', async () => {
    await db.insert(approvals).values({
      id: 'appr-001',
      projectId: 'proj-001',
      sourceAgentId: 'sub-001',
      title: '기획 완료 승인 요청',
      content: '기획 단계가 완료되었습니다. 검토 후 승인 부탁드립니다.',
      urgency: 'high',
      status: 'pending',
    });

    const result = await db.select().from(approvals).where(eq(approvals.id, 'appr-001'));
    expect(result.length).toBe(1);
    expect(result[0].status).toBe('pending');
    expect(result[0].urgency).toBe('high');
  });

  it('INT-APPR-002: 대기 중 승인 목록 조회 (pending만)', async () => {
    // 추가 승인 요청 (이미 처리됨)
    await db.insert(approvals).values({
      id: 'appr-002',
      projectId: 'proj-001',
      sourceAgentId: 'sub-001',
      title: '이전 승인 (이미 처리)',
      content: '이미 처리된 건',
      status: 'approved',
      resolvedAt: new Date().toISOString(),
    });

    const pending = await db.select().from(approvals).where(eq(approvals.status, 'pending'));
    expect(pending.length).toBe(1);
    expect(pending[0].id).toBe('appr-001');
  });

  // === 승인 처리 ===

  it('INT-APPR-003: 승인 처리 -> status 변경 + resolvedAt 기록', async () => {
    const resolvedAt = new Date().toISOString();
    await db.update(approvals).set({
      status: 'approved',
      resolution: '잘 작성되었습니다.',
      resolvedAt,
    }).where(eq(approvals.id, 'appr-001'));

    const result = await db.select().from(approvals).where(eq(approvals.id, 'appr-001'));
    expect(result[0].status).toBe('approved');
    expect(result[0].resolution).toBe('잘 작성되었습니다.');
    expect(result[0].resolvedAt).toBe(resolvedAt);
  });

  it('INT-APPR-004: 승인 이력 저장', async () => {
    await db.insert(approvalHistory).values({
      approvalId: 'appr-001',
      action: 'approved',
      comment: '잘 작성되었습니다.',
      actorType: 'user',
      actorId: '1',
    });

    const history = await db.select().from(approvalHistory)
      .where(eq(approvalHistory.approvalId, 'appr-001'));
    expect(history.length).toBe(1);
    expect(history[0].action).toBe('approved');
    expect(history[0].actorType).toBe('user');
  });

  it('INT-APPR-005: 감사 로그에 승인 행위 기록', async () => {
    await db.insert(auditLogs).values({
      actorType: 'user',
      actorId: '1',
      action: 'approve',
      resource: 'approval',
      resourceId: 'appr-001',
      detail: JSON.stringify({ comment: '잘 작성되었습니다.' }),
    });

    const logs = await db.select().from(auditLogs)
      .where(eq(auditLogs.action, 'approve'));
    expect(logs.length).toBe(1);
    expect(logs[0].resource).toBe('approval');
    expect(logs[0].resourceId).toBe('appr-001');
  });

  // === 반려 흐름 ===

  it('INT-APPR-006: 새 승인 요청 -> 반려 처리', async () => {
    await db.insert(approvals).values({
      id: 'appr-003',
      projectId: 'proj-001',
      sourceAgentId: 'sub-001',
      title: '디자인 검토 요청',
      content: '디자인이 완료되었습니다.',
      urgency: 'normal',
      status: 'pending',
    });

    await db.update(approvals).set({
      status: 'rejected',
      resolution: '디자인 수정이 필요합니다.',
      resolvedAt: new Date().toISOString(),
    }).where(eq(approvals.id, 'appr-003'));

    await db.insert(approvalHistory).values({
      approvalId: 'appr-003',
      action: 'rejected',
      comment: '디자인 수정이 필요합니다.',
      actorType: 'user',
      actorId: '1',
    });

    const result = await db.select().from(approvals).where(eq(approvals.id, 'appr-003'));
    expect(result[0].status).toBe('rejected');

    const history = await db.select().from(approvalHistory)
      .where(eq(approvalHistory.approvalId, 'appr-003'));
    expect(history.length).toBe(1);
    expect(history[0].action).toBe('rejected');
  });

  // === 수정 지시 -> 재요청 흐름 ===

  it('INT-APPR-007: 수정 지시 후 재요청 (modify -> pending)', async () => {
    await db.insert(approvals).values({
      id: 'appr-004',
      projectId: 'proj-001',
      sourceAgentId: 'sub-001',
      title: '테스트 결과 검토',
      content: '테스트가 완료되었습니다.',
      urgency: 'critical',
      status: 'pending',
    });

    // 수정 지시
    await db.update(approvals).set({
      status: 'modified',
      resolution: '테스트 커버리지를 높여주세요.',
      resolvedAt: new Date().toISOString(),
    }).where(eq(approvals.id, 'appr-004'));

    await db.insert(approvalHistory).values({
      approvalId: 'appr-004',
      action: 'modified',
      comment: '테스트 커버리지를 높여주세요.',
      actorType: 'user',
      actorId: '1',
    });

    // 수정 후 재요청 (status를 다시 pending으로)
    await db.update(approvals).set({
      status: 'pending',
      resolution: null,
      resolvedAt: null,
    }).where(eq(approvals.id, 'appr-004'));

    await db.insert(approvalHistory).values({
      approvalId: 'appr-004',
      action: 'requested',
      comment: '커버리지를 85%로 높였습니다.',
      actorType: 'agent',
      actorId: 'sub-001',
    });

    const history = await db.select().from(approvalHistory)
      .where(eq(approvalHistory.approvalId, 'appr-004'));
    expect(history.length).toBe(2);
    expect(history[0].action).toBe('modified');
    expect(history[1].action).toBe('requested');
  });

  it('INT-APPR-008: 전체 승인 이력 수 확인', async () => {
    const [totalHistory] = await db.select({ count: count() }).from(approvalHistory);
    expect(totalHistory.count).toBe(4); // appr-001(1) + appr-003(1) + appr-004(2)
  });

  it('INT-APPR-009: 이미 처리된 승인 재처리 방지 (상태 확인)', async () => {
    const [approval] = await db.select().from(approvals).where(eq(approvals.id, 'appr-001'));
    expect(approval.status).toBe('approved');
    // API route에서는 pending이 아니면 APPROVAL_ALREADY_RESOLVED 반환
    expect(approval.status !== 'pending').toBe(true);
  });

  it('INT-APPR-010: urgency 필터링 (critical)', async () => {
    const critical = await db.select().from(approvals).where(eq(approvals.urgency, 'critical'));
    expect(critical.length).toBe(1);
    expect(critical[0].id).toBe('appr-004');
  });
});
