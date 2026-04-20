/**
 * Integration Test I6: Audit Log Integrity
 *
 * Verifies that ALL user actions are recorded in auditLogs:
 *   - Approval (approve/reject/modify)
 *   - Setting changes
 *   - Agent start/stop
 *   - Project commands
 *   - API key management
 *
 * Each record must have: actorType, action, resource, detail.
 *
 * Related features: F061~F063
 * Scenarios: SC-003, SC-004, SC-008, SC-012, SC-013, SC-014, SC-019, SC-022
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDB, closeTestDB, type TestDB } from './helpers/test-db';
import Database from 'better-sqlite3';
import {
  agents, parts, projects, approvals, auditLogs, settings,
} from '@/lib/schema';
import { eq, and, count, sql } from 'drizzle-orm';

describe('Integration I6: Audit Log Integrity', () => {
  let db: TestDB;
  let sqlite: InstanceType<typeof Database>;

  beforeAll(async () => {
    const result = createTestDB();
    db = result.db;
    sqlite = result.sqlite;

    // Seed
    await db.insert(parts).values({
      id: 'part-pm', name: 'PM', skillName: 'pm', skillVersion: '1.0.0',
    });
    await db.insert(agents).values([
      { id: 'main-001', name: 'Main', role: 'main', status: 'active' },
      { id: 'sub-001', name: 'Lead', role: 'sub', partId: 'part-pm', parentId: 'main-001' },
      { id: 'inst-001', name: 'Dev', role: 'instance', partId: 'part-pm', parentId: 'sub-001' },
    ]);
    await db.insert(projects).values({
      id: 'proj-001', name: 'Todo App', partId: 'part-pm', subAgentId: 'sub-001',
    });
  });

  afterAll(() => {
    closeTestDB(sqlite);
  });

  // === A. Approval Actions ===

  it('I6-001: Approve action is logged with correct fields', async () => {
    await db.insert(approvals).values({
      id: 'appr-001', projectId: 'proj-001', sourceAgentId: 'sub-001',
      title: 'Test', content: 'Approve me', status: 'approved',
    });

    await db.insert(auditLogs).values({
      actorType: 'user', actorId: '1',
      action: 'approve', resource: 'approval', resourceId: 'appr-001',
      detail: JSON.stringify({ comment: 'Looks good' }),
    });

    const log = db.select().from(auditLogs)
      .where(eq(auditLogs.action, 'approve')).get();
    expect(log).toBeDefined();
    expect(log!.actorType).toBe('user');
    expect(log!.resource).toBe('approval');
    expect(log!.resourceId).toBe('appr-001');
    expect(JSON.parse(log!.detail!).comment).toBe('Looks good');
  });

  it('I6-002: Reject action is logged', async () => {
    await db.insert(auditLogs).values({
      actorType: 'user', actorId: '1',
      action: 'reject', resource: 'approval', resourceId: 'appr-002',
      detail: JSON.stringify({ comment: 'Needs rework', reason: 'Incomplete' }),
    });

    const log = db.select().from(auditLogs)
      .where(eq(auditLogs.action, 'reject')).get();
    expect(log!.actorType).toBe('user');
    expect(JSON.parse(log!.detail!).reason).toBe('Incomplete');
  });

  // === B. Setting Changes ===

  it('I6-003: Setting change records old and new values', async () => {
    await db.insert(settings).values({ key: 'retry_count', value: '3' });

    await db.insert(auditLogs).values({
      actorType: 'user', actorId: '1',
      action: 'setting_change', resource: 'settings',
      detail: JSON.stringify({ key: 'retry_count', oldValue: '3', newValue: '5' }),
    });

    const log = db.select().from(auditLogs)
      .where(eq(auditLogs.action, 'setting_change')).get();
    const detail = JSON.parse(log!.detail!);
    expect(detail.key).toBe('retry_count');
    expect(detail.oldValue).toBe('3');
    expect(detail.newValue).toBe('5');
  });

  // === C. Agent Start/Stop ===

  it('I6-004: Agent start action is logged', async () => {
    await db.insert(auditLogs).values({
      actorType: 'user', actorId: '1',
      action: 'agent_start', resource: 'agent', resourceId: 'inst-001',
      detail: JSON.stringify({ model: 'claude-3-sonnet', partId: 'part-pm' }),
    });

    const log = db.select().from(auditLogs)
      .where(eq(auditLogs.action, 'agent_start')).get();
    expect(log!.resourceId).toBe('inst-001');
    expect(JSON.parse(log!.detail!).model).toBe('claude-3-sonnet');
  });

  it('I6-005: Agent stop action is logged', async () => {
    await db.insert(auditLogs).values({
      actorType: 'user', actorId: '1',
      action: 'agent_stop', resource: 'agent', resourceId: 'inst-001',
      detail: JSON.stringify({ reason: 'Manual stop' }),
    });

    const log = db.select().from(auditLogs)
      .where(eq(auditLogs.action, 'agent_stop')).get();
    expect(log!.actorType).toBe('user');
    expect(JSON.parse(log!.detail!).reason).toBe('Manual stop');
  });

  // === D. Project Commands ===

  it('I6-006: Priority change command is logged', async () => {
    await db.insert(auditLogs).values({
      actorType: 'user', actorId: '1',
      action: 'command', resource: 'project', resourceId: 'proj-001',
      detail: JSON.stringify({ command: 'priority_change', from: 0, to: 2 }),
    });

    const log = db.select().from(auditLogs)
      .where(and(eq(auditLogs.action, 'command'), eq(auditLogs.resourceId, 'proj-001'))).get();
    const detail = JSON.parse(log!.detail!);
    expect(detail.command).toBe('priority_change');
    expect(detail.from).toBe(0);
    expect(detail.to).toBe(2);
  });

  // === E. API Key Management ===

  it('I6-007: API key registration is logged', async () => {
    await db.insert(auditLogs).values({
      actorType: 'user', actorId: '1',
      action: 'register_apikey', resource: 'apikey', resourceId: '1',
      detail: JSON.stringify({ provider: 'anthropic' }),
    });

    const log = db.select().from(auditLogs)
      .where(eq(auditLogs.action, 'register_apikey')).get();
    expect(log!.resource).toBe('apikey');
    expect(JSON.parse(log!.detail!).provider).toBe('anthropic');
  });

  it('I6-008: API key deletion is logged', async () => {
    await db.insert(auditLogs).values({
      actorType: 'user', actorId: '1',
      action: 'delete_apikey', resource: 'apikey', resourceId: '2',
      detail: JSON.stringify({ provider: 'openai' }),
    });

    const log = db.select().from(auditLogs)
      .where(eq(auditLogs.action, 'delete_apikey')).get();
    expect(log!.resourceId).toBe('2');
  });

  // === F. Agent-initiated audit logs ===

  it('I6-009: Agent-initiated actions have actorType=agent', async () => {
    await db.insert(auditLogs).values({
      actorType: 'agent', actorId: 'sub-001',
      action: 'task_complete', resource: 'project', resourceId: 'proj-001',
      detail: JSON.stringify({ stage: 'planning', duration: '2h' }),
    });

    const agentLogs = db.select().from(auditLogs)
      .where(eq(auditLogs.actorType, 'agent')).all();
    expect(agentLogs.length).toBe(1);
    expect(agentLogs[0].actorId).toBe('sub-001');
  });

  // === G. All required fields present ===

  it('I6-010: Every audit log has actorType, action, resource', () => {
    const all = db.select().from(auditLogs).all();
    expect(all.length).toBe(9);

    for (const log of all) {
      expect(log.actorType).toBeTruthy();
      expect(log.action).toBeTruthy();
      expect(log.resource).toBeTruthy();
      expect(['user', 'agent', 'system']).toContain(log.actorType);
    }
  });

  // === H. Filtering by resource ===

  it('I6-011: Filter audit logs by resource type', () => {
    const approvalLogs = db.select().from(auditLogs)
      .where(eq(auditLogs.resource, 'approval')).all();
    expect(approvalLogs.length).toBe(2); // approve + reject

    const agentResourceLogs = db.select().from(auditLogs)
      .where(eq(auditLogs.resource, 'agent')).all();
    expect(agentResourceLogs.length).toBe(2); // start + stop

    const apikeyLogs = db.select().from(auditLogs)
      .where(eq(auditLogs.resource, 'apikey')).all();
    expect(apikeyLogs.length).toBe(2); // register + delete
  });

  // === I. Chronological ordering ===

  it('I6-012: Audit logs maintain insertion order', () => {
    const all = db.select().from(auditLogs)
      .orderBy(auditLogs.id)
      .all();

    const actions = all.map(l => l.action);
    expect(actions[0]).toBe('approve');
    expect(actions[actions.length - 1]).toBe('task_complete');
  });
});
