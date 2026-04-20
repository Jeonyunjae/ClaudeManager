/**
 * Push Notification Subscription API — manages browser push subscriptions.
 *
 * POST — subscribe to push notifications
 * DELETE — unsubscribe from push notifications
 * GET — get VAPID public key and push status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import {
  addPushSubscription,
  removePushSubscription,
  getVapidPublicKey,
  isPushEnabled,
} from '@/lib/push-notification';
import { logError } from '@/lib/error-logger';

export async function GET(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_TOKEN_EXPIRED', message: 'Authentication required.' } },
      { status: 401 }
    );
  }

  return NextResponse.json({
    data: {
      enabled: isPushEnabled(),
      vapidPublicKey: getVapidPublicKey(),
    },
  });
}

export async function POST(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_TOKEN_EXPIRED', message: 'Authentication required.' } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_REQUIRED', message: 'endpoint and keys are required.' } },
        { status: 400 }
      );
    }

    await addPushSubscription({ endpoint, keys, createdAt: new Date().toISOString() });

    return NextResponse.json({ data: { subscribed: true } });
  } catch (error) {
    logError(error, { requestPath: '/api/notifications/subscribe' });
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: 'Server error.' } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_TOKEN_EXPIRED', message: 'Authentication required.' } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_REQUIRED', message: 'endpoint is required.' } },
        { status: 400 }
      );
    }

    await removePushSubscription(endpoint);

    return NextResponse.json({ data: { unsubscribed: true } });
  } catch (error) {
    logError(error, { requestPath: '/api/notifications/subscribe' });
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: 'Server error.' } },
      { status: 500 }
    );
  }
}
