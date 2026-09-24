/**
 * Inbox API 라우트 단위 테스트 — DES-002 §GET /api/inbox, §POST /api/inbox/{agentId}/ack
 * db mock 패턴은 `__tests__/lib/agent-queue.test.ts`를 참고했다 (select 호출 순서대로
 * 결과를 꺼내 쓰는 체인 형태).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { generateToken } from '@/lib/auth';

const h = vi.hoisted(() => {
  const pending: unknown[] = [];

  function makeSelectChain() {
    const chain: Record<string, unknown> = {};
    for (const method of ['from', 'where', 'orderBy', 'limit']) {
      chain[method] = vi.fn(() => chain);
    }
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

  const insertChain: Record<string, unknown> = {
    values: vi.fn(() => Promise.resolve()),
  };

  return { pending, makeSelectChain, updateChain, insertChain };
});

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => h.makeSelectChain()),
    update: vi.fn(() => h.updateChain),
    insert: vi.fn(() => h.insertChain),
  },
}));

/** 다음 select 가 돌려줄 행들을 쌓는다 */
function queueRows(rows: unknown[] | Error) {
  h.pending.push(rows);
}

function authHeaders(): Record<string, string> {
  const token = generateToken(1);
  return { Authorization: `Bearer ${token}` };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.pending.length = 0;
});

describe('GET /api/inbox', () => {
  it('인증 없이 호출하면 401 AUTH_TOKEN_EXPIRED', async () => {
    const { GET } = await import('@/app/api/inbox/route');
    const req = new NextRequest('http://localhost/api/inbox');
    const res = await GET(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe('AUTH_TOKEN_EXPIRED');
  });

  it('인증되면 200과 대기 목록·count를 반환한다', async () => {
    const { GET } = await import('@/app/api/inbox/route');

    // 1) chat_messages 전체
    queueRows([
      {
        id: 'msg-1',
        sender: 'sub-1',
        content: '분석을 마쳤습니다.',
        messageType: 'text',
        metadata: JSON.stringify({ agentId: 'sub-1' }),
        createdAt: '2026-09-24T01:00:00.000Z',
      },
    ]);
    // 2) agents 전체
    queueRows([
      { id: 'sub-1', name: 'ClaudeManagerMobile', role: 'sub', status: 'active' },
    ]);
    // 3) settings inbox_ack (없음)
    queueRows([]);

    const req = new NextRequest('http://localhost/api/inbox', { headers: authHeaders() });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.meta.count).toBe(1);
    expect(json.data[0]).toMatchObject({ agentId: 'sub-1', agentName: 'ClaudeManagerMobile' });
  });

  it('DB 조회 실패 시 500 SYSTEM_ERROR', async () => {
    const { GET } = await import('@/app/api/inbox/route');
    queueRows(new Error('db down'));

    const req = new NextRequest('http://localhost/api/inbox', { headers: authHeaders() });
    const res = await GET(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe('SYSTEM_ERROR');
  });
});

describe('POST /api/inbox/{agentId}/ack', () => {
  it('인증 없이 호출하면 401 AUTH_TOKEN_EXPIRED', async () => {
    const { POST } = await import('@/app/api/inbox/[agentId]/ack/route');
    const req = new NextRequest('http://localhost/api/inbox/sub-1/ack', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ agentId: 'sub-1' }) });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe('AUTH_TOKEN_EXPIRED');
  });

  it('agents에 없는 id면 404 AGENT_NOT_FOUND', async () => {
    const { POST } = await import('@/app/api/inbox/[agentId]/ack/route');
    queueRows([]); // agents 조회 결과 없음

    const req = new NextRequest('http://localhost/api/inbox/nope/ack', {
      method: 'POST',
      headers: authHeaders(),
    });
    const res = await POST(req, { params: Promise.resolve({ agentId: 'nope' }) });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe('AGENT_NOT_FOUND');
  });

  it('정상 처리 시 200과 ackAt을 반환하고 settings를 upsert한다 (신규)', async () => {
    const { POST } = await import('@/app/api/inbox/[agentId]/ack/route');
    queueRows([{ id: 'sub-1', name: 'Sub', role: 'sub', status: 'active' }]); // agents
    queueRows([]); // settings 없음 -> insert

    const req = new NextRequest('http://localhost/api/inbox/sub-1/ack', {
      method: 'POST',
      headers: authHeaders(),
    });
    const res = await POST(req, { params: Promise.resolve({ agentId: 'sub-1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.agentId).toBe('sub-1');
    expect(typeof json.data.ackAt).toBe('string');
    expect(h.insertChain.values).toHaveBeenCalledTimes(1);
  });

  it('기존 inbox_ack이 있으면 update로 반영한다', async () => {
    const { POST } = await import('@/app/api/inbox/[agentId]/ack/route');
    queueRows([{ id: 'sub-1', name: 'Sub', role: 'sub', status: 'active' }]); // agents
    queueRows([{ key: 'inbox_ack', value: JSON.stringify({ 'main-1': '2026-01-01T00:00:00.000Z' }) }]); // settings 있음

    const req = new NextRequest('http://localhost/api/inbox/sub-1/ack', {
      method: 'POST',
      headers: authHeaders(),
    });
    const res = await POST(req, { params: Promise.resolve({ agentId: 'sub-1' }) });
    expect(res.status).toBe(200);
    expect(h.updateChain.set).toHaveBeenCalledTimes(1);
  });

  it('DB 실패 시 500 SYSTEM_ERROR', async () => {
    const { POST } = await import('@/app/api/inbox/[agentId]/ack/route');
    queueRows(new Error('db down'));

    const req = new NextRequest('http://localhost/api/inbox/sub-1/ack', {
      method: 'POST',
      headers: authHeaders(),
    });
    const res = await POST(req, { params: Promise.resolve({ agentId: 'sub-1' }) });
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe('SYSTEM_ERROR');
  });
});
