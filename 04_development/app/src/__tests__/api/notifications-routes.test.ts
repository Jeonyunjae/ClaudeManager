/**
 * 알림 API 라우트 단위 테스트 — DES-002 §GET /api/notifications, §POST /api/notifications/mark-read (DF-005)
 * db mock 패턴은 `__tests__/api/inbox-routes.test.ts`를 참고했다 (select 호출 순서대로
 * 결과를 꺼내 쓰는 체인 형태). update 체인은 `.returning()`을 추가로 갖춘다
 * (lib/notify.ts·mark-read 모두 `returning`으로 실제 변경 건수를 센다).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { generateToken } from '@/lib/auth';

const h = vi.hoisted(() => {
  const selectQueue: unknown[] = [];

  function makeSelectChain() {
    const chain: Record<string, unknown> = {};
    for (const method of ['from', 'where', 'orderBy', 'limit', 'offset']) {
      chain[method] = vi.fn(() => chain);
    }
    chain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
      const next = selectQueue.shift();
      return next instanceof Error
        ? Promise.reject(next).then(resolve, reject)
        : Promise.resolve(next ?? []).then(resolve, reject);
    };
    return chain;
  }

  const updateReturning = vi.fn();
  const updateWhere = vi.fn(() => ({ returning: updateReturning }));
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));
  const select = vi.fn(() => makeSelectChain());

  return { selectQueue, select, update, updateSet, updateWhere, updateReturning };
});

vi.mock('@/lib/db', () => ({
  default: {
    select: () => h.select(),
    update: () => h.update(),
  },
}));

const mockWsBroadcast = vi.fn(() => Promise.resolve());
vi.mock('@/lib/ws-bridge', () => ({
  wsBroadcast: mockWsBroadcast,
}));

/** 다음 select가 돌려줄 행들을 쌓는다 */
function queueRows(rows: unknown[] | Error) {
  h.selectQueue.push(rows);
}

function authHeaders(): Record<string, string> {
  const token = generateToken(1);
  return { Authorization: `Bearer ${token}` };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.selectQueue.length = 0;
  h.updateReturning.mockResolvedValue([]);
});

describe('GET /api/notifications (DF-005)', () => {
  it('인증 없이 호출하면 401 AUTH_TOKEN_EXPIRED', async () => {
    const { GET } = await import('@/app/api/notifications/route');
    const req = new NextRequest('http://localhost/api/notifications');
    const res = await GET(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe('AUTH_TOKEN_EXPIRED');
  });

  it('전체 조회 시 total은 전체 건수, 항목에 targetUrl을 포함한다', async () => {
    const { GET } = await import('@/app/api/notifications/route');

    queueRows([
      {
        id: 1,
        type: 'info',
        title: 'A 응답 완료',
        message: 'preview',
        sourceAgentId: 'agent-1',
        targetUrl: '/m/chat/agent-1',
        isRead: false,
        createdAt: '2026-09-24T01:00:00.000Z',
      },
    ]); // results
    queueRows([{ count: 5 }]); // totalResult (전체)
    queueRows([{ count: 2 }]); // unreadResult

    const req = new NextRequest('http://localhost/api/notifications', { headers: authHeaders() });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.pagination.total).toBe(5);
    expect(json.unreadCount).toBe(2);
    expect(json.data[0]).toMatchObject({ id: 1, targetUrl: '/m/chat/agent-1' });
  });

  it('unread=true면 total도 안 읽은 건수로 센다 (DF-005)', async () => {
    const { GET } = await import('@/app/api/notifications/route');

    queueRows([
      {
        id: 2,
        type: 'error',
        title: 'B 오류',
        message: 'm',
        sourceAgentId: null,
        targetUrl: '/m/status',
        isRead: false,
        createdAt: '2026-09-24T02:00:00.000Z',
      },
    ]); // results (unread만)
    queueRows([{ count: 5 }]); // totalResult (전체 — 이 값은 unread=true일 때 쓰이지 않아야 한다)
    queueRows([{ count: 3 }]); // unreadResult

    const req = new NextRequest('http://localhost/api/notifications?unread=true', { headers: authHeaders() });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.pagination.total).toBe(3);
    expect(json.unreadCount).toBe(3);
  });

  it('DB 조회 실패 시 500 SYSTEM_ERROR', async () => {
    const { GET } = await import('@/app/api/notifications/route');
    queueRows(new Error('db down'));

    const req = new NextRequest('http://localhost/api/notifications', { headers: authHeaders() });
    const res = await GET(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe('SYSTEM_ERROR');
  });
});

describe('POST /api/notifications/mark-read (DF-005)', () => {
  it('인증 없이 호출하면 401 AUTH_TOKEN_EXPIRED', async () => {
    const { POST } = await import('@/app/api/notifications/mark-read/route');
    const req = new NextRequest('http://localhost/api/notifications/mark-read', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe('AUTH_TOKEN_EXPIRED');
  });

  it('ids 없이 부르면 전체 읽음 처리하고 updated는 실제 변경 행 수, notification:read {ids:"all"}을 방송한다', async () => {
    const { POST } = await import('@/app/api/notifications/mark-read/route');
    h.updateReturning.mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }]);

    const req = new NextRequest('http://localhost/api/notifications/mark-read', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.data.updated).toBe(3);
    expect(mockWsBroadcast).toHaveBeenCalledWith('notification:read', { ids: 'all' });
  });

  it('ids를 주면 실제로 바뀐 행만큼 updated를 세고, notification:read {ids}를 방송한다', async () => {
    const { POST } = await import('@/app/api/notifications/mark-read/route');
    // 요청은 3건이지만 실제로 바뀐(이미 읽지 않은) 것은 2건 — returning 기준으로 세야 한다
    h.updateReturning.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

    const req = new NextRequest('http://localhost/api/notifications/mark-read', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ ids: [1, 2, 3] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.data.updated).toBe(2);
    expect(mockWsBroadcast).toHaveBeenCalledWith('notification:read', { ids: [1, 2] });
  });

  it('DB 실패 시 500 SYSTEM_ERROR', async () => {
    const { POST } = await import('@/app/api/notifications/mark-read/route');
    h.updateReturning.mockRejectedValueOnce(new Error('db down'));

    const req = new NextRequest('http://localhost/api/notifications/mark-read', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe('SYSTEM_ERROR');
  });
});
