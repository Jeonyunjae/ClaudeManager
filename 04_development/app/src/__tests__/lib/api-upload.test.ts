/**
 * apiClient.upload 단위 테스트 — FEAT-001
 * FormData는 JSON 직렬화하지 않고, Content-Type은 브라우저(fetch)가 boundary와 함께 정하도록 비워 둔다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import apiClient from '@/lib/api';

describe('apiClient.upload', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { path: '/x/a.jpg' } }),
    })) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('FormData를 그대로 POST 하고 Content-Type을 지정하지 않는다', async () => {
    const form = new FormData();
    form.append('file', new Blob(['x'], { type: 'image/jpeg' }), 'a.jpg');

    const res = await apiClient.upload<{ path: string }>('/api/upload', form);

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/upload');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(form);
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(res.data.path).toBe('/x/a.jpg');
  });

  it('JSON 요청은 기존대로 Content-Type application/json', async () => {
    await apiClient.post('/api/x', { a: 1 });
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"a":1}');
  });
});
