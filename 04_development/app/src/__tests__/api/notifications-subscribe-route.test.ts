/**
 * POST /api/notifications/subscribe 단위 테스트 — SEC-003 (SSRF 방지).
 * 인증된 사용자가 endpoint에 임의의 URL을 넣어 서버가 그 URL로 직접 POST(웹 푸시 발송 시)
 * 하게 만들 수 있었다. https + 알려진 푸시 서비스 호스트만 허용해야 한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  getAuthenticatedUserId: vi.fn(() => 1),
}));

const mockAddPushSubscription = vi.fn();
vi.mock('@/lib/push-notification', () => ({
  addPushSubscription: (...args: unknown[]) => mockAddPushSubscription(...args),
  removePushSubscription: vi.fn(),
  getVapidPublicKey: vi.fn(() => 'vapid-key'),
  isPushEnabled: vi.fn(() => true),
}));

vi.mock('@/lib/error-logger', () => ({
  logError: vi.fn(),
}));

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/notifications/subscribe', {
    method: 'POST',
    headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_KEYS = { p256dh: 'p', auth: 'a' };

beforeEach(() => {
  vi.clearAllMocks();
  mockAddPushSubscription.mockResolvedValue(undefined);
});

describe('isAllowedPushEndpoint (SEC-003)', () => {
  it('알려진 푸시 서비스(https)는 허용한다', async () => {
    const { isAllowedPushEndpoint } = await import('@/app/api/notifications/subscribe/route');
    expect(isAllowedPushEndpoint('https://web.push.apple.com/abc')).toBe(true);
    expect(isAllowedPushEndpoint('https://fcm.googleapis.com/fcm/send/xyz')).toBe(true);
    expect(isAllowedPushEndpoint('https://wns2-abc.notify.windows.com/w/abc')).toBe(true);
    expect(isAllowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(true);
    expect(isAllowedPushEndpoint('https://push.services.mozilla.com/wpush/v2/abc')).toBe(true);
  });

  it('http(비-https)는 알려진 호스트라도 거부한다', async () => {
    const { isAllowedPushEndpoint } = await import('@/app/api/notifications/subscribe/route');
    expect(isAllowedPushEndpoint('http://fcm.googleapis.com/fcm/send/xyz')).toBe(false);
  });

  it('알려지지 않은 호스트(임의 URL — SSRF 시도)는 거부한다', async () => {
    const { isAllowedPushEndpoint } = await import('@/app/api/notifications/subscribe/route');
    expect(isAllowedPushEndpoint('https://evil.com/collect')).toBe(false);
    expect(isAllowedPushEndpoint('https://internal-admin.local/api')).toBe(false);
    // 비슷한 접미사를 붙여 우회를 시도하는 경우도 거부한다
    expect(isAllowedPushEndpoint('https://fcm.googleapis.com.evil.com/x')).toBe(false);
  });

  it('URL로 파싱할 수 없는 값은 거부한다', async () => {
    const { isAllowedPushEndpoint } = await import('@/app/api/notifications/subscribe/route');
    expect(isAllowedPushEndpoint('not-a-url')).toBe(false);
  });
});

describe('POST /api/notifications/subscribe (SEC-003)', () => {
  it('알려진 푸시 서비스 endpoint는 구독을 저장한다', async () => {
    const { POST } = await import('@/app/api/notifications/subscribe/route');
    const req = makeRequest({ endpoint: 'https://fcm.googleapis.com/fcm/send/xyz', keys: VALID_KEYS });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockAddPushSubscription).toHaveBeenCalledTimes(1);
  });

  it('알려지지 않은 호스트면 400 VALIDATION_ERROR를 반환하고 저장하지 않는다', async () => {
    const { POST } = await import('@/app/api/notifications/subscribe/route');
    const req = makeRequest({ endpoint: 'https://evil.com/collect', keys: VALID_KEYS });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(mockAddPushSubscription).not.toHaveBeenCalled();
  });

  it('http(비-https) endpoint면 400 VALIDATION_ERROR를 반환한다', async () => {
    const { POST } = await import('@/app/api/notifications/subscribe/route');
    const req = makeRequest({ endpoint: 'http://fcm.googleapis.com/fcm/send/xyz', keys: VALID_KEYS });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockAddPushSubscription).not.toHaveBeenCalled();
  });
});
