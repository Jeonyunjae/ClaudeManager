/**
 * 알림 API 라우트 단위 테스트 — DES-002 §GET /api/notifications, §POST /api/notifications/mark-read (DF-005)
 * db mock 패턴은 `__tests__/api/inbox-routes.test.ts`를 참고했다 (select 호출 순서대로
 * 결과를 꺼내 쓰는 체인 형태). update 체인은 `.returning()`을 추가로 갖춘다
 * (lib/notify.ts·mark-read 모두 `returning`으로 실제 변경 건수를 센다).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
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
  const updateWhere = vi.fn((_condition?: unknown) => ({ returning: updateReturning }));
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

  // BUG-013: Postgres count(*)는 bigint를 반환하고 드라이버가 이를 문자열로 매핑한다 —
  // sql<number>는 타입 단언일 뿐이라 실제로는 total·unreadCount가 문자열("5")로 내려왔다.
  it('count(*) 결과가 문자열(bigint 매핑)이어도 total·unreadCount는 숫자다 (BUG-013)', async () => {
    const { GET } = await import('@/app/api/notifications/route');

    queueRows([
      {
        id: 1,
        type: 'info',
        title: 'A',
        message: 'm',
        sourceAgentId: null,
        targetUrl: '/m/notifications',
        isRead: false,
        createdAt: '2026-09-24T01:00:00.000Z',
      },
    ]); // results
    queueRows([{ count: '5' }]); // totalResult — pg 드라이버가 bigint를 문자열로 내려주는 경우
    queueRows([{ count: '2' }]); // unreadResult

    const req = new NextRequest('http://localhost/api/notifications', { headers: authHeaders() });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.pagination.total).toBe(5);
    expect(typeof json.pagination.total).toBe('number');
    expect(json.unreadCount).toBe(2);
    expect(typeof json.unreadCount).toBe('number');
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

  // BUG-016: ids 지정 분기의 WHERE에 isRead=false 조건이 빠져 있어, 이미 읽은
  // id를 다시 mark-read해도 매번 updated:1(재현: 같은 id 2회 연속 POST → 1차
  // {updated:1}, 2차도 {updated:1}, 기대값은 0)로 나왔다. 실제 SQL 조건을
  // PgDialect로 렌더링해 isRead=false가 ids 조건과 AND로 결합돼 있는지 구조적으로
  // 검증한다 — mock의 반환값만 바꿔치는 방식으로는 WHERE 절 누락을 못 잡는다.
  it('ids 분기의 WHERE는 대상 id뿐 아니라 isRead=false도 함께 건다 (BUG-016)', async () => {
    const { POST } = await import('@/app/api/notifications/mark-read/route');
    h.updateReturning.mockResolvedValueOnce([{ id: 1 }]);

    const req = new NextRequest('http://localhost/api/notifications/mark-read', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ ids: [1] }),
    });
    await POST(req);

    expect(h.updateWhere).toHaveBeenCalledTimes(1);
    const condition = h.updateWhere.mock.calls[0][0] as SQL;
    const dialect = new PgDialect();
    const { sql, params } = dialect.sqlToQuery(condition);

    expect(sql).toContain('is_read');
    expect(sql.toLowerCase()).toContain('and');
    expect(params).toContain(false);
  });

  // 위 구조적 검증과 별개로, 실제 재호출 시나리오를 API 응답 레벨에서도 확인한다.
  // (returning()이 실제 DB라면 isRead=false 조건 때문에 2차 호출에서 빈 배열을
  // 돌려줄 것 — 여기서는 그 DB 동작을 mock으로 흉내 낸다)
  it('같은 id로 mark-read를 연속 2번 호출하면 2차는 updated:0이고 재방송하지 않는다 (BUG-016)', async () => {
    const { POST } = await import('@/app/api/notifications/mark-read/route');

    const makeReq = () =>
      new NextRequest('http://localhost/api/notifications/mark-read', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ ids: [1] }),
      });

    h.updateReturning.mockResolvedValueOnce([{ id: 1 }]); // 1차: 아직 안 읽음 → 1건 변경
    const res1 = await POST(makeReq());
    expect((await res1.json()).data.updated).toBe(1);
    expect(mockWsBroadcast).toHaveBeenCalledWith('notification:read', { ids: [1] });

    mockWsBroadcast.mockClear();
    h.updateReturning.mockResolvedValueOnce([]); // 2차: isRead=false 조건에 걸려 0건
    const res2 = await POST(makeReq());
    expect((await res2.json()).data.updated).toBe(0);
    expect(mockWsBroadcast).not.toHaveBeenCalled();
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
