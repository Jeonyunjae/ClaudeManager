/**
 * lib/push-notification.ts 단위 테스트 — 웹 푸시 구독 관리·발송.
 * DB(drizzle)는 key-expiry-checker.test.ts와 같은 패턴으로 모킹하고,
 * 실제 네트워크로 나가는 web-push의 setVapidDetails·sendNotification만 모킹한다.
 *
 * BUG-017: 실제 `web-push`는 CJS 패키지라 ESM 동적 import 결과가
 * `{ default: { setVapidDetails, sendNotification, ... }, WebPushError, ... }`
 * 형태로 온다(직접 확인: `import('web-push')`의 키는 `[WebPushError, default,
 * supportedContentEncodings]`뿐, 최상위에 setVapidDetails가 없다). 아래
 * 전역 모킹은 그 실제 형태(default 래핑만)를 반영한다 — 예전 코드처럼
 * `mod.default` 언랩 없이 `mod.setVapidDetails`를 직접 부르면 이 목에서는
 * undefined가 되어 테스트가 실패한다(Red). 언랩 로직이 있어야 통과한다(Green).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockLimit = vi.fn();
const mockWhere = vi.fn(() => ({ limit: mockLimit }));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

const mockUpdateWhere = vi.fn(() => Promise.resolve());
const mockSet = vi.fn<(values: { value: string; updatedAt: string }) => { where: typeof mockUpdateWhere }>(
  (_values) => ({ where: mockUpdateWhere })
);
const mockUpdate = vi.fn(() => ({ set: mockSet }));

const mockInsertValues = vi.fn(() => Promise.resolve());
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

vi.mock('@/lib/db', () => ({
  default: {
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
  },
}));

const mockSetVapidDetails = vi.fn();
const mockSendNotification = vi.fn();

// 실제 web-push(CJS)와 같은 형태 — default 아래에만 API가 있다 (BUG-017)
vi.mock('web-push', () => ({
  WebPushError: class WebPushError extends Error {},
  supportedContentEncodings: ['aes128gcm'],
  default: {
    setVapidDetails: mockSetVapidDetails,
    sendNotification: mockSendNotification,
  },
}));

const ORIGINAL_ENV = { ...process.env };

function setVapidEnv(): void {
  process.env.VAPID_PUBLIC_KEY = 'pub';
  process.env.VAPID_PRIVATE_KEY = 'priv';
  process.env.VAPID_SUBJECT = 'mailto:a@b.com';
}

function clearVapidEnv(): void {
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_SUBJECT;
}

describe('push-notification.ts', () => {
  beforeEach(() => {
    vi.resetModules();
    mockLimit.mockReset();
    mockWhere.mockClear();
    mockFrom.mockClear();
    mockSelect.mockClear();
    mockUpdateWhere.mockReset();
    mockSet.mockClear();
    mockUpdate.mockClear();
    mockInsertValues.mockReset();
    mockInsert.mockClear();
    mockSetVapidDetails.mockReset();
    mockSendNotification.mockReset();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe('isPushEnabled / getVapidPublicKey', () => {
    it('VAPID 키가 모두 있어야 true', async () => {
      setVapidEnv();
      const { isPushEnabled } = await import('@/lib/push-notification');
      expect(isPushEnabled()).toBe(true);
    });

    it('하나라도 없으면 false', async () => {
      clearVapidEnv();
      process.env.VAPID_PUBLIC_KEY = 'pub';
      const { isPushEnabled } = await import('@/lib/push-notification');
      expect(isPushEnabled()).toBe(false);
    });

    it('getVapidPublicKey는 공개키 문자열 또는 null을 반환한다', async () => {
      clearVapidEnv();
      const mod1 = await import('@/lib/push-notification');
      expect(mod1.getVapidPublicKey()).toBeNull();

      vi.resetModules();
      process.env.VAPID_PUBLIC_KEY = 'pub-key';
      const mod2 = await import('@/lib/push-notification');
      expect(mod2.getVapidPublicKey()).toBe('pub-key');
    });
  });

  describe('addPushSubscription / removePushSubscription', () => {
    it('기존 구독이 없으면(신규) insert로 저장한다', async () => {
      mockLimit.mockResolvedValue([]);
      const { addPushSubscription } = await import('@/lib/push-notification');

      await addPushSubscription({
        endpoint: 'https://push.example/a',
        keys: { p256dh: 'p', auth: 'a' },
        createdAt: '2026-01-01T00:00:00.000Z',
      });

      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'push_subscriptions' })
      );
    });

    it('기존 구독이 있으면 update로 갱신하고, 같은 endpoint는 중복 없이 교체한다', async () => {
      const existingRow = {
        value: JSON.stringify([
          { endpoint: 'https://push.example/a', keys: { p256dh: 'old', auth: 'old' }, createdAt: 'x' },
        ]),
      };
      mockLimit.mockResolvedValue([existingRow]);
      const { addPushSubscription } = await import('@/lib/push-notification');

      await addPushSubscription({
        endpoint: 'https://push.example/a',
        keys: { p256dh: 'new', auth: 'new' },
        createdAt: '2026-01-01T00:00:00.000Z',
      });

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      const savedValue = mockSet.mock.calls[0][0].value as string;
      const saved = JSON.parse(savedValue);
      expect(saved).toHaveLength(1);
      expect(saved[0].keys.p256dh).toBe('new');
    });

    it('DB 조회 실패 시 구독 목록을 빈 배열로 취급한다(예외를 던지지 않음)', async () => {
      // getSubscriptions()의 select는 실패(빈 배열로 흡수)하지만, saveSubscriptions()의
      // 존재 여부 확인 select는 별개 호출이라 정상 응답한다고 가정한다.
      mockLimit.mockRejectedValueOnce(new Error('db down')).mockResolvedValueOnce([]);
      const { addPushSubscription } = await import('@/lib/push-notification');

      await expect(
        addPushSubscription({
          endpoint: 'https://push.example/a',
          keys: { p256dh: 'p', auth: 'a' },
          createdAt: '2026-01-01T00:00:00.000Z',
        })
      ).resolves.toBeUndefined();
      expect(mockInsert).toHaveBeenCalledTimes(1);
    });

    it('removePushSubscription은 endpoint가 일치하는 구독만 제거한다', async () => {
      const existingRow = {
        value: JSON.stringify([
          { endpoint: 'https://push.example/a', keys: { p256dh: 'p', auth: 'a' }, createdAt: 'x' },
          { endpoint: 'https://push.example/b', keys: { p256dh: 'p', auth: 'a' }, createdAt: 'x' },
        ]),
      };
      mockLimit.mockResolvedValue([existingRow]);
      const { removePushSubscription } = await import('@/lib/push-notification');

      await removePushSubscription('https://push.example/a');

      const savedValue = mockSet.mock.calls[0][0].value as string;
      const saved = JSON.parse(savedValue);
      expect(saved).toHaveLength(1);
      expect(saved[0].endpoint).toBe('https://push.example/b');
    });
  });

  describe('sendPushNotification', () => {
    it('VAPID가 비활성이면 구독 조회조차 하지 않고 아무 것도 하지 않는다', async () => {
      clearVapidEnv();
      const { sendPushNotification } = await import('@/lib/push-notification');

      await sendPushNotification('제목', '본문');

      expect(mockSelect).not.toHaveBeenCalled();
      expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it('구독자가 없으면 발송을 시도하지 않는다', async () => {
      setVapidEnv();
      mockLimit.mockResolvedValue([]);
      const { sendPushNotification } = await import('@/lib/push-notification');

      await sendPushNotification('제목', '본문');

      expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it('활성 구독 전원에게 발송하고 VAPID를 설정한다', async () => {
      setVapidEnv();
      mockLimit.mockResolvedValue([
        {
          value: JSON.stringify([
            { endpoint: 'https://push.example/a', keys: { p256dh: 'p', auth: 'a' }, createdAt: 'x' },
          ]),
        },
      ]);
      mockSendNotification.mockResolvedValue(undefined);
      const { sendPushNotification } = await import('@/lib/push-notification');

      await sendPushNotification('제목', '본문', '/m/chat', 'tag-1');

      expect(mockSetVapidDetails).toHaveBeenCalledWith('mailto:a@b.com', 'pub', 'priv');
      expect(mockSendNotification).toHaveBeenCalledTimes(1);
      const [sub, payload] = mockSendNotification.mock.calls[0];
      expect(sub).toEqual({ endpoint: 'https://push.example/a', keys: { p256dh: 'p', auth: 'a' } });
      expect(JSON.parse(payload)).toEqual({ title: '제목', body: '본문', url: '/m/chat', tag: 'tag-1' });
    });

    it('만료(410) 구독은 정리하고, 그 외 실패는 유지한다', async () => {
      setVapidEnv();
      mockLimit.mockResolvedValue([
        {
          value: JSON.stringify([
            { endpoint: 'https://push.example/expired', keys: { p256dh: 'p', auth: 'a' }, createdAt: 'x' },
            { endpoint: 'https://push.example/other-fail', keys: { p256dh: 'p', auth: 'a' }, createdAt: 'x' },
            { endpoint: 'https://push.example/ok', keys: { p256dh: 'p', auth: 'a' }, createdAt: 'x' },
          ]),
        },
      ]);
      mockSendNotification.mockImplementation(async (sub: { endpoint: string }) => {
        if (sub.endpoint.endsWith('/expired')) {
          const err = new Error('gone') as Error & { statusCode: number };
          err.statusCode = 410;
          throw err;
        }
        if (sub.endpoint.endsWith('/other-fail')) {
          const err = new Error('server error') as Error & { statusCode: number };
          err.statusCode = 500;
          throw err;
        }
        return undefined;
      });

      const { sendPushNotification } = await import('@/lib/push-notification');
      await sendPushNotification('제목', '본문');

      expect(mockSendNotification).toHaveBeenCalledTimes(3);
      // 만료된 구독만 제거되어 저장된다
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      const savedValue = mockSet.mock.calls[0][0].value as string;
      const saved = JSON.parse(savedValue) as Array<{ endpoint: string }>;
      expect(saved.map((s) => s.endpoint)).toEqual([
        'https://push.example/other-fail',
        'https://push.example/ok',
      ]);
    });

    it('url이 없으면 기본값 "/"을 사용한다', async () => {
      setVapidEnv();
      mockLimit.mockResolvedValue([
        {
          value: JSON.stringify([
            { endpoint: 'https://push.example/a', keys: { p256dh: 'p', auth: 'a' }, createdAt: 'x' },
          ]),
        },
      ]);
      mockSendNotification.mockResolvedValue(undefined);
      const { sendPushNotification } = await import('@/lib/push-notification');

      await sendPushNotification('제목', '본문');

      const [, payload] = mockSendNotification.mock.calls[0];
      expect(JSON.parse(payload).url).toBe('/');
    });

    it('BUG-017: default로 래핑된 모듈(실제 web-push 형태)이면 default 아래 API가 호출된다', async () => {
      // 파일 상단 전역 vi.mock('web-push', ...)이 이미 default 전용 형태이므로,
      // 위의 "활성 구독 전원에게 발송" 테스트가 이 경로를 검증한다. 여기서는
      // 명시적으로 다시 한 번 default 언랩 호출을 확인해 회귀를 막는다.
      setVapidEnv();
      mockLimit.mockResolvedValue([
        {
          value: JSON.stringify([
            { endpoint: 'https://push.example/wrapped', keys: { p256dh: 'p', auth: 'a' }, createdAt: 'x' },
          ]),
        },
      ]);
      mockSendNotification.mockResolvedValue(undefined);
      const { sendPushNotification } = await import('@/lib/push-notification');

      await sendPushNotification('제목', '본문');

      expect(mockSetVapidDetails).toHaveBeenCalledTimes(1);
      expect(mockSendNotification).toHaveBeenCalledTimes(1);
    });

    it('BUG-017: 최상위(비래핑) 형태의 web-push 모듈도 그대로 동작한다', async () => {
      setVapidEnv();
      mockLimit.mockResolvedValue([
        {
          value: JSON.stringify([
            { endpoint: 'https://push.example/unwrapped', keys: { p256dh: 'p', auth: 'a' }, createdAt: 'x' },
          ]),
        },
      ]);

      const flatSetVapidDetails = vi.fn();
      const flatSendNotification = vi.fn().mockResolvedValue(undefined);
      // vitest의 동적 import 모킹은 CJS 인터롭 상 "default" 키 존재를 요구하므로
      // 명시적으로 undefined를 둬 "default가 없는(비래핑) 모듈"을 흉내 낸다 —
      // unwrapWebPush()의 `mod.default ?? mod` 중 `?? mod` 분기를 태운다.
      vi.doMock('web-push', () => ({
        default: undefined,
        setVapidDetails: flatSetVapidDetails,
        sendNotification: flatSendNotification,
      }));
      vi.resetModules();

      try {
        const { sendPushNotification } = await import('@/lib/push-notification');
        await sendPushNotification('제목', '본문');

        expect(flatSetVapidDetails).toHaveBeenCalledWith('mailto:a@b.com', 'pub', 'priv');
        expect(flatSendNotification).toHaveBeenCalledTimes(1);
      } finally {
        vi.doUnmock('web-push');
      }
    });

    it('BUG-017: setVapidDetails/sendNotification이 없는 모듈이면 예외 없이 건너뛴다(모듈 로드 실패로 취급)', async () => {
      setVapidEnv();
      mockLimit.mockResolvedValue([
        {
          value: JSON.stringify([
            { endpoint: 'https://push.example/broken', keys: { p256dh: 'p', auth: 'a' }, createdAt: 'x' },
          ]),
        },
      ]);

      vi.doMock('web-push', () => ({ default: {} }));
      vi.resetModules();

      try {
        const { sendPushNotification } = await import('@/lib/push-notification');
        await expect(sendPushNotification('제목', '본문')).resolves.toBeUndefined();
      } finally {
        vi.doUnmock('web-push');
      }
    });
  });
});
