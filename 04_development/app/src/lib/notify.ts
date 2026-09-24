/**
 * 알림 생성 공통 함수 — DES-002 §4 `createNotification` 계약, ADR-005.
 *
 * 순서:
 *   1) insert … returning id
 *   2) WS `notification:new` 방송 (전 필드)
 *   3) `PUSH_TYPES`에 포함되면 `sendPushNotification`을 **await 하지 않고** `.catch(logError)`
 *
 * 보장 (RISK-01):
 *   - 3단계(푸시) 실패는 반환값·예외에 영향이 없다 (동기 throw 포함)
 *   - 1단계(insert) 실패는 예외를 던진다 (기존 호출처 동작과 같다)
 *
 * 방송 수단은 호출 위치에 따라 다르다 (DES-001 §Backend):
 *   - WS 서버 프로세스 안(`server/cli-executor.ts`)에서는 `server/ws-server`의
 *     `broadcast()`(동기, 인메모리)를 `options.broadcast`로 주입해서 쓴다.
 *   - Next.js API 프로세스(route, `key-expiry-checker.ts`)에서는 기본값인
 *     `ws-bridge`의 `wsBroadcast()`(HTTP, fire-and-forget)를 그대로 쓴다.
 */
import db from './db';
import { notifications } from './schema';
import { logError } from './error-logger';
import { sendPushNotification } from './push-notification';
import { wsBroadcast } from './ws-bridge';
import type { NotificationType } from '@/types/notification';

/** 푸시 발송 대상 유형 (DES-009 상수 `PUSH_TYPES`) */
export const PUSH_TYPES: readonly NotificationType[] = ['info', 'error'];

export type CreateNotificationInput = {
  type: NotificationType;
  title: string;
  message: string;
  sourceAgentId?: string;
  /** 없으면 유형별 기본값 (DES-009 §알림 이동 규칙) */
  targetUrl?: string;
};

/** 방송 함수 — 동기(ws-server `broadcast`)·비동기(ws-bridge `wsBroadcast`) 모두 허용한다 */
export type NotifyBroadcastFn = (type: string, payload: unknown) => void | Promise<void>;

export type CreateNotificationOptions = {
  /** 기본값: `ws-bridge`의 `wsBroadcast`. WS 서버 프로세스 내부에서는 직접 `broadcast`를 주입한다 */
  broadcast?: NotifyBroadcastFn;
};

/**
 * DES-009 §알림 이동 규칙 — targetUrl 미지정 시 유형별 기본값.
 * info/error는 `sourceAgentId`가 있으면 해당 대화로, error는 없으면 `/m/status`로 보낸다.
 * (info에 sourceAgentId가 없는 경우는 설계서에 명시가 없어 그 외 유형과 같은 기본값으로 둔다.)
 */
function defaultTargetUrl(type: NotificationType, sourceAgentId?: string): string {
  if (type === 'info') {
    return sourceAgentId ? `/m/chat/${sourceAgentId}` : '/m/notifications';
  }
  if (type === 'error') {
    return sourceAgentId ? `/m/chat/${sourceAgentId}` : '/m/status';
  }
  return '/m/notifications';
}

export async function createNotification(
  input: CreateNotificationInput,
  options: CreateNotificationOptions = {}
): Promise<{ id: number }> {
  const { type, title, message, sourceAgentId, targetUrl } = input;
  const resolvedTargetUrl = targetUrl ?? defaultTargetUrl(type, sourceAgentId);

  // 1) insert … returning id — 실패하면 그대로 throw한다 (기존 호출처 동작과 같다)
  const [row] = await db
    .insert(notifications)
    .values({
      type,
      title,
      message,
      sourceAgentId,
      targetUrl: resolvedTargetUrl,
    })
    .returning({ id: notifications.id, createdAt: notifications.createdAt });

  // 2) notification:new 방송 (전 필드)
  const broadcastFn = options.broadcast ?? wsBroadcast;
  const payload = {
    notification: {
      id: row.id,
      type,
      title,
      message,
      sourceAgentId,
      targetUrl: resolvedTargetUrl,
      createdAt: row.createdAt,
    },
  };

  try {
    await broadcastFn('notification:new', payload);
  } catch (err) {
    logError(err, { requestPath: 'lib/notify:broadcast', context: { type } });
  }

  // 3) 푸시 — await 하지 않는다. 동기 throw까지 포함해 반환값/예외에 영향 없게 방어한다.
  if (PUSH_TYPES.includes(type)) {
    const tag = sourceAgentId ? `agent-${sourceAgentId}` : `notif-${type}`;
    try {
      void sendPushNotification(title, message, resolvedTargetUrl, tag).catch((err) =>
        logError(err, { requestPath: 'lib/notify:push', context: { type } })
      );
    } catch (err) {
      logError(err, { requestPath: 'lib/notify:push-sync', context: { type } });
    }
  }

  return { id: row.id };
}
