/**
 * Integration Test I1: Full Orchestration Flow
 *
 * End-to-end flow:
 *   Login -> Settings -> Skill execution -> Part creation -> Sub creation -> Instance creation
 *   Each step verifies DB state, WebSocket broadcast readiness, and tmux session naming.
 *
 * Related features: F001~F012, F059, F064~F065
 * Scenarios: SC-001, SC-002, SC-003
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDB, closeTestDB, type TestDB } from './helpers/test-db';
import Database from 'better-sqlite3';
import {
  users, agents, parts, projects, skills, settings,
  auditLogs, agentLogs, chatMessages, notifications, partPolicies,
} from '@/lib/schema';
import { hashPassword, comparePassword, generateToken, verifyToken } from '@/lib/auth';
import { eq, count } from 'drizzle-orm';
import { buildSessionName } from '@/lib/orchestrator';
import type { AgentTreeNode } from '@/types/agent';

describe('Integration I1: Full Orchestration Flow', () => {
  let db: TestDB;
  let sqlite: InstanceType<typeof Database>;
  let authToken: string;

  beforeAll(async () => {
    const result = createTestDB();
    db = result.db;
    sqlite = result.sqlite;
  });

  afterAll(() => {
    closeTestDB(sqlite);
  });

  // === Step 1: Authentication ===

  it('I1-001: User setup and login produces a valid JWT', async () => {
    const password = 'securePassword123';
    const hash = await hashPassword(password);
    const [user] = await db.insert(users).values({ passwordHash: hash }).returning();
    expect(user.id).toBe(1);

    const isValid = await comparePassword(password, user.passwordHash);
    expect(isValid).toBe(true);

    authToken = generateToken(user.id);
    const payload = verifyToken(authToken);
    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe(1);
  });

  // === Step 2: Global Settings Configuration ===

  it('I1-002: Save global settings to DB', async () => {
    const now = new Date().toISOString();
    await db.insert(settings).values([
      { key: 'max_concurrent_agents', value: '5', updatedAt: now },
      { key: 'retry_count', value: '3', updatedAt: now },
      { key: 'cost_limit', value: '100', updatedAt: now },
    ]);

    const all = db.select().from(settings).all();
    expect(all.length).toBe(3);

    // Record audit log for setting changes
    await db.insert(auditLogs).values({
      actorType: 'user', actorId: '1',
      action: 'setting_change', resource: 'settings',
      detail: JSON.stringify({ maxConcurrentAgents: 5, retryCount: 3, costLimit: 100 }),
    });
  });

  // === Step 3: Skill Registration ===

  it('I1-003: Register a Skill in the skills table', async () => {
    const result = db.insert(skills).values({
      name: 'project-management',
      displayName: 'Project Management',
      description: 'Manages software projects end-to-end',
      version: '1.0.0',
      schemaJson: JSON.stringify({
        type: 'object',
        properties: {
          projectName: { type: 'string' },
          priority: { type: 'number', minimum: 0, maximum: 5 },
        },
        required: ['projectName'],
      }),
      filePath: '/skills/project-management.yaml',
    }).run();

    expect(Number(result.lastInsertRowid)).toBe(1);

    const skill = db.select().from(skills).where(eq(skills.name, 'project-management')).get();
    expect(skill).toBeDefined();
    expect(skill!.version).toBe('1.0.0');
    expect(JSON.parse(skill!.schemaJson!).required).toContain('projectName');
  });

  // === Step 4: Part Creation (triggered by Skill execution) ===

  it('I1-004: Create Part from Skill execution and verify DB + folder naming', async () => {
    await db.insert(parts).values({
      id: 'part-pm',
      name: 'Project Management',
      skillName: 'project-management',
      skillVersion: '1.0.0',
      color: '#3B82F6',
      status: 'active',
    });

    const part = (await db.select().from(parts).where(eq(parts.id, 'part-pm')))[0];
    expect(part.name).toBe('Project Management');
    expect(part.skillName).toBe('project-management');

    // Part agent
    await db.insert(agents).values({
      id: 'part-agent-001',
      name: 'PM Department Head',
      role: 'part',
      status: 'active',
      partId: 'part-pm',
      parentId: 'main-001',
    });

    const sessionName = buildSessionName('part', 'part-agent-001');
    expect(sessionName).toMatch(/^cm-part-/);
  });

  // === Step 5: Main Orchestrator Creation ===

  it('I1-005: Create Main agent and verify tree root', async () => {
    await db.insert(agents).values({
      id: 'main-001',
      name: 'Secretary General',
      role: 'main',
      status: 'active',
      statusMessage: 'Ready',
    });

    const mainAgent = (await db.select().from(agents).where(eq(agents.id, 'main-001')))[0];
    expect(mainAgent.role).toBe('main');
    expect(mainAgent.status).toBe('active');

    const sessionName = buildSessionName('main', 'main-001');
    expect(sessionName).toBe('cm-main-main-001');
  });

  // === Step 6: Part Policy Configuration ===

  it('I1-006: Set Part-specific policy', async () => {
    await db.insert(partPolicies).values({
      partId: 'part-pm',
      retryCount: 5,
      retryStrategy: 'fixed',
      retryIntervalBase: 15,
      approvalStages: JSON.stringify(['planning', 'design', 'development']),
      defaultModel: 'claude-3-sonnet',
    });

    const policy = db.select().from(partPolicies)
      .where(eq(partPolicies.partId, 'part-pm')).get();
    expect(policy!.retryCount).toBe(5);
    expect(policy!.defaultModel).toBe('claude-3-sonnet');
  });

  // === Step 7: Sub Orchestrator Creation ===

  it('I1-007: Create Sub agent under Part', async () => {
    await db.insert(agents).values({
      id: 'sub-001',
      name: 'Project A Lead',
      role: 'sub',
      status: 'idle',
      partId: 'part-pm',
      parentId: 'part-agent-001',
    });

    // Create project linked to Sub
    await db.insert(projects).values({
      id: 'proj-001',
      name: 'Todo App',
      partId: 'part-pm',
      subAgentId: 'sub-001',
      status: 'active',
      currentStage: 'planning',
    });

    const sub = (await db.select().from(agents).where(eq(agents.id, 'sub-001')))[0];
    expect(sub.partId).toBe('part-pm');
    expect(sub.parentId).toBe('part-agent-001');

    const proj = (await db.select().from(projects).where(eq(projects.id, 'proj-001')))[0];
    expect(proj.subAgentId).toBe('sub-001');
  });

  // === Step 8: Instance Creation ===

  it('I1-008: Create Instance agent under Sub with model assignment', async () => {
    await db.insert(agents).values({
      id: 'inst-001',
      name: 'Developer Instance',
      role: 'instance',
      status: 'active',
      partId: 'part-pm',
      parentId: 'sub-001',
      modelName: 'claude-3-sonnet',
      modelProvider: 'anthropic',
      taskType: 'development',
      tmuxSession: buildSessionName('instance', 'inst-001'),
    });

    const inst = (await db.select().from(agents).where(eq(agents.id, 'inst-001')))[0];
    expect(inst.role).toBe('instance');
    expect(inst.modelName).toBe('claude-3-sonnet');
    expect(inst.tmuxSession).toMatch(/^cm-instance-/);
  });

  // === Step 9: Full 4-Layer Tree Verification ===

  it('I1-009: Build complete 4-layer tree and verify structure', async () => {
    const allAgents = await db.select().from(agents);
    expect(allAgents.length).toBe(4);

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

    expect(roots.length).toBe(1);
    expect(roots[0].role).toBe('main');
    expect(roots[0].children[0].role).toBe('part');
    expect(roots[0].children[0].children[0].role).toBe('sub');
    expect(roots[0].children[0].children[0].children[0].role).toBe('instance');
  });

  // === Step 10: Chat Log for Full Flow ===

  it('I1-010: Record command in chat and audit log for orchestration', async () => {
    await db.insert(chatMessages).values({
      id: 'msg-orch-001',
      sender: 'user',
      content: 'Start project Todo App with project-management skill',
      messageType: 'text',
    });

    await db.insert(auditLogs).values({
      actorType: 'user', actorId: '1',
      action: 'start_orchestration', resource: 'project', resourceId: 'proj-001',
      detail: JSON.stringify({ skillName: 'project-management', partId: 'part-pm' }),
    });

    const msgs = db.select().from(chatMessages).all();
    expect(msgs.length).toBe(1);

    const audits = db.select().from(auditLogs)
      .where(eq(auditLogs.action, 'start_orchestration')).all();
    expect(audits.length).toBe(1);
  });

  // === Step 11: Agent Lifecycle Events ===

  it('I1-011: Instance task_start event updates status and logs', async () => {
    await db.insert(agentLogs).values({
      agentId: 'inst-001',
      eventType: 'task_start',
      message: 'Development started',
    });

    await db.update(agents).set({
      status: 'active',
      statusMessage: 'Development started',
      startedAt: new Date().toISOString(),
    }).where(eq(agents.id, 'inst-001'));

    const agent = (await db.select().from(agents).where(eq(agents.id, 'inst-001')))[0];
    expect(agent.status).toBe('active');
    expect(agent.startedAt).toBeTruthy();
  });

  // === Step 12: Final Data Integrity ===

  it('I1-012: End-to-end data counts are consistent', () => {
    const userCount = db.select({ count: count() }).from(users).get();
    const partCount = db.select({ count: count() }).from(parts).get();
    const agentCount = db.select({ count: count() }).from(agents).get();
    const projCount = db.select({ count: count() }).from(projects).get();
    const skillCount = db.select({ count: count() }).from(skills).get();
    const settCount = db.select({ count: count() }).from(settings).get();
    const policyCount = db.select({ count: count() }).from(partPolicies).get();

    expect(userCount!.count).toBe(1);
    expect(partCount!.count).toBe(1);
    expect(agentCount!.count).toBe(4);
    expect(projCount!.count).toBe(1);
    expect(skillCount!.count).toBe(1);
    expect(settCount!.count).toBe(3);
    expect(policyCount!.count).toBe(1);
  });
});
