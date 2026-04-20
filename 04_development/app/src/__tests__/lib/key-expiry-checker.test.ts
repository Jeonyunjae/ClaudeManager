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
const mockRun = vi.fn();
const mockInsertValues = vi.fn().mockReturnValue({ run: mockRun });
const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn().mockReturnValue({ run: mockRun });
mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

const mockSelectAll = vi.fn();
const mockSelectFind = vi.fn();
const mockSelectWhere = vi.fn().mockReturnValue({
  all: mockSelectAll,
  find: mockSelectFind,
});
const mockSelectFrom = vi.fn().mockReturnValue({
  where: mockSelectWhere,
});
const mockSelect = vi.fn().mockReturnValue({ from: mockSelectFrom });

vi.mock('@/lib/db', () => ({
  default: {
    insert: (...args: unknown[]) => mockInsert(...args),
    select: (...args: unknown[]) => mockSelect(...args),
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
    // Default: no keys
    mockSelectAll.mockReturnValue([]);
  });

  // --- AC: 만료된 키 상태를 expired로 변경 ---
  describe('checkKeyExpiry - 만료된 키', () => {
    it('만료된 active 키를 expired 상태로 변경', () => {
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

      checkKeyExpiry();

      // Should update key status to expired
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'expired' })
      );
    });

    it('만료된 키에 대해 알림 생성', () => {
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

      checkKeyExpiry();

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
    it('7일 이내 만료 예정 키에 대해 경고 알림 생성', () => {
      const soonDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(); // 3 days

      // First call: expired keys (none)
      mockSelectAll.mockReturnValueOnce([]);
      // Second call: expiring soon
      mockSelectAll.mockReturnValueOnce([
        {
          id: 2,
          provider: 'openai',
          keyMasked: 'sk-...xyz',
          status: 'active',
          expiresAt: soonDate,
        },
      ]);
      // Third call: check for existing notification today
      mockSelectAll.mockReturnValueOnce([]);

      checkKeyExpiry();

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
    it('만료 키가 없으면 아무것도 하지 않음', () => {
      mockSelectAll.mockReturnValueOnce([]);
      mockSelectAll.mockReturnValueOnce([]);

      checkKeyExpiry();

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
