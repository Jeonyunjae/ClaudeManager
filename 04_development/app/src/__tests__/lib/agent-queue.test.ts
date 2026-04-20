/**
 * agent-queue.ts 단위 테스트
 * 대상 기능: F070~F072 (동시 에이전트 리소스 관리)
 * 수용 기준:
 *   - maxConcurrentAgents 초과 시 'queued' 상태로 전환
 *   - 활성 에이전트 종료 시 큐에서 다음을 시작
 *   - getQueueStatus()가 올바른 상태 반환
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ws-bridge
vi.mock('@/lib/ws-bridge', () => ({
  broadcastAgentStatus: vi.fn(),
}));

// Mock DB with controllable state
const mockDbState = {
  settings: [] as Array<{ key: string; value: string }>,
  agents: [] as Array<{ id: string; name: string; status: string; createdAt: string }>,
};

const mockGet = vi.fn();
const mockAll = vi.fn();
const mockRun = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();

// Create chainable mock
function createSelectChain() {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    get: vi.fn(),
    all: vi.fn(),
  };
  return chain;
}

function createUpdateChain() {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    run: vi.fn(),
  };
}

const selectChain = createSelectChain();
const updateChain = createUpdateChain();

vi.mock('@/lib/db', () => ({
  default: {
    select: vi.fn(() => selectChain),
    update: vi.fn(() => updateChain),
  },
}));

vi.mock('@/lib/constants', () => ({
  DEFAULT_MAX_CONCURRENT_AGENTS: 10,
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  count: vi.fn(() => 'count'),
  asc: vi.fn((...args: unknown[]) => args),
  sql: vi.fn(),
}));

import {
  getMaxConcurrentAgents,
  getActiveAgentCount,
  getQueuedAgents,
  tryActivateAgent,
  onAgentFinished,
  getQueueStatus,
} from '@/lib/agent-queue';

describe('agent-queue.ts - 에이전트 큐잉', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- AC: getMaxConcurrentAgents ---
  describe('getMaxConcurrentAgents', () => {
    it('설정값이 있으면 해당 값 반환', () => {
      selectChain.get.mockReturnValueOnce({ value: '5' });
      const max = getMaxConcurrentAgents();
      expect(max).toBe(5);
    });

    it('설정값이 없으면 기본값(10) 반환', () => {
      selectChain.get.mockReturnValueOnce(undefined);
      const max = getMaxConcurrentAgents();
      expect(max).toBe(10);
    });

    it('DB 에러 시 기본값 반환', () => {
      selectChain.get.mockImplementationOnce(() => {
        throw new Error('DB error');
      });
      const max = getMaxConcurrentAgents();
      expect(max).toBe(10);
    });
  });

  // --- AC: getActiveAgentCount ---
  describe('getActiveAgentCount', () => {
    it('active 상태 에이전트 수 반환', () => {
      selectChain.all.mockReturnValueOnce([{ count: 7 }]);
      const count = getActiveAgentCount();
      expect(count).toBe(7);
    });

    it('결과가 없으면 0 반환', () => {
      selectChain.all.mockReturnValueOnce([]);
      const count = getActiveAgentCount();
      expect(count).toBe(0);
    });
  });

  // --- AC: getQueuedAgents ---
  describe('getQueuedAgents', () => {
    it('queued 상태 에이전트를 createdAt 순으로 반환', () => {
      const queued = [
        { id: 'a1', name: 'Agent 1', createdAt: '2024-01-01' },
        { id: 'a2', name: 'Agent 2', createdAt: '2024-01-02' },
      ];
      selectChain.all.mockReturnValueOnce(queued);

      const result = getQueuedAgents();
      expect(result).toEqual(queued);
    });
  });

  // --- AC: tryActivateAgent - 상한 미초과 ---
  describe('tryActivateAgent', () => {
    it('상한 미만이면 active로 활성화', () => {
      // getMaxConcurrentAgents
      selectChain.get.mockReturnValueOnce({ value: '10' });
      // getActiveAgentCount
      selectChain.all.mockReturnValueOnce([{ count: 5 }]);

      const status = tryActivateAgent('agent-new');
      expect(status).toBe('active');
    });

    it('상한 도달 시 queued로 전환', () => {
      // getMaxConcurrentAgents
      selectChain.get.mockReturnValueOnce({ value: '5' });
      // getActiveAgentCount
      selectChain.all.mockReturnValueOnce([{ count: 5 }]);

      const status = tryActivateAgent('agent-overflow');
      expect(status).toBe('queued');
    });
  });

  // --- AC: onAgentFinished ---
  describe('onAgentFinished', () => {
    it('큐에 대기 에이전트가 있으면 다음 에이전트를 활성화', () => {
      // getQueuedAgents
      selectChain.all.mockReturnValueOnce([
        { id: 'q1', name: 'Queued 1', createdAt: '2024-01-01' },
      ]);
      // getMaxConcurrentAgents
      selectChain.get.mockReturnValueOnce({ value: '10' });
      // getActiveAgentCount
      selectChain.all.mockReturnValueOnce([{ count: 8 }]);

      onAgentFinished('finished-agent');

      // Should have called update to set q1 to active
      expect(updateChain.set).toHaveBeenCalled();
      const setCall = updateChain.set.mock.calls[0][0];
      expect(setCall.status).toBe('active');
      expect(setCall.statusMessage).toBe('Promoted from queue');
    });

    it('큐가 비어있으면 아무것도 하지 않음', () => {
      selectChain.all.mockReturnValueOnce([]);

      onAgentFinished('finished-agent');

      expect(updateChain.set).not.toHaveBeenCalled();
    });
  });

  // --- AC: getQueueStatus ---
  describe('getQueueStatus', () => {
    it('올바른 상태 객체 반환', () => {
      // getMaxConcurrentAgents
      selectChain.get.mockReturnValueOnce({ value: '8' });
      // getActiveAgentCount
      selectChain.all.mockReturnValueOnce([{ count: 6 }]);
      // getQueuedAgents
      selectChain.all.mockReturnValueOnce([
        { id: 'q1', name: 'Q1', createdAt: '2024-01-01' },
      ]);

      const status = getQueueStatus();
      expect(status.maxConcurrent).toBe(8);
      expect(status.activeCount).toBe(6);
      expect(status.queuedCount).toBe(1);
      expect(status.queuedAgents).toHaveLength(1);
    });
  });
});
