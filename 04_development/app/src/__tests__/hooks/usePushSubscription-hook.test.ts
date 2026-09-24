/**
 * @vitest-environment jsdom
 *
 * hooks/usePushSubscription.ts의 usePushSubscription() 훅 자체 단위 테스트 — FR-010, DES-007 §2.
 * 순수 함수(resolvePushState·runSubscribeFlow·runUnsubscribeFlow 등)는
 * usePushSubscription.test.ts(node 환경)에서 이미 검증했다. 이 파일은 훅이 그 순수 함수들에
 * 실제(모킹된) 브라우저 API를 연결하는 부분(detect·subscribe·unsubscribe)을 검증한다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDel = vi.fn();

vi.mock('@/lib/api', () => ({
  default: {
    get: mockGet,
    post: mockPost,
    del: mockDel,
  },
}));

const mockIsIOS = vi.fn(() => false);
const mockIsStandalone = vi.fn(() => false);

vi.mock('@/lib/platform', () => ({
  isIOS: () => mockIsIOS(),
  isStandalone: () => mockIsStandalone(),
}));

function stubPushManager(): void {
  (window as unknown as { PushManager: unknown }).PushManager = function PushManager() {};
}

function unstubPushManager(): void {
  delete (window as unknown as { PushManager?: unknown }).PushManager;
}

function stubServiceWorker(sw: Record<string, unknown>): void {
  Object.defineProperty(navigator, 'serviceWorker', {
    value: sw,
    configurable: true,
  });
}

function unstubServiceWorker(): void {
  // @ts-expect-error jsdom navigator는 기본적으로 serviceWorker가 없다
  delete navigator.serviceWorker;
}

describe('usePushSubscription', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockDel.mockReset();
    mockIsIOS.mockReturnValue(false);
    mockIsStandalone.mockReturnValue(false);
    unstubPushManager();
    unstubServiceWorker();
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    unstubPushManager();
    unstubServiceWorker();
  });

  it('PushManager·ServiceWorker가 없으면 unsupported로 정리된다(브라우저 지원 판정이 서버 조회보다 우선)', async () => {
    mockGet.mockResolvedValue({ data: { enabled: true, vapidPublicKey: 'pub' } });
    const { usePushSubscription } = await import('@/hooks/usePushSubscription');
    const { result } = renderHook(() => usePushSubscription());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.state).toBe('unsupported');
  });

  it('iOS이고 standalone이 아니면 needs-install이다', async () => {
    stubPushManager();
    stubServiceWorker({ getRegistration: vi.fn(async () => null) });
    mockIsIOS.mockReturnValue(true);
    mockIsStandalone.mockReturnValue(false);
    mockGet.mockResolvedValue({ data: { enabled: true, vapidPublicKey: 'x' } });

    const { usePushSubscription } = await import('@/hooks/usePushSubscription');
    const { result } = renderHook(() => usePushSubscription());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.state).toBe('needs-install');
  });

  it('서버 VAPID가 비활성(enabled:false)이면 server-disabled다', async () => {
    stubPushManager();
    stubServiceWorker({ getRegistration: vi.fn(async () => null) });
    mockGet.mockResolvedValue({ data: { enabled: false, vapidPublicKey: null } });

    const { usePushSubscription } = await import('@/hooks/usePushSubscription');
    const { result } = renderHook(() => usePushSubscription());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.state).toBe('server-disabled');
  });

  it('서버 조회가 실패해도(예외) server-disabled로 흡수한다', async () => {
    stubPushManager();
    stubServiceWorker({ getRegistration: vi.fn(async () => null) });
    mockGet.mockRejectedValue(new Error('network'));

    const { usePushSubscription } = await import('@/hooks/usePushSubscription');
    const { result } = renderHook(() => usePushSubscription());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.state).toBe('server-disabled');
  });

  it('기존 구독이 있으면 subscribed이고, 재진입 시 서버에 1회 재구독 POST한다', async () => {
    stubPushManager();
    const subscriptionJSON = { endpoint: 'https://push.example/ep', keys: { p256dh: 'p', auth: 'a' } };
    const getSubscription = vi.fn(async () => ({ toJSON: () => subscriptionJSON }));
    stubServiceWorker({
      getRegistration: vi.fn(async () => ({ pushManager: { getSubscription } })),
    });
    mockGet.mockResolvedValue({ data: { enabled: true, vapidPublicKey: 'pub' } });
    mockPost.mockResolvedValue({ data: {} });

    const { usePushSubscription } = await import('@/hooks/usePushSubscription');
    const { result } = renderHook(() => usePushSubscription());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.state).toBe('subscribed');
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/notifications/subscribe', subscriptionJSON));
  });

  it('권한이 denied면 denied다', async () => {
    stubPushManager();
    stubServiceWorker({ getRegistration: vi.fn(async () => null) });
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission: vi.fn() });
    mockGet.mockResolvedValue({ data: { enabled: true, vapidPublicKey: 'pub' } });

    const { usePushSubscription } = await import('@/hooks/usePushSubscription');
    const { result } = renderHook(() => usePushSubscription());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.state).toBe('denied');
  });

  it('subscribe()는 권한 요청→SW 등록→VAPID 조회→구독→저장 순으로 진행해 subscribed가 된다', async () => {
    stubPushManager();
    stubServiceWorker({
      getRegistration: vi.fn(async () => null),
      register: vi.fn(async () => {}),
      ready: Promise.resolve({
        pushManager: {
          subscribe: vi.fn(async () => ({
            toJSON: () => ({ endpoint: 'https://push.example/new', keys: { p256dh: 'p', auth: 'a' } }),
          })),
        },
      }),
    });
    const requestPermission = vi.fn(async () => 'granted' as NotificationPermission);
    vi.stubGlobal('Notification', { permission: 'default', requestPermission });
    mockGet.mockResolvedValue({ data: { enabled: true, vapidPublicKey: 'AAA-_w' } });
    mockPost.mockResolvedValue({ data: {} });

    const { usePushSubscription } = await import('@/hooks/usePushSubscription');
    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.state).toBe('default');

    await act(async () => {
      await result.current.subscribe();
    });

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe('subscribed');
    expect(result.current.error).toBeNull();
  });

  it('unsubscribe()는 브라우저 구독 해제 후 서버 삭제를 호출해 default가 된다', async () => {
    stubPushManager();
    const unsubscribeMock = vi.fn(async () => true);
    const getSubscription = vi.fn(async () => ({
      endpoint: 'https://push.example/ep',
      unsubscribe: unsubscribeMock,
      toJSON: () => ({ endpoint: 'https://push.example/ep', keys: { p256dh: 'p', auth: 'a' } }),
    }));
    stubServiceWorker({
      getRegistration: vi.fn(async () => ({ pushManager: { getSubscription } })),
    });
    mockGet.mockResolvedValue({ data: { enabled: true, vapidPublicKey: 'pub' } });
    mockPost.mockResolvedValue({ data: {} });
    mockDel.mockResolvedValue({ data: {} });

    const { usePushSubscription } = await import('@/hooks/usePushSubscription');
    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.state).toBe('subscribed');

    await act(async () => {
      await result.current.unsubscribe();
    });

    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    expect(mockDel).toHaveBeenCalledWith('/api/notifications/subscribe', { endpoint: 'https://push.example/ep' });
    expect(result.current.state).toBe('default');
  });
});
