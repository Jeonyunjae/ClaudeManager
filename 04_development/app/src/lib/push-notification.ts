/**
 * Push Notification Manager — manages Web Push subscriptions and sending.
 *
 * Requires the `web-push` package. Gracefully degrades if not installed.
 *
 * VAPID keys should be set via environment variables:
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 */

import db from './db';
import { settings } from './schema';
import { eq } from 'drizzle-orm';

// Push subscription stored in settings table as JSON
const PUSH_SUBS_KEY = 'push_subscriptions';

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Subscription management
// ---------------------------------------------------------------------------

async function getSubscriptions(): Promise<PushSubscriptionData[]> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, PUSH_SUBS_KEY)).limit(1);
    if (!row) return [];
    return JSON.parse(row.value) as PushSubscriptionData[];
  } catch {
    return [];
  }
}

async function saveSubscriptions(subs: PushSubscriptionData[]): Promise<void> {
  const now = new Date().toISOString();
  const value = JSON.stringify(subs);
  const [existing] = await db.select().from(settings).where(eq(settings.key, PUSH_SUBS_KEY)).limit(1);

  if (existing) {
    await db.update(settings)
      .set({ value, updatedAt: now })
      .where(eq(settings.key, PUSH_SUBS_KEY));
  } else {
    await db.insert(settings).values({ key: PUSH_SUBS_KEY, value, updatedAt: now });
  }
}

/**
 * Add a push subscription.
 */
export async function addPushSubscription(sub: PushSubscriptionData): Promise<void> {
  const subs = await getSubscriptions();
  // Avoid duplicates by endpoint
  const filtered = subs.filter((s) => s.endpoint !== sub.endpoint);
  filtered.push({ ...sub, createdAt: new Date().toISOString() });
  await saveSubscriptions(filtered);
}

/**
 * Remove a push subscription by endpoint.
 */
export async function removePushSubscription(endpoint: string): Promise<void> {
  const subs = await getSubscriptions();
  const filtered = subs.filter((s) => s.endpoint !== endpoint);
  await saveSubscriptions(filtered);
}

/**
 * Get VAPID public key for client-side subscription.
 */
export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

/**
 * Check if push notifications are enabled (VAPID keys configured).
 */
export function isPushEnabled(): boolean {
  return !!(
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT
  );
}

/**
 * Send a push notification to all subscribers.
 * Requires the `web-push` package to be installed.
 * Silently no-ops if web-push is not available or VAPID keys are missing.
 */
interface WebPushApi {
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
  sendNotification: (
    sub: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string
  ) => Promise<unknown>;
}

/**
 * `web-push`는 CJS 패키지라(module.exports 객체 리터럴) ESM 동적 import 결과가
 * `{ default: { setVapidDetails, sendNotification, ... }, ... }` 형태로 래핑될 수
 * 있다(cjs-module-lexer가 named export를 정적으로 못 찾으면 전부 default 아래로
 * 들어간다). 언랩 후에도 실제 API가 있는지 확인해, 다른 이유로 모듈 로드가
 * 깨졌을 때는 "web-push not available"로 착각하지 않고 별도 로그를 남긴다
 * (BUG-017).
 */
function unwrapWebPush(mod: unknown): WebPushApi {
  const candidate = (mod as { default?: unknown } | null | undefined)?.default ?? mod;
  const api = candidate as Partial<WebPushApi> | null | undefined;
  if (!api || typeof api.setVapidDetails !== 'function' || typeof api.sendNotification !== 'function') {
    throw new Error('web-push module does not expose setVapidDetails/sendNotification');
  }
  return api as WebPushApi;
}

export async function sendPushNotification(
  title: string,
  body: string,
  url?: string,
  tag?: string
): Promise<void> {
  if (!isPushEnabled()) return;

  const subs = await getSubscriptions();
  if (subs.length === 0) return;

  let webpush: WebPushApi;
  try {
    // Dynamic import — graceful degradation if web-push is not installed
    const webpushModule = 'web-push';
    const mod = await import(/* webpackIgnore: true */ webpushModule);
    webpush = unwrapWebPush(mod);
  } catch (err: unknown) {
    // 모듈 로드/형태 실패 — web-push 미설치이거나 예상과 다른 모듈 구조
    if (process.env.NODE_ENV === 'development') {
      console.debug(
        '[push] web-push module unavailable, skipping push notification:',
        err instanceof Error ? err.message : String(err)
      );
    }
    return;
  }

  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );

    const payload = JSON.stringify({ title, body, url: url || '/', tag });
    const expiredEndpoints: string[] = [];

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: sub.keys,
            },
            payload
          );
        } catch (err: unknown) {
          const statusCode =
            err && typeof err === 'object' && 'statusCode' in err
              ? (err as { statusCode: number }).statusCode
              : undefined;

          // 발송 실패 — 엔드포인트 전체(구독자 식별 가능)·키는 로그에 남기지 않고
          // 호스트명과 statusCode만 남긴다.
          if (process.env.NODE_ENV === 'development') {
            let host = 'unknown';
            try {
              host = new URL(sub.endpoint).host;
            } catch {
              // ignore malformed endpoint URL
            }
            console.debug('[push] sendNotification failed', { host, statusCode });
          }

          // Remove expired/invalid subscriptions
          if (statusCode === 404 || statusCode === 410) {
            expiredEndpoints.push(sub.endpoint);
          }
        }
      })
    );

    // Cleanup expired subscriptions
    if (expiredEndpoints.length > 0) {
      const remaining = subs.filter((s) => !expiredEndpoints.includes(s.endpoint));
      await saveSubscriptions(remaining);
    }
  } catch (err: unknown) {
    // setVapidDetails 등 발송 준비 단계 실패 — 모듈 로드 실패와는 별도로 남긴다
    if (process.env.NODE_ENV === 'development') {
      console.debug(
        '[push] failed to send push notifications:',
        err instanceof Error ? err.message : String(err)
      );
    }
  }
}
