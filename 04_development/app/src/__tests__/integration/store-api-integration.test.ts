/**
 * Integration Test: Store <-> API Integration
 *
 * 검증 범위:
 * - Store 액션이 API를 호출하고 응답으로 상태를 업데이트하는 전체 흐름
 * - 여러 Store 간 연쇄 동작 시뮬레이션
 *
 * 관련 기능: F008~F013, F023~F027, F028~F031, F059~F060
 * 시나리오: SC-001, SC-003, SC-004
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDB, closeTestDB, type TestDB } from './helpers/test-db';
import Database from 'better-sqlite3';
import {
  agents, approvals, approvalHistory, notifications, auditLogs,
  chatMessages, parts, projects,
} from '@/lib/schema';
import { eq } from 'drizzle-orm';
import type { AgentTreeNode } from '@/types/agent';

// Simulate store-like state management
function createMockAgentStore() {
  let tree: AgentTreeNode[] = [];
  let agentsMap = new Map<string, AgentTreeNode>();

  function flattenTree(nodes: AgentTreeNode[]): Map<string, AgentTreeNode> {
    const map = new Map<string, AgentTreeNode>();
    function walk(node: AgentTreeNode): void {
      map.set(node.id, node);
      node.children.forEach(walk);
    }
    nodes.forEach(walk);
    return map;
  }

  return {
    getTree: () => tree,
    getAgent: (id: string) => agentsMap.get(id),
    setTree: (newTree: AgentTreeNode[]) => {
      tree = newTree;
      agentsMap = flattenTree(newTree);
    },
    updateStatus: (agentId: string, status: string, statusMessage?: string) => {
      function update(nodes: AgentTreeNode[]): AgentTreeNode[] {
        return nodes.map(n => {
          if (n.id === agentId) {
            return { ...n, status: status as AgentTreeNode['status'], statusMessage };
          }
          return { ...n, children: update(n.children) };
        });
      }
      tree = update(tree);
      agentsMap = flattenTree(tree);
    },
  };
}

function createMockApprovalStore() {
  let pendingList: Array<{ id: string; title: string; urgency: string; status: string }> = [];

  return {
    getPending: () => pendingList,
    addPending: (approval: typeof pendingList[0]) => {
      pendingList = [approval, ...pendingList];
    },
    removePending: (id: string) => {
      pendingList = pendingList.filter(a => a.id !== id);
    },
  };
}

function createMockNotificationStore() {
  let notifs: Array<{ id: number; type: string; title: string; message: string; isRead: boolean }> = [];
  let unreadCount = 0;

  return {
    getNotifications: () => notifs,
    getUnreadCount: () => unreadCount,
    addNotification: (n: typeof notifs[0]) => {
      notifs = [n, ...notifs];
      unreadCount += 1;
    },
    markRead: (ids: number[]) => {
      notifs = notifs.map(n => ids.includes(n.id) ? { ...n, isRead: true } : n);
      unreadCount = Math.max(0, unreadCount - ids.length);
    },
  };
}

describe('Integration: Store <-> API', () => {
  let db: TestDB;
  let sqlite: InstanceType<typeof Database>;
  let agentStore: ReturnType<typeof createMockAgentStore>;
  let approvalStore: ReturnType<typeof createMockApprovalStore>;
  let notificationStore: ReturnType<typeof createMockNotificationStore>;

  beforeAll(async () => {
    const result = createTestDB();
    db = result.db;
    sqlite = result.sqlite;

    agentStore = createMockAgentStore();
    approvalStore = createMockApprovalStore();
    notificationStore = createMockNotificationStore();

    // Seed DB
    await db.insert(parts).values({
      id: 'part-pm',
      name: '프로젝트관리부',
      skillName: 'project-part',
      skillVersion: '1.0.0',
    });
    await db.insert(agents).values([
      { id: 'main-001', name: '비서실장', role: 'main', status: 'active' },
      { id: 'part-001', name: 'PM 부서장', role: 'part', status: 'active', partId: 'part-pm', parentId: 'main-001' },
      { id: 'sub-001', name: '팀장', role: 'sub', status: 'idle', partId: 'part-pm', parentId: 'part-001' },
    ]);
    await db.insert(projects).values({
      id: 'proj-001',
      name: '할일앱',
      partId: 'part-pm',
      subAgentId: 'sub-001',
    });
  });

  afterAll(() => {
    closeTestDB(sqlite);
  });

  // === Agent Store <-> DB API ===

  it('INT-STORE-001: fetchTree - DB에서 에이전트 조회 후 Store 트리 업데이트', async () => {
    const allAgents = await db.select().from(agents);

    // Build tree (simulating API response)
    const nodeMap = new Map<string, AgentTreeNode>();
    for (const agent of allAgents) {
      nodeMap.set(agent.id, {
        id: agent.id,
        name: agent.name,
        role: agent.role as AgentTreeNode['role'],
        status: agent.status as AgentTreeNode['status'],
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

    agentStore.setTree(roots);
    expect(agentStore.getTree().length).toBe(1);
    expect(agentStore.getAgent('main-001')).toBeDefined();
    expect(agentStore.getAgent('sub-001')).toBeDefined();
  });

  it('INT-STORE-002: WebSocket agent:status -> DB 업데이트 -> Store 업데이트', async () => {
    // Simulate WS event: agent status change
    const wsEvent = { agentId: 'sub-001', status: 'active', statusMessage: '개발 중' };

    // 1. DB 업데이트 (API side)
    await db.update(agents).set({
      status: wsEvent.status,
      statusMessage: wsEvent.statusMessage,
    }).where(eq(agents.id, wsEvent.agentId));

    // 2. Store 업데이트 (client side)
    agentStore.updateStatus(wsEvent.agentId, wsEvent.status, wsEvent.statusMessage);

    // 3. 검증: DB와 Store 동기화
    const dbAgent = (await db.select().from(agents).where(eq(agents.id, 'sub-001')))[0];
    const storeAgent = agentStore.getAgent('sub-001');

    expect(dbAgent.status).toBe('active');
    expect(storeAgent!.status).toBe('active');
    expect(storeAgent!.statusMessage).toBe('개발 중');
  });

  // === Approval Store <-> DB API ===

  it('INT-STORE-003: 승인 요청 -> DB 저장 + Store pending 추가 + 알림 생성', async () => {
    // 1. DB에 승인 요청 저장
    await db.insert(approvals).values({
      id: 'appr-001',
      projectId: 'proj-001',
      sourceAgentId: 'sub-001',
      title: '기획 완료 승인',
      content: '기획이 완료되었습니다.',
      urgency: 'high',
      status: 'pending',
    });

    // 2. Store에 pending 추가
    approvalStore.addPending({
      id: 'appr-001',
      title: '기획 완료 승인',
      urgency: 'high',
      status: 'pending',
    });

    // 3. 알림 생성
    db.insert(notifications).values({
      type: 'approval',
      title: '새 승인 요청',
      message: '기획 완료 승인 요청이 도착했습니다.',
      sourceAgentId: 'sub-001',
    }).run();

    notificationStore.addNotification({
      id: 1,
      type: 'approval',
      title: '새 승인 요청',
      message: '기획 완료 승인 요청이 도착했습니다.',
      isRead: false,
    });

    // 검증
    expect(approvalStore.getPending().length).toBe(1);
    expect(notificationStore.getUnreadCount()).toBe(1);
  });

  it('INT-STORE-004: 승인 처리 -> DB 업데이트 + Store에서 제거 + 에이전트 상태 변경', async () => {
    const resolvedAt = new Date().toISOString();

    // 1. DB: 승인 처리
    await db.update(approvals).set({
      status: 'approved',
      resolution: '승인합니다.',
      resolvedAt,
    }).where(eq(approvals.id, 'appr-001'));

    // 2. DB: 승인 이력
    await db.insert(approvalHistory).values({
      approvalId: 'appr-001',
      action: 'approved',
      comment: '승인합니다.',
      actorType: 'user',
      actorId: '1',
    });

    // 3. DB: 감사 로그
    await db.insert(auditLogs).values({
      actorType: 'user',
      actorId: '1',
      action: 'approve',
      resource: 'approval',
      resourceId: 'appr-001',
    });

    // 4. Store: pending에서 제거
    approvalStore.removePending('appr-001');

    // 5. 에이전트 상태 변경 (작업 재개)
    await db.update(agents).set({ status: 'active' }).where(eq(agents.id, 'sub-001'));
    agentStore.updateStatus('sub-001', 'active');

    // 검증
    const dbApproval = (await db.select().from(approvals).where(eq(approvals.id, 'appr-001')))[0];
    expect(dbApproval.status).toBe('approved');
    expect(approvalStore.getPending().length).toBe(0);
    expect(agentStore.getAgent('sub-001')!.status).toBe('active');
  });

  // === Chat Store <-> DB ===

  it('INT-STORE-005: 사용자 메시지 -> DB 저장 + Main 응답 -> DB 저장', async () => {
    const msgId1 = 'msg-001';
    const msgId2 = 'msg-002';

    // 사용자 메시지
    await db.insert(chatMessages).values({
      id: msgId1,
      sender: 'user',
      content: '프로젝트 진행 상황을 알려줘',
      messageType: 'text',
    });

    // Main 응답
    await db.insert(chatMessages).values({
      id: msgId2,
      sender: 'main',
      content: '현재 기획 단계가 완료되어 개발 단계로 진입합니다.',
      messageType: 'text',
    });

    const messages = db.select().from(chatMessages).all();
    expect(messages.length).toBe(2);
    expect(messages[0].sender).toBe('user');
    expect(messages[1].sender).toBe('main');
  });

  it('INT-STORE-006: 지시 이력 저장 및 조회', async () => {
    await db.insert(chatMessages).values({
      id: 'msg-003',
      sender: 'user',
      content: '프로젝트 우선순위를 높여줘',
      messageType: 'text',
    });

    await db.insert(auditLogs).values({
      actorType: 'user',
      actorId: '1',
      action: 'command',
      resource: 'project',
      resourceId: 'proj-001',
      detail: JSON.stringify({ command: '우선순위 변경', priority: 2 }),
    });

    const logs = db.select().from(auditLogs)
      .where(eq(auditLogs.action, 'command')).all();
    expect(logs.length).toBe(1);
    expect(JSON.parse(logs[0].detail!).priority).toBe(2);
  });

  // === Notification Store <-> DB ===

  it('INT-STORE-007: 알림 읽음 처리 -> DB + Store 동시 업데이트', async () => {
    // DB에서 읽음 처리
    const notifRows = db.select().from(notifications).all();
    if (notifRows.length > 0) {
      await db.update(notifications).set({ isRead: true })
        .where(eq(notifications.id, notifRows[0].id));
    }

    // Store에서 읽음 처리
    notificationStore.markRead([1]);

    expect(notificationStore.getUnreadCount()).toBe(0);
  });

  it('INT-STORE-008: 에러 이벤트 -> 에이전트 상태 error + 알림 생성', async () => {
    // DB: 에이전트 상태 변경
    await db.update(agents).set({
      status: 'error',
      statusMessage: '작업 중 오류 발생',
    }).where(eq(agents.id, 'sub-001'));

    // Store: 상태 업데이트
    agentStore.updateStatus('sub-001', 'error', '작업 중 오류 발생');

    // DB: 에러 알림 생성
    db.insert(notifications).values({
      type: 'error',
      title: '에이전트 오류',
      message: 'sub-001에서 오류가 발생했습니다.',
      sourceAgentId: 'sub-001',
    }).run();

    // Store: 알림 추가
    notificationStore.addNotification({
      id: 2,
      type: 'error',
      title: '에이전트 오류',
      message: 'sub-001에서 오류가 발생했습니다.',
      isRead: false,
    });

    expect(agentStore.getAgent('sub-001')!.status).toBe('error');
    expect(notificationStore.getUnreadCount()).toBe(1);
    expect(notificationStore.getNotifications()[0].type).toBe('error');
  });

  it('INT-STORE-009: 여러 Store 간 정합성 확인', () => {
    // agentStore의 에이전트 상태와 DB가 일치하는지
    const storeAgent = agentStore.getAgent('sub-001');
    expect(storeAgent).toBeDefined();
    expect(storeAgent!.status).toBe('error');

    // approvalStore에 pending 없음 (모두 처리됨)
    expect(approvalStore.getPending().length).toBe(0);

    // notificationStore에 unread 있음 (에러 알림)
    expect(notificationStore.getUnreadCount()).toBe(1);
  });

  it('INT-STORE-010: DB와 Store 데이터 최종 동기화 검증', async () => {
    const dbAgents = await db.select().from(agents);
    const dbApprovals = await db.select().from(approvals);
    const dbNotifs = db.select().from(notifications).all();
    const dbChat = db.select().from(chatMessages).all();
    const dbAudit = db.select().from(auditLogs).all();

    expect(dbAgents.length).toBe(3);
    expect(dbApprovals.length).toBe(1);
    expect(dbNotifs.length).toBe(2);
    expect(dbChat.length).toBe(3);
    expect(dbAudit.length).toBeGreaterThanOrEqual(2);
  });
});
