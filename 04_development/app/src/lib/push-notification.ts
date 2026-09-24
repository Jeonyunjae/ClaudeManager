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
export async function sendPushNotification(
  title: string,
  body: string,
  url?: string,
  tag?: string
): Promise<void> {
  if (!isPushEnabled()) return;

  const subs = await getSubscriptions();
  if (subs.length === 0) return;

  try {
    // Dynamic import — graceful degradation if web-push is not installed
    const webpushModule = 'web-push';
    const webpush = await import(/* webpackIgnore: true */ webpushModule) as {
      setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
      sendNotification: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string) => Promise<unknown>;
    };

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
          // Remove expired/invalid subscriptions
          if (
            err &&
            typeof err === 'object' &&
            'statusCode' in err &&
            ((err as { statusCode: number }).statusCode === 404 ||
              (err as { statusCode: number }).statusCode === 410)
          ) {
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
  } catch {
    // web-push not installed — silently skip
    if (process.env.NODE_ENV === 'development') {
      console.debug('[push] web-push not available, skipping push notification');
    }
  }
}
