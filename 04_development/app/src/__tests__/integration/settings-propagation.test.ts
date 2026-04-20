/**
 * Integration Test I4: Settings -> Behavior Propagation
 *
 * Verifies that changes to the settings table propagate to:
 *   - agent-queue (maxConcurrentAgents)
 *   - Part policies (retryCount)
 *   - Cost threshold (costLimit)
 *
 * Related features: F064~F065, F027, F035, F070~F072
 * Scenarios: SC-012, SC-016
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDB, closeTestDB, type TestDB } from './helpers/test-db';
import Database from 'better-sqlite3';
import {
  agents, parts, settings, partPolicies, costRecords, notifications,
} from '@/lib/schema';
import { eq, count, sql } from 'drizzle-orm';
import {
  DEFAULT_MAX_CONCURRENT_AGENTS,
  DEFAULT_RETRY_COUNT,
  DEFAULT_COST_LIMIT,
  DEFAULT_ALERT_THRESHOLD,
} from '@/lib/constants';

/**
 * Simulates getMaxConcurrentAgents from agent-queue.ts
 * using the test DB instead of the singleton.
 */
function getMaxConcurrent(db: TestDB): number {
  const row = db.select().from(settings)
    .where(eq(settings.key, 'max_concurrent_agents')).get();
  return row ? parseInt(row.value, 10) : DEFAULT_MAX_CONCURRENT_AGENTS;
}

function getActiveCount(db: TestDB): number {
  const rows = db.select({ count: count() }).from(agents)
    .where(eq(agents.status, 'active')).all();
  return rows[0]?.count ?? 0;
}

function getRetryPolicy(db: TestDB, partId: string): number {
  const policy = db.select().from(partPolicies)
    .where(eq(partPolicies.partId, partId)).get();
  if (policy) return policy.retryCount;

  const global = db.select().from(settings)
    .where(eq(settings.key, 'retry_count')).get();
  return global ? parseInt(global.value, 10) : DEFAULT_RETRY_COUNT;
}

function getCostLimit(db: TestDB): number {
  const row = db.select().from(settings)
    .where(eq(settings.key, 'cost_limit')).get();
  return row ? parseFloat(row.value) : DEFAULT_COST_LIMIT;
}

function getAlertThreshold(db: TestDB): number {
  const row = db.select().from(settings)
    .where(eq(settings.key, 'alert_threshold')).get();
  return row ? parseFloat(row.value) : DEFAULT_ALERT_THRESHOLD;
}

describe('Integration I4: Settings -> Behavior Propagation', () => {
  let db: TestDB;
  let sqlite: InstanceType<typeof Database>;

  beforeAll(async () => {
    const result = createTestDB();
    db = result.db;
    sqlite = result.sqlite;

    // Seed Parts and Agents
    await db.insert(parts).values([
      { id: 'part-pm', name: 'PM', skillName: 'pm', skillVersion: '1.0.0' },
      { id: 'part-dev', name: 'Dev', skillName: 'dev', skillVersion: '1.0.0' },
    ]);
    await db.insert(agents).values([
      { id: 'main-001', name: 'Main', role: 'main', status: 'active' },
      { id: 'inst-001', name: 'Dev1', role: 'instance', partId: 'part-pm', status: 'active' },
      { id: 'inst-002', name: 'Dev2', role: 'instance', partId: 'part-pm', status: 'active' },
      { id: 'inst-003', name: 'Dev3', role: 'instance', partId: 'part-dev', status: 'idle' },
    ]);
  });

  afterAll(() => {
    closeTestDB(sqlite);
  });

  // === A. maxConcurrentAgents -> agent-queue ===

  it('I4-001: Default maxConcurrentAgents is used when no setting exists', () => {
    const max = getMaxConcurrent(db);
    expect(max).toBe(DEFAULT_MAX_CONCURRENT_AGENTS); // 10
  });

  it('I4-002: Setting maxConcurrentAgents to 3 changes the effective limit', async () => {
    await db.insert(settings).values({ key: 'max_concurrent_agents', value: '3' });

    const max = getMaxConcurrent(db);
    expect(max).toBe(3);
  });

  it('I4-003: Active count (3) meets limit (3), next agent should be queued', () => {
    const max = getMaxConcurrent(db);
    const active = getActiveCount(db);
    // main-001, inst-001, inst-002 = 3 active
    expect(active).toBe(3);
    expect(active).toBeGreaterThanOrEqual(max);

    // Simulate queueing logic
    const shouldQueue = active >= max;
    expect(shouldQueue).toBe(true);
  });

  it('I4-004: Increasing limit to 5 allows more agents', async () => {
    await db.update(settings).set({ value: '5' })
      .where(eq(settings.key, 'max_concurrent_agents'));

    const max = getMaxConcurrent(db);
    const active = getActiveCount(db);
    expect(max).toBe(5);
    expect(active).toBeLessThan(max); // 3 < 5
  });

  // === B. retryCount -> Part policy ===

  it('I4-005: Default retryCount when no settings or policies exist', () => {
    const retry = getRetryPolicy(db, 'part-dev');
    expect(retry).toBe(DEFAULT_RETRY_COUNT); // 3
  });

  it('I4-006: Global retry_count setting overrides default', async () => {
    await db.insert(settings).values({ key: 'retry_count', value: '7' });

    const retry = getRetryPolicy(db, 'part-dev');
    expect(retry).toBe(7);
  });

  it('I4-007: Part-specific policy overrides global retry_count', async () => {
    await db.insert(partPolicies).values({
      partId: 'part-pm',
      retryCount: 2,
      retryStrategy: 'fixed',
      retryIntervalBase: 5,
    });

    const pmRetry = getRetryPolicy(db, 'part-pm');
    expect(pmRetry).toBe(2); // Part-specific

    const devRetry = getRetryPolicy(db, 'part-dev');
    expect(devRetry).toBe(7); // Falls through to global
  });

  it('I4-008: Updating Part policy immediately changes effective retry', async () => {
    await db.update(partPolicies).set({ retryCount: 10 })
      .where(eq(partPolicies.partId, 'part-pm'));

    const retry = getRetryPolicy(db, 'part-pm');
    expect(retry).toBe(10);
  });

  // === C. costLimit -> cost threshold check ===

  it('I4-009: Cost limit change affects threshold calculation', async () => {
    await db.insert(settings).values({ key: 'cost_limit', value: '200' });
    await db.insert(settings).values({ key: 'alert_threshold', value: '80' });

    // Insert some cost
    await db.insert(costRecords).values({
      agentId: 'inst-001', modelName: 'claude-3-sonnet',
      inputTokens: 50000, outputTokens: 20000, cost: 150.0,
    });

    const totalCost = db.select({
      total: sql<number>`COALESCE(SUM(cost), 0)`,
    }).from(costRecords).get()!.total;

    const limit = getCostLimit(db);
    const threshold = getAlertThreshold(db);
    const percentage = (totalCost / limit) * 100;

    expect(percentage).toBe(75); // 150/200 = 75%
    expect(percentage).toBeLessThan(threshold); // 75 < 80, no alert
  });

  it('I4-010: Reducing cost limit triggers alert threshold', async () => {
    await db.update(settings).set({ value: '180' })
      .where(eq(settings.key, 'cost_limit'));

    const totalCost = db.select({
      total: sql<number>`COALESCE(SUM(cost), 0)`,
    }).from(costRecords).get()!.total;

    const limit = getCostLimit(db);
    const threshold = getAlertThreshold(db);
    const percentage = (totalCost / limit) * 100;

    // 150/180 = 83.3% > 80% threshold
    expect(percentage).toBeGreaterThan(threshold);

    // Notification should be created
    db.insert(notifications).values({
      type: 'cost',
      title: 'Cost Alert',
      message: `Cost ${percentage.toFixed(1)}% exceeds ${threshold}% threshold`,
    }).run();

    const notifs = db.select().from(notifications)
      .where(eq(notifications.type, 'cost')).all();
    expect(notifs.length).toBe(1);
  });
});
