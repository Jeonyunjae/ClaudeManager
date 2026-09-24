/**
 * lib/api.ts (ApiClient.request 내부 동작) 단위 테스트.
 * ApiClientError 생성·handleUnauthorized 순수 로직·del()의 body 처리는
 * api-client.test.ts / api-401.test.ts / api-del.test.ts에서 이미 검증했다.
 * 이 파일은 get/post/put/patch 성공 경로, 인증 헤더 부착, 401 응답 시
 * handleUnauthorized 연동, 일반 에러 응답의 ApiClientError 변환을 검증한다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import apiClient, { ApiClientError } from '@/lib/api';

describe('ApiClient.request', () => {
  const originalFetch = global.fetch;
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    });
    // getToken()이 `typeof window === 'undefined'`로 SSR을 판정하므로, 기본값으로
    // 평범한 window를 세팅해 둔다(개별 테스트에서 location.replace 검증이 필요하면 덮어쓴다).
    vi.stubGlobal('window', {
      location: { pathname: '/', search: '', replace: vi.fn() },
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllGlobals();
  });

  it('토큰이 있으면 Authorization 헤더를 붙이고, get()은 GET으로 요청한다', async () => {
    localStorage.setItem('auth_token', 'my-token');
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { hello: 'world' } }),
    })) as unknown as typeof fetch;

    const res = await apiClient.get<{ hello: string }>('/api/things');

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/things');
    expect(init.method).toBe('GET');
    expect(init.headers['Authorization']).toBe('Bearer my-token');
    expect(res.data).toEqual({ hello: 'world' });
  });

  it('토큰이 없으면 Authorization 헤더를 붙이지 않는다', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: {} }),
    })) as unknown as typeof fetch;

    await apiClient.get('/api/things');

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers['Authorization']).toBeUndefined();
  });

  it('post()는 body를 JSON으로 보내고, skipAuth=true면 토큰이 있어도 헤더를 붙이지 않는다', async () => {
    localStorage.setItem('auth_token', 'my-token');
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { token: 'new' } }),
    })) as unknown as typeof fetch;

    await apiClient.post('/api/auth/login', { password: 'x' }, true);

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ password: 'x' }));
    expect(init.headers['Authorization']).toBeUndefined();
  });

  it('put()·patch()는 각각 PUT/PATCH 메서드로 요청한다', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: {} }),
    })) as unknown as typeof fetch;

    await apiClient.put('/api/things/1', { a: 1 });
    await apiClient.patch('/api/things/1', { a: 2 });

    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][1].method).toBe('PUT');
    expect(calls[1][1].method).toBe('PATCH');
  });

  it('getPaginated()는 GET으로 요청하고 pagination을 그대로 반환한다', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [1, 2], pagination: { page: 1, limit: 30, total: 2, hasMore: false } }),
    })) as unknown as typeof fetch;

    const res = await apiClient.getPaginated<number>('/api/things?page=1');

    expect(res.data).toEqual([1, 2]);
    expect(res.pagination.hasMore).toBe(false);
  });

  it('에러 응답(4xx/5xx)은 ApiClientError로 변환해 던진다', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({ error: { code: 'NOT_FOUND', message: 'missing', details: { id: 1 } } }),
    })) as unknown as typeof fetch;

    await expect(apiClient.get('/api/things/1')).rejects.toMatchObject({
      message: 'missing',
      code: 'NOT_FOUND',
      statusCode: 404,
      details: { id: 1 },
    });
  });

  it('에러 응답에 error 필드가 없으면 기본 메시지·코드를 사용한다', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(apiClient.get('/api/things')).rejects.toMatchObject({
      message: 'Request failed',
      code: 'UNKNOWN_ERROR',
      statusCode: 500,
    });
  });

  it('401 응답이면(window 존재) 토큰을 지우고 로그인 화면으로 이동시킨다', async () => {
    localStorage.setItem('auth_token', 'my-token');
    const replace = vi.fn();
    vi.stubGlobal('window', {
      location: { pathname: '/m/status', search: '', replace },
    });
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'AUTH_EXPIRED', message: 'expired' } }),
    })) as unknown as typeof fetch;

    await expect(apiClient.get('/api/things')).rejects.toBeInstanceOf(ApiClientError);

    expect(store['auth_token']).toBeUndefined();
    expect(replace).toHaveBeenCalledWith(`/login?next=${encodeURIComponent('/m/status')}`);
  });

  it('/api/auth/ 경로의 401은 handleUnauthorized를 건너뛴다(로그인 자체 실패)', async () => {
    const replace = vi.fn();
    vi.stubGlobal('window', {
      location: { pathname: '/login', search: '', replace },
    });
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'BAD_PASSWORD', message: 'wrong password' } }),
    })) as unknown as typeof fetch;

    await expect(apiClient.post('/api/auth/login', { password: 'x' }, true)).rejects.toMatchObject({
      message: 'wrong password',
    });
    expect(replace).not.toHaveBeenCalled();
  });
});

describe('ApiClient.setToken / clearToken', () => {
  it('setToken은 localStorage에 저장하고, clearToken은 제거한다', () => {
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    });

    apiClient.setToken('abc');
    expect(store['auth_token']).toBe('abc');

    apiClient.clearToken();
    expect(store['auth_token']).toBeUndefined();

    vi.unstubAllGlobals();
  });
});
