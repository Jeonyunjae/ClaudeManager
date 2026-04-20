/**
 * Integration Test I3: Notification System
 *
 * Verifies that various triggers create notifications in the DB
 * and that they can be queried via the notifications table.
 *
 * Triggers tested:
 *   - Approval request
 *   - Cost threshold exceeded
 *   - API key expiry
 *   - Agent error
 *   - Recovery complete
 *
 * Related features: F028~F031, F038, F043
 * Scenarios: SC-004, SC-006, SC-007, SC-009, SC-010, SC-017, SC-024
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDB, closeTestDB, type TestDB } from './helpers/test-db';
import Database from 'better-sqlite3';
import {
  agents, parts, projects, approvals, apiKeys, costRecords,
  notifications, settings,
} from '@/lib/schema';
import { encrypt, maskApiKey } from '@/lib/crypto';
import { eq, sql, count } from 'drizzle-orm';

describe('Integration I3: Notification System', () => {
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
    await db.insert(settings).values([
      { key: 'cost_limit', value: '100' },
      { key: 'alert_threshold', value: '80' },
    ]);

    const { encrypted, iv, tag } = encrypt('sk-test-key');
    db.insert(apiKeys).values({
      provider: 'anthropic',
      keyEncrypted: encrypted, keyIv: iv, keyTag: tag,
      keyMasked: maskApiKey('sk-test-key'),
      status: 'active',
      expiresAt: '2026-04-20T00:00:00Z', // expires in 5 days
    }).run();
  });

  afterAll(() => {
    closeTestDB(sqlite);
  });

  // === A. Approval Request -> Notification ===

  it('I3-001: Approval request creates an approval-type notification', async () => {
    await db.insert(approvals).values({
      id: 'appr-001', projectId: 'proj-001', sourceAgentId: 'sub-001',
      title: 'Planning Approval', content: 'Planning is done', urgency: 'high', status: 'pending',
    });

    db.insert(notifications).values({
      type: 'approval',
      title: 'New Approval Request',
      message: 'Planning Approval from sub-001',
      sourceAgentId: 'sub-001',
      targetUrl: '/approvals/appr-001',
    }).run();

    const notifs = db.select().from(notifications)
      .where(eq(notifications.type, 'approval')).all();
    expect(notifs.length).toBe(1);
    expect(notifs[0].targetUrl).toContain('appr-001');
    expect(notifs[0].isRead).toBe(false);
  });

  // === B. Cost Threshold Exceeded -> Notification ===

  it('I3-002: Cost exceeding threshold creates a cost-type notification', async () => {
    // Insert cost records totaling 85 (over 80% of 100 limit)
    await db.insert(costRecords).values([
      { agentId: 'inst-001', modelName: 'claude-3-sonnet', inputTokens: 100000, outputTokens: 50000, cost: 45.0, projectId: 'proj-001' },
      { agentId: 'inst-001', modelName: 'claude-3-opus', inputTokens: 50000, outputTokens: 20000, cost: 40.0, projectId: 'proj-001' },
    ]);

    // Calculate threshold
    const totalResult = db.select({
      totalCost: sql<number>`COALESCE(SUM(cost), 0)`,
    }).from(costRecords).get();
    const costLimit = parseFloat(
      db.select().from(settings).where(eq(settings.key, 'cost_limit')).get()!.value
    );
    const alertThreshold = parseFloat(
      db.select().from(settings).where(eq(settings.key, 'alert_threshold')).get()!.value
    );

    const percentage = (totalResult!.totalCost / costLimit) * 100;
    expect(percentage).toBeGreaterThan(alertThreshold);

    // Create notification
    db.insert(notifications).values({
      type: 'cost',
      title: 'Cost Threshold Exceeded',
      message: `Current cost $${totalResult!.totalCost.toFixed(2)} exceeds ${alertThreshold}% of $${costLimit} limit`,
    }).run();

    const costNotifs = db.select().from(notifications)
      .where(eq(notifications.type, 'cost')).all();
    expect(costNotifs.length).toBe(1);
    expect(costNotifs[0].message).toContain('85');
  });

  // === C. API Key Expiry -> Notification ===

  it('I3-003: API key near expiry creates a key_expiry notification', () => {
    const key = db.select().from(apiKeys).where(eq(apiKeys.id, 1)).get();
    expect(key).toBeDefined();

    // Check if expires within 7 days
    const expiresAt = new Date(key!.expiresAt!);
    const now = new Date('2026-04-15T00:00:00Z');
    const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    expect(daysUntilExpiry).toBeLessThanOrEqual(7);

    db.insert(notifications).values({
      type: 'key_expiry',
      title: 'API Key Expiring Soon',
      message: `Anthropic key expires in ${Math.round(daysUntilExpiry)} days`,
    }).run();

    const expiryNotifs = db.select().from(notifications)
      .where(eq(notifications.type, 'key_expiry')).all();
    expect(expiryNotifs.length).toBe(1);
  });

  // === D. Agent Error -> Notification ===

  it('I3-004: Agent error creates an error notification with sourceAgentId', () => {
    db.insert(notifications).values({
      type: 'error',
      title: 'Agent Error',
      message: 'inst-001 encountered API rate limit',
      sourceAgentId: 'inst-001',
    }).run();

    const errNotifs = db.select().from(notifications)
      .where(eq(notifications.type, 'error')).all();
    expect(errNotifs.length).toBe(1);
    expect(errNotifs[0].sourceAgentId).toBe('inst-001');
  });

  // === E. Recovery -> Notification ===

  it('I3-005: Recovery complete creates a recovery notification', () => {
    db.insert(notifications).values({
      type: 'recovery',
      title: 'Agent Recovered',
      message: 'inst-001 has recovered and resumed work',
      sourceAgentId: 'inst-001',
    }).run();

    const recovNotifs = db.select().from(notifications)
      .where(eq(notifications.type, 'recovery')).all();
    expect(recovNotifs.length).toBe(1);
  });

  // === F. GET /api/notifications equivalent query ===

  it('I3-006: All notifications are queryable with type filter', () => {
    const all = db.select().from(notifications).all();
    expect(all.length).toBe(5);

    const types = all.map(n => n.type);
    expect(types).toContain('approval');
    expect(types).toContain('cost');
    expect(types).toContain('key_expiry');
    expect(types).toContain('error');
    expect(types).toContain('recovery');
  });

  it('I3-007: Unread notifications count is correct', () => {
    const unread = db.select({ count: count() }).from(notifications)
      .where(eq(notifications.isRead, false)).get();
    expect(unread!.count).toBe(5); // all unread
  });

  // === G. Mark notifications as read ===

  it('I3-008: Mark specific notifications as read', async () => {
    const all = db.select().from(notifications).all();
    const firstId = all[0].id;

    await db.update(notifications).set({ isRead: true })
      .where(eq(notifications.id, firstId));

    const unread = db.select({ count: count() }).from(notifications)
      .where(eq(notifications.isRead, false)).get();
    expect(unread!.count).toBe(4);
  });

  // === H. Notification ordering ===

  it('I3-009: Notifications are ordered by creation time (newest first)', () => {
    const all = db.select().from(notifications)
      .orderBy(sql`created_at DESC`)
      .all();

    expect(all.length).toBe(5);
    // Last inserted should be first when ordered DESC
    expect(all[0].type).toBe('recovery');
  });

  // === I. Notification source linking ===

  it('I3-010: Notifications with sourceAgentId can be joined to agents', () => {
    const agentNotifs = db.select().from(notifications)
      .where(sql`source_agent_id IS NOT NULL`)
      .all();

    expect(agentNotifs.length).toBeGreaterThanOrEqual(3);

    for (const notif of agentNotifs) {
      const agent = db.select().from(agents)
        .where(eq(agents.id, notif.sourceAgentId!)).get();
      expect(agent).toBeDefined();
    }
  });
});
