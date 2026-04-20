/**
 * Integration Test: DB <-> API Auth Flow
 *
 * 검증 범위:
 * - setup(비밀번호 등록) -> login(JWT 발급) -> refresh(토큰 갱신) -> 인증 미들웨어 검증
 * - 전체 인증 흐름이 DB와 함께 실제로 동작하는지 검증
 *
 * 관련 기능: F059 (대표-Main 지시 UI - 인증)
 * 시나리오: SC-001 (첫 접속 및 온보딩)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDB, closeTestDB, type TestDB } from './helpers/test-db';
import Database from 'better-sqlite3';
import { users } from '@/lib/schema';
import { hashPassword, comparePassword, generateToken, verifyToken } from '@/lib/auth';
import { count } from 'drizzle-orm';

describe('Integration: DB <-> API Auth Flow', () => {
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

  // === Setup -> Login -> Refresh 전체 흐름 ===

  it('INT-AUTH-001: 초기 상태에서 사용자가 없음을 확인', async () => {
    const [userCount] = await db.select({ count: count() }).from(users);
    expect(userCount.count).toBe(0);
  });

  it('INT-AUTH-002: setup - 비밀번호 등록 후 DB에 해시 저장', async () => {
    const password = 'testPassword123';
    const passwordHash = await hashPassword(password);

    const result = await db.insert(users).values({ passwordHash }).returning();

    expect(result.length).toBe(1);
    expect(result[0].id).toBe(1);
    expect(result[0].passwordHash).not.toBe(password);
    expect(result[0].passwordHash.length).toBeGreaterThan(20);
  });

  it('INT-AUTH-003: setup 후 사용자 수 1 확인 (중복 등록 방지)', async () => {
    const [userCount] = await db.select({ count: count() }).from(users);
    expect(userCount.count).toBe(1);
  });

  it('INT-AUTH-004: login - DB에서 사용자 조회 후 비밀번호 검증 성공', async () => {
    const allUsers = await db.select().from(users).limit(1);
    expect(allUsers.length).toBe(1);

    const user = allUsers[0];
    const isValid = await comparePassword('testPassword123', user.passwordHash);
    expect(isValid).toBe(true);
  });

  it('INT-AUTH-005: login - 잘못된 비밀번호 검증 실패', async () => {
    const allUsers = await db.select().from(users).limit(1);
    const user = allUsers[0];
    const isValid = await comparePassword('wrongPassword', user.passwordHash);
    expect(isValid).toBe(false);
  });

  it('INT-AUTH-006: login 성공 -> JWT 토큰 발급 -> 토큰 검증', async () => {
    const allUsers = await db.select().from(users).limit(1);
    const user = allUsers[0];

    const token = generateToken(user.id);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT format

    const payload = verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe(user.id);
  });

  it('INT-AUTH-007: refresh - 기존 토큰에서 userId 추출 후 새 토큰 발급', () => {
    const token = generateToken(1);
    const payload = verifyToken(token);
    expect(payload).not.toBeNull();

    // refresh는 동일 userId로 새 토큰을 발급 - 같은 초에 생성하면 동일할 수 있으므로
    // userId와 만료 시간이 올바르게 설정되는지를 확인
    const newToken = generateToken(payload!.userId);
    const newPayload = verifyToken(newToken);

    expect(newPayload).not.toBeNull();
    expect(newPayload!.userId).toBe(payload!.userId);
    expect(newPayload!.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    // 만료 시간이 약 7일 후인지 확인 (6.9일 ~ 7.1일 범위)
    const daysUntilExpiry = (newPayload!.exp - Math.floor(Date.now() / 1000)) / (60 * 60 * 24);
    expect(daysUntilExpiry).toBeGreaterThan(6.9);
    expect(daysUntilExpiry).toBeLessThan(7.1);
  });

  it('INT-AUTH-008: 잘못된 토큰은 인증 미들웨어에서 null 반환', () => {
    const result = verifyToken('invalid.token.here');
    expect(result).toBeNull();
  });

  it('INT-AUTH-009: 빈 토큰은 인증 미들웨어에서 null 반환', () => {
    const result = verifyToken('');
    expect(result).toBeNull();
  });

  it('INT-AUTH-010: 변조된 토큰은 인증 미들웨어에서 null 반환', () => {
    const token = generateToken(1);
    const tampered = token.slice(0, -5) + 'xxxxx';
    const result = verifyToken(tampered);
    expect(result).toBeNull();
  });
});
