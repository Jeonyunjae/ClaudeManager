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

/**
 * 알려진 웹 푸시 서비스 호스트 — SEC-003 (SSRF 방지).
 * `*.` 접두사는 해당 도메인 자체와 모든 하위 도메인을 허용한다는 뜻이다.
 */
const ALLOWED_PUSH_HOSTS: readonly string[] = [
  '*.push.apple.com',
  'fcm.googleapis.com',
  '*.notify.windows.com',
  'updates.push.services.mozilla.com',
  '*.push.services.mozilla.com',
];

function hostMatchesPattern(host: string, pattern: string): boolean {
  if (pattern.startsWith('*.')) {
    const bareDomain = pattern.slice(2);
    return host === bareDomain || host.endsWith(`.${bareDomain}`);
  }
  return host === pattern;
}

/**
 * 구독 endpoint가 알려진 푸시 서비스인지 검증한다 (순수 함수, SEC-003).
 *
 * 인증된 사용자라도 임의의 URL을 endpoint로 넣어 서버가 그 URL로 POST하게 만들 수 있었다
 * (web-push 발송 시 `sendPushNotification`이 이 endpoint로 직접 요청을 보낸다 — SSRF).
 * https만, 그리고 알려진 푸시 서비스 호스트일 때만 허용한다.
 */
export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  return ALLOWED_PUSH_HOSTS.some((pattern) => hostMatchesPattern(url.hostname, pattern));
}

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

    // SEC-003: 알려진 푸시 서비스가 아니면 거부한다 (SSRF 방지 — endpoint는 서버가 직접 POST하는 URL이다).
    if (!isAllowedPushEndpoint(endpoint)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Unsupported push endpoint.' } },
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
