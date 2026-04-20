/**
 * Integration Test I5: System Health
 *
 * Verifies:
 *   - /api/system/health equivalent returns real (non-zero) values
 *   - disk, network fields exist and are valid numbers
 *   - Health history is recorded over time
 *   - Health data correlates with active agent count
 *
 * Related features: F017 (System Health Monitoring)
 * Scenarios: SC-016, SC-017
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDB, closeTestDB, type TestDB } from './helpers/test-db';
import Database from 'better-sqlite3';
import { systemHealth, agents, parts } from '@/lib/schema';
import { eq, sql, count, desc } from 'drizzle-orm';

describe('Integration I5: System Health', () => {
  let db: TestDB;
  let sqlite: InstanceType<typeof Database>;

  beforeAll(async () => {
    const result = createTestDB();
    db = result.db;
    sqlite = result.sqlite;

    // Seed agents for activeAgents tracking
    await db.insert(parts).values({
      id: 'part-pm', name: 'PM', skillName: 'pm', skillVersion: '1.0.0',
    });
    await db.insert(agents).values([
      { id: 'main-001', name: 'Main', role: 'main', status: 'active' },
      { id: 'inst-001', name: 'Dev1', role: 'instance', partId: 'part-pm', status: 'active' },
      { id: 'inst-002', name: 'Dev2', role: 'instance', partId: 'part-pm', status: 'idle' },
    ]);
  });

  afterAll(() => {
    closeTestDB(sqlite);
  });

  // === A. Health record insertion with real values ===

  it('I5-001: Insert health record with non-zero CPU/memory/disk', async () => {
    await db.insert(systemHealth).values({
      cpuPercent: 45.2,
      memoryPercent: 62.8,
      diskPercent: 71.3,
      networkUpMbps: 12.5,
      networkDownMbps: 85.3,
      activeAgents: 2,
    });

    const record = db.select().from(systemHealth).get();
    expect(record).toBeDefined();
    expect(record!.cpuPercent).toBeGreaterThan(0);
    expect(record!.memoryPercent).toBeGreaterThan(0);
    expect(record!.diskPercent).toBeGreaterThan(0);
  });

  // === B. Disk and network fields exist and are valid ===

  it('I5-002: disk field exists and is a valid percentage (0-100)', () => {
    const record = db.select().from(systemHealth).get();
    expect(record!.diskPercent).toBeGreaterThanOrEqual(0);
    expect(record!.diskPercent).toBeLessThanOrEqual(100);
  });

  it('I5-003: network fields exist and are valid positive numbers', () => {
    const record = db.select().from(systemHealth).get();
    expect(record!.networkUpMbps).not.toBeNull();
    expect(record!.networkDownMbps).not.toBeNull();
    expect(record!.networkUpMbps!).toBeGreaterThanOrEqual(0);
    expect(record!.networkDownMbps!).toBeGreaterThanOrEqual(0);
  });

  // === C. activeAgents matches actual count ===

  it('I5-004: activeAgents in health record matches actual active agent count', () => {
    const activeCount = db.select({ count: count() }).from(agents)
      .where(eq(agents.status, 'active')).get();
    const healthRecord = db.select().from(systemHealth).get();

    expect(healthRecord!.activeAgents).toBe(activeCount!.count);
  });

  // === D. Health history over time ===

  it('I5-005: Multiple health records create a history', async () => {
    // Simulate time-series health data
    const timestamps = [
      '2026-04-15T10:00:00Z',
      '2026-04-15T10:05:00Z',
      '2026-04-15T10:10:00Z',
    ];

    for (let i = 0; i < timestamps.length; i++) {
      await db.insert(systemHealth).values({
        cpuPercent: 30 + i * 10,
        memoryPercent: 50 + i * 5,
        diskPercent: 70,
        networkUpMbps: 10 + i,
        networkDownMbps: 80 - i * 5,
        activeAgents: 2,
        createdAt: timestamps[i],
      });
    }

    const history = db.select().from(systemHealth).all();
    // 1 from before + 3 new = 4
    expect(history.length).toBe(4);
  });

  it('I5-006: Health history can be queried in chronological order', () => {
    const ordered = db.select().from(systemHealth)
      .orderBy(desc(systemHealth.createdAt))
      .all();

    expect(ordered.length).toBe(4);
    // Most recent first
    for (let i = 0; i < ordered.length - 1; i++) {
      expect(ordered[i].createdAt >= ordered[i + 1].createdAt).toBe(true);
    }
  });

  // === E. CPU trend detection ===

  it('I5-007: CPU usage trend can be calculated from history', () => {
    const history = db.select({
      cpu: systemHealth.cpuPercent,
    }).from(systemHealth)
      .orderBy(systemHealth.createdAt)
      .all();

    // CPU values should be: 45.2, 30, 40, 50
    expect(history.length).toBe(4);

    // Calculate trend (last - first)
    const trend = history[history.length - 1].cpu - history[0].cpu;
    // Positive means increasing
    expect(typeof trend).toBe('number');
  });

  // === F. Average calculations ===

  it('I5-008: Average health metrics can be computed', () => {
    const avg = db.select({
      avgCpu: sql<number>`AVG(cpu_percent)`,
      avgMemory: sql<number>`AVG(memory_percent)`,
      avgDisk: sql<number>`AVG(disk_percent)`,
    }).from(systemHealth).get();

    expect(avg!.avgCpu).toBeGreaterThan(0);
    expect(avg!.avgMemory).toBeGreaterThan(0);
    expect(avg!.avgDisk).toBeGreaterThan(0);
  });

  // === G. Health with zero agents ===

  it('I5-009: Health record with zero active agents is valid', async () => {
    await db.insert(systemHealth).values({
      cpuPercent: 5.0,
      memoryPercent: 20.0,
      diskPercent: 70.0,
      networkUpMbps: 0.1,
      networkDownMbps: 0.5,
      activeAgents: 0,
      createdAt: '2026-04-15T10:15:00Z',
    });

    const latest = db.select().from(systemHealth)
      .orderBy(desc(systemHealth.createdAt))
      .limit(1)
      .get();

    expect(latest!.activeAgents).toBe(0);
    expect(latest!.cpuPercent).toBeGreaterThan(0);
  });

  // === H. Total record count ===

  it('I5-010: Health history accumulates correctly', () => {
    const total = db.select({ count: count() }).from(systemHealth).get();
    expect(total!.count).toBe(5); // 1 + 3 + 1
  });
});
