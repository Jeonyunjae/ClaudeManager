/**
 * Integration Test: DB <-> API Key Management Flow
 *
 * 검증 범위:
 * - API 키 등록(암호화) -> 조회(마스킹) -> 갱신 -> 삭제
 * - AES-256-GCM 암호화/복호화가 DB 저장/조회 과정에서 정상 동작하는지 검증
 * - 감사 로그 기록 검증
 *
 * 관련 기능: F036~F039 (API 키 관리)
 * 시나리오: SC-011 (API 키 관리)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDB, closeTestDB, type TestDB } from './helpers/test-db';
import Database from 'better-sqlite3';
import { apiKeys, auditLogs } from '@/lib/schema';
import { encrypt, decrypt, maskApiKey } from '@/lib/crypto';
import { eq } from 'drizzle-orm';

describe('Integration: DB <-> API Key Management Flow', () => {
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

  const TEST_KEY = 'sk-ant-api03-test-key-1234567890abcdef';

  // === 등록 ===

  it('INT-KEY-001: API 키 암호화 후 DB 저장', () => {
    const { encrypted, iv, tag } = encrypt(TEST_KEY);
    const masked = maskApiKey(TEST_KEY);

    const result = db.insert(apiKeys).values({
      provider: 'anthropic',
      keyEncrypted: encrypted,
      keyIv: iv,
      keyTag: tag,
      keyMasked: masked,
      status: 'active',
      expiresAt: '2027-12-31T23:59:59Z',
    }).run();

    expect(Number(result.lastInsertRowid)).toBe(1);
  });

  it('INT-KEY-002: 저장된 키를 복호화하면 원본과 일치', () => {
    const key = db.select().from(apiKeys).where(eq(apiKeys.id, 1)).get();
    expect(key).toBeDefined();

    const decrypted = decrypt(key!.keyEncrypted, key!.keyIv, key!.keyTag);
    expect(decrypted).toBe(TEST_KEY);
  });

  it('INT-KEY-003: 조회 시 마스킹된 키가 반환', () => {
    const key = db.select().from(apiKeys).where(eq(apiKeys.id, 1)).get();
    expect(key!.keyMasked).toBe(maskApiKey(TEST_KEY));
    expect(key!.keyMasked).toContain('...');
    // 마스킹된 키는 원본과 다름
    expect(key!.keyMasked).not.toBe(TEST_KEY);
  });

  it('INT-KEY-004: API 키 등록 감사 로그 기록', () => {
    db.insert(auditLogs).values({
      actorType: 'user',
      actorId: '1',
      action: 'register_apikey',
      resource: 'apikey',
      resourceId: '1',
      detail: JSON.stringify({ provider: 'anthropic' }),
    }).run();

    const logs = db.select().from(auditLogs)
      .where(eq(auditLogs.action, 'register_apikey')).all();
    expect(logs.length).toBe(1);
    expect(JSON.parse(logs[0].detail!).provider).toBe('anthropic');
  });

  // === 갱신 ===

  it('INT-KEY-005: API 키 갱신 (새 키로 교체)', () => {
    const newKey = 'sk-ant-api03-new-key-abcdef1234567890';
    const { encrypted, iv, tag } = encrypt(newKey);
    const masked = maskApiKey(newKey);

    db.update(apiKeys).set({
      keyEncrypted: encrypted,
      keyIv: iv,
      keyTag: tag,
      keyMasked: masked,
      updatedAt: new Date().toISOString(),
    }).where(eq(apiKeys.id, 1)).run();

    const updated = db.select().from(apiKeys).where(eq(apiKeys.id, 1)).get();
    const decrypted = decrypt(updated!.keyEncrypted, updated!.keyIv, updated!.keyTag);
    expect(decrypted).toBe(newKey);
    expect(updated!.keyMasked).toBe(maskApiKey(newKey));
  });

  it('INT-KEY-006: 만료일 갱신', () => {
    const newExpiry = '2028-06-30T23:59:59Z';
    db.update(apiKeys).set({
      expiresAt: newExpiry,
      updatedAt: new Date().toISOString(),
    }).where(eq(apiKeys.id, 1)).run();

    const key = db.select().from(apiKeys).where(eq(apiKeys.id, 1)).get();
    expect(key!.expiresAt).toBe(newExpiry);
  });

  // === 여러 프로바이더 키 등록 ===

  it('INT-KEY-007: 여러 프로바이더 키 등록', () => {
    const openaiKey = 'sk-openai-test-key-abcdef123';
    const { encrypted, iv, tag } = encrypt(openaiKey);

    db.insert(apiKeys).values({
      provider: 'openai',
      keyEncrypted: encrypted,
      keyIv: iv,
      keyTag: tag,
      keyMasked: maskApiKey(openaiKey),
      status: 'active',
    }).run();

    const allKeys = db.select().from(apiKeys).all();
    expect(allKeys.length).toBe(2);
    expect(allKeys.map(k => k.provider).sort()).toEqual(['anthropic', 'openai']);
  });

  // === 삭제 ===

  it('INT-KEY-008: API 키 삭제', () => {
    db.delete(apiKeys).where(eq(apiKeys.id, 2)).run();

    const remaining = db.select().from(apiKeys).all();
    expect(remaining.length).toBe(1);
    expect(remaining[0].provider).toBe('anthropic');
  });

  it('INT-KEY-009: 삭제 감사 로그 기록', () => {
    db.insert(auditLogs).values({
      actorType: 'user',
      actorId: '1',
      action: 'delete_apikey',
      resource: 'apikey',
      resourceId: '2',
    }).run();

    const logs = db.select().from(auditLogs)
      .where(eq(auditLogs.action, 'delete_apikey')).all();
    expect(logs.length).toBe(1);
  });

  it('INT-KEY-010: 존재하지 않는 키 조회 시 undefined', () => {
    const key = db.select().from(apiKeys).where(eq(apiKeys.id, 999)).get();
    expect(key).toBeUndefined();
  });
});
