/**
 * key-expiry-checker.ts 단위 테스트
 * 대상 기능: F038 (키 만료일 알림)
 * 수용 기준:
 *   - 만료 7일 이내 키에 대해 알림 생성
 *   - 만료된 키 상태를 'expired'로 변경
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ws-bridge
vi.mock('@/lib/ws-bridge', () => ({
  broadcastNotification: vi.fn(),
}));

// Mock DB
// PostgreSQL 전환 반영: 구현이 동기 `.all()`/`.run()`(better-sqlite3) 에서
// await 가능한 drizzle 빌더로 바뀌었다. select 는 "await 하면 행 배열을 주는
// 체인"으로, insert/update 는 Promise 로 맞춘다.
const mockRun = vi.fn();
const mockInsertValues = vi.fn((_values: Record<string, unknown>) => { mockRun(); return Promise.resolve(); });
const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

const mockUpdateWhere = vi.fn(() => { mockRun(); return Promise.resolve(); });
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

// select 결과: Once 로 쌓은 것이 순서대로 먼저 나가고, 비면 기본값을 돌려준다
const selectQueue: unknown[][] = [];
let selectDefault: unknown[] = [];
const mockSelectAll = {
  mockReturnValue: (rows: unknown[]) => { selectDefault = rows; },
  mockReturnValueOnce: (rows: unknown[]) => { selectQueue.push(rows); },
};

const mockSelect = vi.fn(() => {
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'where', 'orderBy', 'limit']) chain[m] = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve(selectQueue.length ? selectQueue.shift() : selectDefault).then(resolve);
  return chain;
});

vi.mock('@/lib/db', () => ({
  default: {
    insert: (...args: unknown[]) => mockInsert(...args),
    select: () => mockSelect(),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    and: vi.fn((...args: unknown[]) => args),
    lte: vi.fn((...args: unknown[]) => args),
    eq: vi.fn((...args: unknown[]) => args),
    not: vi.fn((...args: unknown[]) => args),
  };
});

import { checkKeyExpiry, startKeyExpiryChecker, stopKeyExpiryChecker } from '@/lib/key-expiry-checker';
import { broadcastNotification } from '@/lib/ws-bridge';

describe('key-expiry-checker.ts - 키 만료 체크', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectQueue.length = 0;
    selectDefault = [];
    // Default: no keys
    mockSelectAll.mockReturnValue([]);
  });

  // --- AC: 만료된 키 상태를 expired로 변경 ---
  describe('checkKeyExpiry - 만료된 키', () => {
    it('만료된 active 키를 expired 상태로 변경', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // First call: expired keys query
      mockSelectAll.mockReturnValueOnce([
        {
          id: 1,
          provider: 'anthropic',
          keyMasked: 'sk-...abc',
          status: 'active',
          expiresAt: pastDate,
        },
      ]);
      // Second call: expiring soon query
      mockSelectAll.mockReturnValueOnce([]);

      await checkKeyExpiry();

      // Should update key status to expired
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'expired' })
      );
    });

    it('만료된 키에 대해 알림 생성', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      mockSelectAll.mockReturnValueOnce([
        {
          id: 1,
          provider: 'anthropic',
          keyMasked: 'sk-...abc',
          status: 'active',
          expiresAt: pastDate,
        },
      ]);
      mockSelectAll.mockReturnValueOnce([]);

      await checkKeyExpiry();

      // Should insert a notification
      expect(mockInsert).toHaveBeenCalled();
      const notifValues = mockInsertValues.mock.calls[0][0];
      expect(notifValues.type).toBe('warning');
      expect(notifValues.title).toContain('Expired');
      expect(notifValues.message).toContain('anthropic');
      expect(notifValues.message).toContain('sk-...abc');

      // Should broadcast
      expect(broadcastNotification).toHaveBeenCalled();
    });
  });

  // --- AC: 만료 7일 이내 키에 대해 알림 ---
  describe('checkKeyExpiry - 곧 만료될 키', () => {
    it('7일 이내 만료 예정 키에 대해 경고 알림 생성', async () => {
      const soonDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(); // 3 days

      // 구현은 active 키를 한 번만 조회하고 만료/임박을 JS 에서 가른다.
      // (예전 구현은 쿼리를 둘로 나눴고, 테스트도 그 모양에 맞춰져 있었다)
      mockSelectAll.mockReturnValueOnce([
        {
          id: 2,
          provider: 'openai',
          keyMasked: 'sk-...xyz',
          status: 'active',
          expiresAt: soonDate,
        },
      ]);
      // 그다음 조회: 오늘 이미 보낸 알림이 있는지
      mockSelectAll.mockReturnValueOnce([]);

      await checkKeyExpiry();

      // Should insert a warning notification
      const notifCalls = mockInsertValues.mock.calls;
      expect(notifCalls.length).toBeGreaterThanOrEqual(1);
      const notif = notifCalls[0][0];
      expect(notif.type).toBe('key_expiry_warning');
      expect(notif.title).toContain('Expiring Soon');
      expect(notif.message).toContain('openai');
      expect(notif.message).toContain('day(s)');
    });
  });

  // --- AC: 만료 키 없을 때 ---
  describe('checkKeyExpiry - 만료 키 없음', () => {
    it('만료 키가 없으면 아무것도 하지 않음', async () => {
      mockSelectAll.mockReturnValueOnce([]);
      mockSelectAll.mockReturnValueOnce([]);

      await checkKeyExpiry();

      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  // --- AC: 스케줄러 시작/정지 ---
  describe('startKeyExpiryChecker / stopKeyExpiryChecker', () => {
    it('스케줄러 시작 및 정지', () => {
      // Mock to prevent actual check
      mockSelectAll.mockReturnValue([]);

      startKeyExpiryChecker();
      stopKeyExpiryChecker();
    });
  });
});
