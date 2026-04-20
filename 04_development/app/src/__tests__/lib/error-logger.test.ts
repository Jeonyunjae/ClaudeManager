/**
 * error-logger.ts 단위 테스트
 * 대상 기능: F034 (오류 로그 저장)
 * 수용 기준:
 *   - logError가 agentLogs 테이블에 레코드를 INSERT
 *   - 에러 메시지, 스택 트레이스가 포함
 *   - agentId가 없으면 'system'으로 기록
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ws-bridge to prevent actual HTTP calls
vi.mock('@/lib/ws-bridge', () => ({
  broadcastLogNew: vi.fn(),
}));

// Mock db
const mockRun = vi.fn();
const mockValues = vi.fn().mockReturnValue({ run: mockRun });
const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
const mockDb = { insert: mockInsert };

vi.mock('@/lib/db', () => ({
  default: {
    insert: (...args: unknown[]) => mockDb.insert(...args),
  },
}));

import { logError, logAndFormatError } from '@/lib/error-logger';
import { broadcastLogNew } from '@/lib/ws-bridge';

describe('error-logger.ts - 에러 DB 저장', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- AC: logError가 agentLogs에 INSERT ---
  describe('logError', () => {
    it('Error 객체를 agentLogs 테이블에 INSERT', () => {
      const err = new Error('Test error message');
      logError(err);

      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(mockValues).toHaveBeenCalledTimes(1);

      const insertedValues = mockValues.mock.calls[0][0];
      expect(insertedValues.eventType).toBe('error');
      expect(insertedValues.message).toBe('Test error message');
    });

    it('에러 메시지와 스택 트레이스 포함', () => {
      const err = new Error('Stack test');
      logError(err);

      const insertedValues = mockValues.mock.calls[0][0];
      expect(insertedValues.message).toBe('Stack test');

      const detail = JSON.parse(insertedValues.detail);
      expect(detail.stack).toBeDefined();
      expect(detail.stack).toContain('Stack test');
    });

    it('agentId가 없으면 system으로 기록', () => {
      logError(new Error('no agent'));

      const insertedValues = mockValues.mock.calls[0][0];
      expect(insertedValues.agentId).toBe('system');
    });

    it('agentId가 주어지면 해당 값으로 기록', () => {
      logError(new Error('with agent'), { agentId: 'agent-xyz' });

      const insertedValues = mockValues.mock.calls[0][0];
      expect(insertedValues.agentId).toBe('agent-xyz');
    });

    it('requestPath와 resourceId가 detail에 포함', () => {
      logError(new Error('request error'), {
        requestPath: '/api/settings',
        resourceId: 'setting-123',
      });

      const detail = JSON.parse(mockValues.mock.calls[0][0].detail);
      expect(detail.requestPath).toBe('/api/settings');
      expect(detail.resourceId).toBe('setting-123');
    });

    it('추가 context 정보가 detail에 포함', () => {
      logError(new Error('context error'), {
        context: { customField: 'value', count: 42 },
      });

      const detail = JSON.parse(mockValues.mock.calls[0][0].detail);
      expect(detail.customField).toBe('value');
      expect(detail.count).toBe(42);
    });

    it('문자열 에러도 처리', () => {
      logError('string error');

      const insertedValues = mockValues.mock.calls[0][0];
      expect(insertedValues.message).toBe('string error');
    });

    it('WebSocket으로도 브로드캐스트', () => {
      logError(new Error('broadcast test'), { agentId: 'agent-1' });

      expect(broadcastLogNew).toHaveBeenCalledWith('agent-1', expect.objectContaining({
        eventType: 'error',
        message: 'broadcast test',
      }));
    });

    it('DB 쓰기 실패 시에도 throw하지 않음', () => {
      mockRun.mockImplementationOnce(() => {
        throw new Error('DB write failed');
      });

      // Should not throw
      expect(() => logError(new Error('safe error'))).not.toThrow();
    });
  });

  // --- AC: logAndFormatError ---
  describe('logAndFormatError', () => {
    it('에러를 로그하고 포맷된 응답 반환', () => {
      const result = logAndFormatError(
        new Error('bad request'),
        'VALIDATION_ERROR',
        'Invalid input provided'
      );

      expect(result).toEqual({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input provided',
        },
      });
      expect(mockInsert).toHaveBeenCalledTimes(1);
    });
  });
});
