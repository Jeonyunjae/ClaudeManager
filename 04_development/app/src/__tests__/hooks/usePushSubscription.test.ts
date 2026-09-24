/**
 * usePushSubscription 순수 함수 단위 테스트 — FR-010, DES-007 §2
 * (환경이 node이므로 훅 자체가 아니라 resolvePushState·runSubscribeFlow·runUnsubscribeFlow만 검증한다)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDel = vi.fn();

vi.mock('@/lib/api', () => ({
  default: {
    del: mockDel,
  },
}));

const {
  resolvePushState,
  runSubscribeFlow,
  runUnsubscribeFlow,
  urlBase64ToUint8Array,
  deleteSubscriptionByEndpoint,
} = await import('@/hooks/usePushSubscription');
type SubscribeDeps = Parameters<typeof runSubscribeFlow>[0];
type UnsubscribeDeps = Parameters<typeof runUnsubscribeFlow>[0];

const BASE = {
  hasPushManager: true,
  hasSW: true,
  isIOS: false,
  isStandalone: false,
  serverEnabled: true,
  permission: 'default' as NotificationPermission,
  hasSubscription: false,
};

describe('resolvePushState', () => {
  it('PushManager 또는 ServiceWorker가 없으면 unsupported', () => {
    expect(resolvePushState({ ...BASE, hasPushManager: false })).toBe('unsupported');
    expect(resolvePushState({ ...BASE, hasSW: false })).toBe('unsupported');
  });

  it('iOS이고 standalone이 아니면 needs-install (unsupported보다 우선하지 않는다)', () => {
    expect(resolvePushState({ ...BASE, isIOS: true, isStandalone: false })).toBe('needs-install');
  });

  it('iOS이고 standalone이면 needs-install이 아니다', () => {
    expect(resolvePushState({ ...BASE, isIOS: true, isStandalone: true })).not.toBe('needs-install');
  });

  it('서버 VAPID 미설정(enabled=false)이면 server-disabled', () => {
    expect(resolvePushState({ ...BASE, serverEnabled: false })).toBe('server-disabled');
  });

  it('권한이 denied면 denied', () => {
    expect(resolvePushState({ ...BASE, permission: 'denied' })).toBe('denied');
  });

  it('기존 구독이 있으면 subscribed', () => {
    expect(resolvePushState({ ...BASE, hasSubscription: true })).toBe('subscribed');
  });

  it('그 외에는 default', () => {
    expect(resolvePushState({ ...BASE })).toBe('default');
  });

  it('분기 우선순위: unsupported가 needs-install·server-disabled·denied보다 앞선다', () => {
    expect(
      resolvePushState({
        ...BASE,
        hasPushManager: false,
        isIOS: true,
        isStandalone: false,
        serverEnabled: false,
        permission: 'denied',
        hasSubscription: true,
      })
    ).toBe('unsupported');
  });
});

describe('urlBase64ToUint8Array', () => {
  it('base64url 문자열을 Uint8Array로 변환한다', () => {
    // 'AAA-_w' 는 패딩·-, _ 치환 경로를 모두 지나가도록 고른 값
    const result = urlBase64ToUint8Array('AAA-_w');
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });
});

function makeSubscribeDeps(overrides: Partial<SubscribeDeps> = {}): {
  deps: SubscribeDeps;
  calls: string[];
} {
  const calls: string[] = [];
  const subscribeMock = vi.fn(async () => ({
    toJSON: () => ({ endpoint: 'https://push.example/ep', keys: { p256dh: 'p', auth: 'a' } }),
  }));

  const deps: SubscribeDeps = {
    requestPermission: vi.fn(async () => {
      calls.push('requestPermission');
      return 'granted' as NotificationPermission;
    }),
    registerAndGetReady: vi.fn(async () => {
      calls.push('registerAndGetReady');
      return { pushManager: { subscribe: subscribeMock } };
    }),
    fetchVapidKey: vi.fn(async () => {
      calls.push('fetchVapidKey');
      return { enabled: true, vapidPublicKey: 'AAA-_w' };
    }),
    saveSubscription: vi.fn(async () => {
      calls.push('saveSubscription');
    }),
    ...overrides,
  };

  return { deps, calls };
}

describe('runSubscribeFlow', () => {
  it('성공 경로: requestPermission이 가장 먼저 호출되고 subscribed로 끝난다', async () => {
    const { deps, calls } = makeSubscribeDeps();

    const result = await runSubscribeFlow(deps);

    expect(calls[0]).toBe('requestPermission');
    expect(calls).toEqual([
      'requestPermission',
      'registerAndGetReady',
      'fetchVapidKey',
      'saveSubscription',
    ]);
    expect(result).toEqual({ state: 'subscribed' });
  });

  it('권한 거부 시 denied를 반환하고 SW 등록·구독은 시도하지 않는다', async () => {
    const { deps, calls } = makeSubscribeDeps({
      requestPermission: vi.fn(async () => {
        calls.push('requestPermission');
        return 'denied' as NotificationPermission;
      }),
    });

    const result = await runSubscribeFlow(deps);

    expect(result).toEqual({ state: 'denied' });
    expect(calls).toEqual(['requestPermission']);
  });

  it('VAPID 공개키가 없으면(server-disabled) 구독을 시도하지 않는다', async () => {
    const { deps } = makeSubscribeDeps({
      fetchVapidKey: vi.fn(async () => ({ enabled: false, vapidPublicKey: null })),
    });

    const result = await runSubscribeFlow(deps);

    expect(result).toEqual({ state: 'server-disabled' });
  });

  it('서버 저장(POST) 실패 시 default를 유지하고 에러 문구를 반환한다', async () => {
    const { deps } = makeSubscribeDeps({
      saveSubscription: vi.fn(async () => {
        throw new Error('network');
      }),
    });

    const result = await runSubscribeFlow(deps);

    expect(result.state).toBe('default');
    expect(result.error).toBe('푸시 설정 실패');
  });

  it('pushManager.subscribe 자체 실패도 default로 흡수한다', async () => {
    const { deps } = makeSubscribeDeps({
      registerAndGetReady: vi.fn(async () => ({
        pushManager: {
          subscribe: vi.fn(async () => {
            throw new Error('subscribe failed');
          }),
        },
      })),
    });

    const result = await runSubscribeFlow(deps);

    expect(result.state).toBe('default');
  });
});

describe('runUnsubscribeFlow', () => {
  it('구독이 있으면 unsubscribe 후 서버에서 삭제하고 default를 반환한다', async () => {
    const unsubscribeMock = vi.fn(async () => true);
    const deleteMock = vi.fn(async () => {});
    const deps: UnsubscribeDeps = {
      getSubscription: vi.fn(async () => ({ endpoint: 'https://push.example/ep', unsubscribe: unsubscribeMock })),
      deleteSubscription: deleteMock,
    };

    const result = await runUnsubscribeFlow(deps);

    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledWith('https://push.example/ep');
    expect(result).toEqual({ state: 'default' });
  });

  it('구독이 이미 없으면 서버 삭제를 호출하지 않고 default를 반환한다', async () => {
    const deleteMock = vi.fn(async () => {});
    const deps: UnsubscribeDeps = {
      getSubscription: vi.fn(async () => null),
      deleteSubscription: deleteMock,
    };

    const result = await runUnsubscribeFlow(deps);

    expect(deleteMock).not.toHaveBeenCalled();
    expect(result).toEqual({ state: 'default' });
  });

  it('해제 실패 시 subscribed를 유지하고 에러 문구를 반환한다', async () => {
    const deps: UnsubscribeDeps = {
      getSubscription: vi.fn(async () => ({
        endpoint: 'https://push.example/ep',
        unsubscribe: vi.fn(async () => {
          throw new Error('fail');
        }),
      })),
      deleteSubscription: vi.fn(async () => {}),
    };

    const result = await runUnsubscribeFlow(deps);

    expect(result.state).toBe('subscribed');
    expect(result.error).toBe('해제 실패');
  });
});

// DF-012: apiClient.del(path)이 바디를 받지 못해 fetch로 우회했던 부분을 제거하고
// apiClient.del(path, body)로 되돌린 뒤에도 같은 엔드포인트·바디로 호출하는지 검증한다.
describe('deleteSubscriptionByEndpoint', () => {
  beforeEach(() => {
    mockDel.mockReset();
    mockDel.mockResolvedValue({ data: {} });
  });

  it('apiClient.del을 /api/notifications/subscribe에 { endpoint } 바디로 호출한다', async () => {
    await deleteSubscriptionByEndpoint('https://push.example/ep');

    expect(mockDel).toHaveBeenCalledWith('/api/notifications/subscribe', {
      endpoint: 'https://push.example/ep',
    });
  });

  it('apiClient.del이 실패하면 예외가 그대로 전파된다 (runUnsubscribeFlow가 흡수)', async () => {
    mockDel.mockRejectedValue(new Error('unsubscribe failed'));

    await expect(deleteSubscriptionByEndpoint('https://push.example/ep')).rejects.toThrow(
      'unsubscribe failed'
    );
  });
});
