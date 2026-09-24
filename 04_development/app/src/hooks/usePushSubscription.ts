'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import apiClient from '@/lib/api';
import { isIOS, isStandalone } from '@/lib/platform';

/** PushState (DES-009 §상태 코드, DES-007 §2) */
export type PushState =
  | 'unsupported'
  | 'needs-install'
  | 'server-disabled'
  | 'default'
  | 'subscribed'
  | 'denied';

const SUBSCRIBE_PATH = '/api/notifications/subscribe';
const SW_URL = '/sw.js';

type VapidKeyResponse = { enabled: boolean; vapidPublicKey: string | null };

export type SubscriptionJSON = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

type ResolvePushStateParams = {
  hasPushManager: boolean;
  hasSW: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  serverEnabled: boolean;
  permission: NotificationPermission;
  hasSubscription: boolean;
};

/**
 * PushState 판정 (순수 함수, DES-007 §2 `Check` 분기를 그대로 옮긴 것).
 *
 * 분기 순서가 결과를 결정한다 — 위에서부터 먼저 맞는 조건이 이긴다.
 */
export function resolvePushState(params: ResolvePushStateParams): PushState {
  const { hasPushManager, hasSW, isIOS: ios, isStandalone: standalone, serverEnabled, permission, hasSubscription } =
    params;

  if (!hasPushManager || !hasSW) return 'unsupported';
  if (ios && !standalone) return 'needs-install';
  if (!serverEnabled) return 'server-disabled';
  if (permission === 'denied') return 'denied';
  if (hasSubscription) return 'subscribed';
  return 'default';
}

/** VAPID 공개키(base64url) → `PushManager.subscribe`의 `applicationServerKey`(Uint8Array) 형식 변환. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type SubscribeFlowResult = { state: PushState; error?: string };

/** `registerAndGetReady`가 반환하는 최소 형태 — 실제 `ServiceWorkerRegistration`은 이 형태의 상위집합이다. */
export type PushRegistrationLike = {
  pushManager: {
    subscribe: (options: {
      userVisibleOnly: boolean;
      applicationServerKey: BufferSource;
    }) => Promise<{ toJSON: () => SubscriptionJSON }>;
  };
};

export type SubscribeDeps = {
  /** 반드시 가장 먼저 호출한다 — iOS Safari는 비동기 작업을 먼저 await하면 이후의
   *  requestPermission 호출을 "사용자 제스처 밖"으로 취급해 자동으로 거부할 수 있다. */
  requestPermission: () => Promise<NotificationPermission>;
  registerAndGetReady: () => Promise<PushRegistrationLike>;
  fetchVapidKey: () => Promise<VapidKeyResponse>;
  saveSubscription: (sub: SubscriptionJSON) => Promise<void>;
};

/**
 * [푸시 켜기] 흐름 (EVT-M03-3, DES-007 §2 `Default -> 푸시 켜기 -> Subscribed`).
 *
 * **설계와 다른 점 (결함 등재 DEF-B5-01)**: DES-007 §2 표는 순서를
 * `register('/sw.js') → requestPermission → subscribe → POST`로 적었지만,
 * iOS 16.4+ Safari는 사용자 탭 핸들러 안에서 "가장 먼저" 동기적으로 시작된 호출만
 * 사용자 제스처로 인정한다. SW 등록(비동기)을 먼저 await한 뒤 requestPermission을 부르면
 * 제스처 체인이 끊겨 브라우저가 조용히 거부할 수 있다. 그래서 이 구현은
 * `requestPermission`을 가장 먼저 호출하도록 순서를 바꿨다 (원본 지시사항의 iOS 사실 절과 일치).
 */
export async function runSubscribeFlow(deps: SubscribeDeps): Promise<SubscribeFlowResult> {
  const permission = await deps.requestPermission();
  if (permission === 'denied') {
    return { state: 'denied' };
  }
  if (permission !== 'granted') {
    // BUG-009: 권한 창을 닫아 'default'가 돌아온 경우(선택하지 않음)는 거부가 아니다 —
    // denied로 처리하면 [푸시 켜기] 버튼이 다시 나타나지 않는다. default를 유지해 사용자가
    // 다시 시도할 수 있게 한다.
    return { state: 'default' };
  }

  try {
    const registration = await deps.registerAndGetReady();
    const { vapidPublicKey } = await deps.fetchVapidKey();
    if (!vapidPublicKey) {
      return { state: 'server-disabled' };
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    await deps.saveSubscription(subscription.toJSON());
    return { state: 'subscribed' };
  } catch {
    // 구독 저장 실패 — DES-007 §2 "Default -> Default: 구독 저장 실패(토스트)"
    return { state: 'default', error: '푸시 설정 실패' };
  }
}

export type UnsubscribeDeps = {
  getSubscription: () => Promise<{ endpoint: string; unsubscribe: () => Promise<boolean> } | null>;
  deleteSubscription: (endpoint: string) => Promise<void>;
};

/** [푸시 끄기] 흐름 (EVT-M03-4, DES-007 §2 `Subscribed -> 푸시 끄기 -> Default`). */
export async function runUnsubscribeFlow(deps: UnsubscribeDeps): Promise<SubscribeFlowResult> {
  try {
    const subscription = await deps.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      await deps.deleteSubscription(subscription.endpoint);
    }
    return { state: 'default' };
  } catch {
    return { state: 'subscribed', error: '해제 실패' };
  }
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    return registration ?? null;
  } catch {
    return null;
  }
}

/**
 * 구독 해제 DELETE 호출.
 *
 * DES-002 §`/api/notifications/subscribe`는 `DELETE { endpoint }` 바디를 요구한다.
 * DF-012 해소: `apiClient.del(path, body?)`가 바디를 받게 확장되어(`src/lib/api.ts`), 더 이상
 * `fetch`로 우회하지 않고 다른 화면과 같은 401 처리·인증 헤더 경로를 그대로 재사용한다.
 */
export async function deleteSubscriptionByEndpoint(endpoint: string): Promise<void> {
  await apiClient.del(SUBSCRIBE_PATH, { endpoint });
}

export type UsePushSubscriptionResult = {
  state: PushState;
  loading: boolean;
  error: string | null;
  /** EVT-M03-3 [푸시 켜기] — 반드시 탭 핸들러 안에서 직접 호출한다 (await 앞에 다른 await를 두지 않는다). */
  subscribe: () => Promise<void>;
  /** EVT-M03-4 [푸시 끄기] */
  unsubscribe: () => Promise<void>;
};

/**
 * 푸시 구독 상태 훅 (SCR-M03, DES-001 `usePushSubscription`) — FR-010.
 *
 * 판정 로직(`resolvePushState`)과 구독/해제 흐름(`runSubscribeFlow`·`runUnsubscribeFlow`)을
 * 순수 함수로 분리해 두었다. 이 훅은 그 순수 함수들에 실제 브라우저 API를 연결하는 역할만 한다.
 */
export function usePushSubscription(): UsePushSubscriptionResult {
  const [state, setState] = useState<PushState>('default');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reconciledRef = useRef(false);

  const detect = useCallback(async () => {
    setLoading(true);

    const hasPushManager = typeof window !== 'undefined' && 'PushManager' in window;
    const hasSW = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
    const ios = isIOS();
    const standalone = isStandalone();
    const permission: NotificationPermission =
      typeof Notification !== 'undefined' ? Notification.permission : 'default';

    let serverEnabled = false;
    try {
      const res = await apiClient.get<VapidKeyResponse>(SUBSCRIBE_PATH);
      serverEnabled = res.data.enabled;
    } catch {
      serverEnabled = false;
    }

    let hasSubscription = false;
    if (hasPushManager && hasSW) {
      const registration = await getRegistration();
      if (registration) {
        try {
          const subscription = await registration.pushManager.getSubscription();
          hasSubscription = !!subscription;

          // DES-007 §2 "재진입 확인: 브라우저 구독은 있는데 서버 목록에 없음 -> 자동 재구독 1회".
          // 서버에 구독 목록 조회 API가 없으므로(POST가 endpoint 기준 upsert), 재진입 시 1회
          // POST를 다시 보내 서버-브라우저 상태를 idempotent하게 맞춘다.
          if (subscription && !reconciledRef.current) {
            reconciledRef.current = true;
            apiClient.post(SUBSCRIBE_PATH, subscription.toJSON()).catch(() => {});
          }
        } catch {
          hasSubscription = false;
        }
      }
    }

    setState(
      resolvePushState({
        hasPushManager,
        hasSW,
        isIOS: ios,
        isStandalone: standalone,
        serverEnabled,
        permission,
        hasSubscription,
      })
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    // 브라우저 전역(PushManager·navigator.serviceWorker·Notification)은 SSR 렌더에는 없어
    // 마운트 후에만 판정할 수 있다 — 기존 useMediaQuery·useTheme와 같은 패턴.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    detect();
  }, [detect]);

  const subscribe = useCallback(async () => {
    setError(null);
    const result = await runSubscribeFlow({
      requestPermission: () => Notification.requestPermission(),
      registerAndGetReady: async () => {
        await navigator.serviceWorker.register(SW_URL);
        const registration = await navigator.serviceWorker.ready;
        // lib.dom의 `PushSubscription.toJSON().endpoint`는 `string | undefined`로 선언되어 있지만
        // 실제 구독 성공 후에는 항상 채워진다 — 좁혀서 재사용하기 위한 의도적 캐스팅.
        return registration as unknown as PushRegistrationLike;
      },
      fetchVapidKey: async () => {
        const res = await apiClient.get<VapidKeyResponse>(SUBSCRIBE_PATH);
        return res.data;
      },
      saveSubscription: async (sub) => {
        await apiClient.post(SUBSCRIBE_PATH, sub);
      },
    });
    setState(result.state);
    setError(result.error ?? null);
  }, []);

  const unsubscribe = useCallback(async () => {
    setError(null);
    const result = await runUnsubscribeFlow({
      getSubscription: async () => {
        const registration = await getRegistration();
        if (!registration) return null;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) return null;
        return { endpoint: subscription.endpoint, unsubscribe: () => subscription.unsubscribe() };
      },
      deleteSubscription: deleteSubscriptionByEndpoint,
    });
    setState(result.state);
    setError(result.error ?? null);
  }, []);

  return { state, loading, error, subscribe, unsubscribe };
}
