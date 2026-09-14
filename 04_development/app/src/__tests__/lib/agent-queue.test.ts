/**
 * agent-queue.ts 단위 테스트
 * 대상 기능: F070~F072 (동시 에이전트 리소스 관리)
 * 수용 기준:
 *   - maxConcurrentAgents 초과 시 'queued' 상태로 전환
 *   - 활성 에이전트 종료 시 큐에서 다음을 시작
 *   - getQueueStatus()가 올바른 상태 반환
 *
 * PostgreSQL 전환 반영: 구현이 동기 `.get()`/`.all()`(better-sqlite3) 에서
 * await 가능한 drizzle 쿼리 빌더로 바뀌었다. 모킹도 "await 하면 행 배열을
 * 돌려주는 체인"으로 맞춘다. 호출 순서대로 결과를 꺼내 쓰므로, 각 테스트는
 * 구현이 select 를 부르는 순서대로 queueRows() 를 쌓는다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  // 다음 select 들이 돌려줄 결과를 순서대로 쌓아둔다.
  // Error 인스턴스를 쌓으면 그 select 는 reject 된다 (DB 장애 재현용).
  const pending: unknown[] = [];

  function makeSelectChain() {
    const chain: Record<string, unknown> = {};
    for (const method of ['from', 'where', 'orderBy', 'limit']) {
      chain[method] = vi.fn(() => chain);
    }
    // await 가능하게 만든다 — drizzle 빌더가 thenable 인 것과 같은 모양
    chain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
      const next = pending.shift();
      return next instanceof Error
        ? Promise.reject(next).then(resolve, reject)
        : Promise.resolve(next ?? []).then(resolve, reject);
    };
    return chain;
  }

  const updateChain: Record<string, unknown> = {
    set: vi.fn(() => updateChain),
    where: vi.fn(() => Promise.resolve()),
  };

  return { pending, makeSelectChain, updateChain, broadcastAgentStatus: vi.fn() };
});

vi.mock('@/lib/ws-bridge', () => ({ broadcastAgentStatus: h.broadcastAgentStatus }));

vi.mock('@/lib/db', () => ({
  default: {
    select: vi.fn(() => h.makeSelectChain()),
    update: vi.fn(() => h.updateChain),
  },
}));

vi.mock('@/lib/constants', () => ({ DEFAULT_MAX_CONCURRENT_AGENTS: 10 }));

import {
  getMaxConcurrentAgents,
  getActiveAgentCount,
  getQueuedAgents,
  tryActivateAgent,
  onAgentFinished,
  getQueueStatus,
} from '@/lib/agent-queue';

/** 다음 select 가 돌려줄 행들을 쌓는다 */
function queueRows(rows: unknown[] | Error) {
  h.pending.push(rows);
}

describe('agent-queue.ts - 에이전트 큐잉', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.pending.length = 0;
  });

  // --- AC: getMaxConcurrentAgents ---
  describe('getMaxConcurrentAgents', () => {
    it('설정값이 있으면 해당 값 반환', async () => {
      queueRows([{ value: '5' }]);
      await expect(getMaxConcurrentAgents()).resolves.toBe(5);
    });

    it('설정값이 없으면 기본값(10) 반환', async () => {
      queueRows([]);
      await expect(getMaxConcurrentAgents()).resolves.toBe(10);
    });

    it('DB 에러 시 기본값 반환', async () => {
      queueRows(new Error('DB error'));
      await expect(getMaxConcurrentAgents()).resolves.toBe(10);
    });
  });

  // --- AC: getActiveAgentCount ---
  describe('getActiveAgentCount', () => {
    it('active 상태 에이전트 수 반환', async () => {
      queueRows([{ count: 7 }]);
      await expect(getActiveAgentCount()).resolves.toBe(7);
    });

    it('결과가 없으면 0 반환', async () => {
      queueRows([]);
      await expect(getActiveAgentCount()).resolves.toBe(0);
    });
  });

  // --- AC: getQueuedAgents ---
  describe('getQueuedAgents', () => {
    it('queued 상태 에이전트를 createdAt 순으로 반환', async () => {
      const queued = [
        { id: 'a1', name: 'Agent 1', createdAt: '2024-01-01' },
        { id: 'a2', name: 'Agent 2', createdAt: '2024-01-02' },
      ];
      queueRows(queued);
      await expect(getQueuedAgents()).resolves.toEqual(queued);
    });
  });

  // --- AC: tryActivateAgent ---
  describe('tryActivateAgent', () => {
    it('상한 미만이면 active로 활성화', async () => {
      queueRows([{ value: '10' }]);   // getMaxConcurrentAgents
      queueRows([{ count: 5 }]);      // getActiveAgentCount

      await expect(tryActivateAgent('agent-new')).resolves.toBe('active');
      expect((h.updateChain.set as ReturnType<typeof vi.fn>).mock.calls[0][0].status).toBe('active');
      expect(h.broadcastAgentStatus).toHaveBeenCalledWith('agent-new', 'active');
    });

    it('상한 도달 시 queued로 전환', async () => {
      queueRows([{ value: '5' }]);
      queueRows([{ count: 5 }]);

      await expect(tryActivateAgent('agent-overflow')).resolves.toBe('queued');
      expect((h.updateChain.set as ReturnType<typeof vi.fn>).mock.calls[0][0].status).toBe('queued');
    });
  });

  // --- AC: onAgentFinished ---
  describe('onAgentFinished', () => {
    it('큐에 대기 에이전트가 있으면 다음 에이전트를 활성화', async () => {
      queueRows([{ id: 'q1', name: 'Queued 1', createdAt: '2024-01-01' }]);  // getQueuedAgents
      queueRows([{ value: '10' }]);                                          // getMaxConcurrentAgents
      queueRows([{ count: 8 }]);                                             // getActiveAgentCount

      await onAgentFinished('finished-agent');

      const setMock = h.updateChain.set as ReturnType<typeof vi.fn>;
      expect(setMock).toHaveBeenCalled();
      expect(setMock.mock.calls[0][0].status).toBe('active');
      expect(setMock.mock.calls[0][0].statusMessage).toBe('Promoted from queue');
      expect(h.broadcastAgentStatus).toHaveBeenCalledWith('q1', 'active', 'Promoted from queue');
    });

    it('큐가 비어있으면 아무것도 하지 않음', async () => {
      queueRows([]);

      await onAgentFinished('finished-agent');

      expect(h.updateChain.set).not.toHaveBeenCalled();
    });

    it('상한에 도달해 있으면 승격하지 않음', async () => {
      queueRows([{ id: 'q1', name: 'Queued 1', createdAt: '2024-01-01' }]);
      queueRows([{ value: '5' }]);   // 상한 5
      queueRows([{ count: 5 }]);     // 이미 5개 활성

      await onAgentFinished('finished-agent');

      expect(h.updateChain.set).not.toHaveBeenCalled();
    });
  });

  // --- AC: getQueueStatus ---
  describe('getQueueStatus', () => {
    it('올바른 상태 객체 반환', async () => {
      queueRows([{ value: '8' }]);                                        // max
      queueRows([{ count: 6 }]);                                          // active
      queueRows([{ id: 'q1', name: 'Q1', createdAt: '2024-01-01' }]);      // queued

      const status = await getQueueStatus();
      expect(status.maxConcurrent).toBe(8);
      expect(status.activeCount).toBe(6);
      expect(status.queuedCount).toBe(1);
      expect(status.queuedAgents).toHaveLength(1);
    });
  });
});
