/**
 * apiClient.del 단위 테스트 — DF-012
 * `del(path)`는 기존 호출부(agentDetailStore 등)와 호환되게 바디 없이 보내고,
 * `del(path, body)`는 DES-002 `DELETE /api/notifications/subscribe`처럼 바디가 필요한
 * 엔드포인트를 위해 JSON 바디를 함께 보낸다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import apiClient from '@/lib/api';

describe('apiClient.del', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { ok: true } }),
    })) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('바디 없이 호출하면 body 없는 DELETE 요청을 보낸다 (기존 호출부 호환)', async () => {
    await apiClient.del('/api/apikeys/123');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/apikeys/123');
    expect(init.method).toBe('DELETE');
    expect(init.body).toBeUndefined();
  });

  it('body를 넘기면 JSON으로 직렬화해 DELETE 요청에 담는다', async () => {
    await apiClient.del('/api/notifications/subscribe', { endpoint: 'https://push.example/ep' });

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/notifications/subscribe');
    expect(init.method).toBe('DELETE');
    expect(init.body).toBe(JSON.stringify({ endpoint: 'https://push.example/ep' }));
  });
});
