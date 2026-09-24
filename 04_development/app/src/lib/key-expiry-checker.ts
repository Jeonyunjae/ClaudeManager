/**
 * Key Expiry Checker — daily scheduler that checks API key expiration dates
 * and creates notifications for keys expiring within 7 days.
 * Marks expired keys as 'expired'.
 */

import db from './db';
import { apiKeys, notifications } from './schema';
import { and, lte, eq, not } from 'drizzle-orm';
import { createNotification } from './notify';

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const WARNING_DAYS = 7;

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Run a single check cycle.
 */
export async function checkKeyExpiry(): Promise<void> {
  try {
    const now = new Date();
    const warningDate = new Date(now.getTime() + WARNING_DAYS * 24 * 60 * 60 * 1000);
    const nowStr = now.toISOString();
    const warningStr = warningDate.toISOString();

    // 1. Find keys that are already expired but still marked active
    const allActiveKeys = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.status, 'active'),
          not(eq(apiKeys.expiresAt, ''))
        )
      );

    const expiredKeys = allActiveKeys.filter(
      (k) => k.expiresAt !== null && k.expiresAt <= nowStr
    );

    for (const key of expiredKeys) {
      await db.update(apiKeys)
        .set({ status: 'expired', updatedAt: nowStr })
        .where(eq(apiKeys.id, key.id));

      await createNotification({
        type: 'warning',
        title: 'API Key Expired',
        message: `API key for ${key.provider} (${key.keyMasked}) has expired.`,
      });
    }

    // 2. Find keys expiring within WARNING_DAYS
    const expiringKeys = allActiveKeys.filter((k) => {
      if (!k.expiresAt) return false;
      return k.expiresAt > nowStr && k.expiresAt <= warningStr;
    });

    for (const key of expiringKeys) {
      // Check if we already sent a notification for this key today
      const allNotifs = await db
        .select()
        .from(notifications)
        .where(eq(notifications.type, 'key_expiry_warning'));

      const existingNotif = allNotifs.find(
        (n) =>
          n.message.includes(key.keyMasked) &&
          n.createdAt.startsWith(nowStr.slice(0, 10))
      );

      if (existingNotif) continue;

      const daysLeft = Math.ceil(
        (new Date(key.expiresAt!).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );

      await createNotification({
        type: 'key_expiry_warning',
        title: 'API Key Expiring Soon',
        message: `API key for ${key.provider} (${key.keyMasked}) expires in ${daysLeft} day(s).`,
      });
    }

    console.log(
      `[key-expiry] Check complete: ${expiredKeys.length} expired, ${expiringKeys.length} expiring soon`
    );
  } catch (err) {
    console.error('[key-expiry] Check failed:', err);
  }
}

/**
 * Start the daily key expiry checker.
 */
export function startKeyExpiryChecker(): void {
  if (intervalId) return;

  // Run immediately on startup
  checkKeyExpiry();

  // Then run every 24 hours
  intervalId = setInterval(() => { checkKeyExpiry(); }, CHECK_INTERVAL_MS);
  console.log('[key-expiry] Scheduler started (24h interval)');
}

/**
 * Stop the key expiry checker.
 */
export function stopKeyExpiryChecker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[key-expiry] Scheduler stopped');
  }
}
