/**
 * Integration Test: DB <-> API Agents CRUD + Tree
 *
 * 검증 범위:
 * - 에이전트 생성 -> 조회 -> 상태 변경 -> 트리 구조 검증
 * - Part 생성 -> 에이전트 소속 -> 4계층 트리 빌드
 *
 * 관련 기능: F008~F012 (오케스트레이션), F013 (대시보드)
 * 시나리오: SC-003 (에이전트 트리 구축)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDB, closeTestDB, type TestDB } from './helpers/test-db';
import Database from 'better-sqlite3';
import { parts, agents } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import type { AgentTreeNode } from '@/types/agent';

describe('Integration: DB <-> API Agents CRUD + Tree', () => {
  let db: TestDB;
  let sqlite: InstanceType<typeof Database>;

  beforeAll(() => {
    const result = createTestDB();
    db = result.db;
    sqlite = result.sqlite;
  });

  afterAll(() => {
    closeTestDB(sqlite);
  });

  // === Part + Agent 생성 ===

  it('INT-AGENT-001: Part 생성 후 DB 조회', async () => {
    await db.insert(parts).values({
      id: 'part-pm',
      name: '프로젝트관리부',
      skillName: 'project-part',
      skillVersion: '1.0.0',
      sensitivityLevel: 'normal',
      color: '#3B82F6',
    });

    const result = await db.select().from(parts).where(eq(parts.id, 'part-pm'));
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('프로젝트관리부');
    expect(result[0].status).toBe('active');
  });

  it('INT-AGENT-002: Main 에이전트 생성 (최상위)', async () => {
    await db.insert(agents).values({
      id: 'main-001',
      name: '비서실장',
      role: 'main',
      status: 'active',
      statusMessage: '대기 중',
    });

    const result = await db.select().from(agents).where(eq(agents.id, 'main-001'));
    expect(result.length).toBe(1);
    expect(result[0].role).toBe('main');
    expect(result[0].status).toBe('active');
  });

  it('INT-AGENT-003: Part 에이전트 생성 (Main 하위)', async () => {
    await db.insert(agents).values({
      id: 'part-agent-001',
      name: 'PM 부서장',
      role: 'part',
      status: 'active',
      partId: 'part-pm',
      parentId: 'main-001',
    });

    const result = await db.select().from(agents).where(eq(agents.id, 'part-agent-001'));
    expect(result.length).toBe(1);
    expect(result[0].partId).toBe('part-pm');
    expect(result[0].parentId).toBe('main-001');
  });

  it('INT-AGENT-004: Sub 에이전트 생성 (Part 하위)', async () => {
    await db.insert(agents).values({
      id: 'sub-001',
      name: '프로젝트A 팀장',
      role: 'sub',
      status: 'idle',
      partId: 'part-pm',
      parentId: 'part-agent-001',
    });

    const result = await db.select().from(agents).where(eq(agents.id, 'sub-001'));
    expect(result[0].role).toBe('sub');
    expect(result[0].parentId).toBe('part-agent-001');
  });

  it('INT-AGENT-005: Instance 에이전트 생성 (Sub 하위)', async () => {
    await db.insert(agents).values({
      id: 'inst-001',
      name: '개발자 인스턴스',
      role: 'instance',
      status: 'active',
      partId: 'part-pm',
      parentId: 'sub-001',
      modelName: 'claude-3-sonnet',
      modelProvider: 'anthropic',
      taskType: 'development',
    });

    const result = await db.select().from(agents).where(eq(agents.id, 'inst-001'));
    expect(result[0].role).toBe('instance');
    expect(result[0].modelName).toBe('claude-3-sonnet');
  });

  // === 트리 빌드 검증 ===

  it('INT-AGENT-006: 4계층 에이전트 트리 빌드', async () => {
    const allAgents = await db.select().from(agents);
    expect(allAgents.length).toBe(4);

    // Build tree (same logic as API route)
    const nodeMap = new Map<string, AgentTreeNode>();
    for (const agent of allAgents) {
      nodeMap.set(agent.id, {
        id: agent.id,
        name: agent.name,
        role: agent.role as AgentTreeNode['role'],
        status: agent.status as AgentTreeNode['status'],
        statusMessage: agent.statusMessage ?? undefined,
        partId: agent.partId ?? undefined,
        children: [],
      });
    }

    const roots: AgentTreeNode[] = [];
    for (const agent of allAgents) {
      const node = nodeMap.get(agent.id)!;
      if (agent.parentId && nodeMap.has(agent.parentId)) {
        nodeMap.get(agent.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    // Verify tree structure
    expect(roots.length).toBe(1);
    expect(roots[0].id).toBe('main-001');
    expect(roots[0].children.length).toBe(1);
    expect(roots[0].children[0].id).toBe('part-agent-001');
    expect(roots[0].children[0].children.length).toBe(1);
    expect(roots[0].children[0].children[0].id).toBe('sub-001');
    expect(roots[0].children[0].children[0].children.length).toBe(1);
    expect(roots[0].children[0].children[0].children[0].id).toBe('inst-001');
  });

  // === 상태 변경 ===

  it('INT-AGENT-007: 에이전트 상태 변경 후 DB 반영', async () => {
    await db.update(agents).set({
      status: 'error',
      statusMessage: '작업 실패',
      updatedAt: new Date().toISOString(),
    }).where(eq(agents.id, 'inst-001'));

    const result = await db.select().from(agents).where(eq(agents.id, 'inst-001'));
    expect(result[0].status).toBe('error');
    expect(result[0].statusMessage).toBe('작업 실패');
  });

  it('INT-AGENT-008: 상태 변경이 트리에서 올바르게 반영', async () => {
    // 상태를 retrying으로 변경
    await db.update(agents).set({ status: 'retrying' }).where(eq(agents.id, 'inst-001'));

    const allAgents = await db.select().from(agents);
    const instAgent = allAgents.find(a => a.id === 'inst-001');
    expect(instAgent!.status).toBe('retrying');

    // 다른 에이전트 상태는 변경되지 않음
    const mainAgent = allAgents.find(a => a.id === 'main-001');
    expect(mainAgent!.status).toBe('active');
  });

  it('INT-AGENT-009: Part별 에이전트 필터링', async () => {
    const pmAgents = await db.select().from(agents).where(eq(agents.partId, 'part-pm'));
    // main-001은 partId 없으므로 3개
    expect(pmAgents.length).toBe(3);
    expect(pmAgents.every(a => a.partId === 'part-pm')).toBe(true);
  });

  it('INT-AGENT-010: role별 에이전트 필터링', async () => {
    const instances = await db.select().from(agents).where(eq(agents.role, 'instance'));
    expect(instances.length).toBe(1);
    expect(instances[0].id).toBe('inst-001');
  });
});
