/**
 * lib/notify.ts 단위 테스트 — DES-002 §4 `createNotification` 계약, RISK-01.
 * 수용 기준:
 *   - insert(returning id) 성공 시 {id}를 반환한다 / 실패하면 예외를 던진다
 *   - notification:new 방송에 전 필드(id,type,title,message,sourceAgentId,targetUrl,createdAt)를 담는다
 *   - targetUrl 미지정 시 DES-009 §알림 이동 규칙의 유형별 기본값을 쓴다
 *   - PUSH_TYPES(info,error)만 푸시를 호출하고, tag는 sourceAgentId 유무로 갈린다
 *   - 푸시 실패(reject·동기 throw 모두)는 반환값·예외에 영향을 주지 않는다 (fire-and-forget)
 *   - options.broadcast를 주입하면 기본 wsBroadcast 대신 그 함수를 쓴다 (cli-executor 경로)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  const returning = vi.fn();
  const insertValues = vi.fn(() => ({ returning }));
  const insert = vi.fn(() => ({ values: insertValues }));
  return { returning, insertValues, insert };
});

vi.mock('@/lib/db', () => ({ default: { insert: h.insert } }));

const mockSendPush = vi.fn();
vi.mock('@/lib/push-notification', () => ({
  sendPushNotification: (...args: unknown[]) => mockSendPush(...args),
}));

const mockWsBroadcast = vi.fn();
vi.mock('@/lib/ws-bridge', () => ({
  wsBroadcast: (...args: unknown[]) => mockWsBroadcast(...args),
}));

const mockLogError = vi.fn();
vi.mock('@/lib/error-logger', () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}));

import { createNotification, PUSH_TYPES } from '@/lib/notify';

/** 마이크로태스크를 한 틱 흘려보내 fire-and-forget 체인(.catch)이 실행되게 한다 */
async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('lib/notify.ts - createNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.returning.mockResolvedValue([{ id: 1, createdAt: '2026-09-24T00:00:00.000Z' }]);
    mockWsBroadcast.mockResolvedValue(undefined);
    mockSendPush.mockResolvedValue(undefined);
  });

  describe('insert', () => {
    it('성공하면 {id}를 반환한다', async () => {
      h.returning.mockResolvedValueOnce([{ id: 42, createdAt: '2026-09-24T00:00:00.000Z' }]);

      const result = await createNotification({ type: 'complete', title: 't', message: 'm' });

      expect(result).toEqual({ id: 42 });
    });

    it('실패하면 예외를 던지고 방송·푸시를 호출하지 않는다', async () => {
      h.returning.mockRejectedValueOnce(new Error('db down'));

      await expect(
        createNotification({ type: 'info', title: 't', message: 'm', sourceAgentId: 'a1' })
      ).rejects.toThrow('db down');

      expect(mockWsBroadcast).not.toHaveBeenCalled();
      expect(mockSendPush).not.toHaveBeenCalled();
    });
  });

  describe('notification:new 방송', () => {
    it('전 필드를 포함해 방송한다', async () => {
      h.returning.mockResolvedValueOnce([{ id: 7, createdAt: '2026-09-24T01:00:00.000Z' }]);

      await createNotification({
        type: 'approval',
        title: 'T',
        message: 'M',
        sourceAgentId: 'agent-9',
        targetUrl: '/m/custom',
      });

      expect(mockWsBroadcast).toHaveBeenCalledWith('notification:new', {
        notification: {
          id: 7,
          type: 'approval',
          title: 'T',
          message: 'M',
          sourceAgentId: 'agent-9',
          targetUrl: '/m/custom',
          createdAt: '2026-09-24T01:00:00.000Z',
        },
      });
    });

    it('options.broadcast를 주입하면 기본 wsBroadcast 대신 그 함수를 쓴다 (cli-executor 경로)', async () => {
      h.returning.mockResolvedValueOnce([{ id: 6, createdAt: 'x' }]);
      const injected = vi.fn();

      await createNotification(
        { type: 'info', title: 't', message: 'm', sourceAgentId: 'a' },
        { broadcast: injected }
      );

      expect(injected).toHaveBeenCalledWith(
        'notification:new',
        expect.objectContaining({ notification: expect.objectContaining({ id: 6 }) })
      );
      expect(mockWsBroadcast).not.toHaveBeenCalled();
    });
  });

  describe('targetUrl 기본값 (DES-009 §알림 이동 규칙)', () => {
    it('info + sourceAgentId 있음 → /m/chat/{id}', async () => {
      await createNotification({ type: 'info', title: 't', message: 'm', sourceAgentId: 'ag-1' });
      expect(h.insertValues).toHaveBeenCalledWith(expect.objectContaining({ targetUrl: '/m/chat/ag-1' }));
    });

    it('error + sourceAgentId 있음 → /m/chat/{id}', async () => {
      await createNotification({ type: 'error', title: 't', message: 'm', sourceAgentId: 'ag-2' });
      expect(h.insertValues).toHaveBeenCalledWith(expect.objectContaining({ targetUrl: '/m/chat/ag-2' }));
    });

    it('error + sourceAgentId 없음 → /m/status', async () => {
      await createNotification({ type: 'error', title: 't', message: 'm' });
      expect(h.insertValues).toHaveBeenCalledWith(expect.objectContaining({ targetUrl: '/m/status' }));
    });

    it.each(['approval', 'complete', 'cost', 'recovery', 'warning', 'key_expiry_warning'] as const)(
      '%s → /m/notifications',
      async (type) => {
        await createNotification({ type, title: 't', message: 'm' });
        expect(h.insertValues).toHaveBeenCalledWith(expect.objectContaining({ targetUrl: '/m/notifications' }));
      }
    );

    it('targetUrl을 명시하면 기본값 대신 그 값을 쓴다', async () => {
      await createNotification({ type: 'info', title: 't', message: 'm', targetUrl: '/m/somewhere' });
      expect(h.insertValues).toHaveBeenCalledWith(expect.objectContaining({ targetUrl: '/m/somewhere' }));
    });
  });

  describe('PUSH_TYPES 판정', () => {
    it("PUSH_TYPES는 ['info','error']다", () => {
      expect(PUSH_TYPES).toEqual(['info', 'error']);
    });

    it('info면 푸시를 호출한다', async () => {
      await createNotification({ type: 'info', title: 't', message: 'm', sourceAgentId: 'a' });
      expect(mockSendPush).toHaveBeenCalledTimes(1);
    });

    it('error면 푸시를 호출한다', async () => {
      await createNotification({ type: 'error', title: 't', message: 'm', sourceAgentId: 'a' });
      expect(mockSendPush).toHaveBeenCalledTimes(1);
    });

    it.each(['approval', 'complete', 'cost', 'recovery', 'warning', 'key_expiry_warning'] as const)(
      '%s면 푸시를 호출하지 않는다',
      async (type) => {
        await createNotification({ type, title: 't', message: 'm' });
        expect(mockSendPush).not.toHaveBeenCalled();
      }
    );
  });

  describe('푸시 tag', () => {
    it('sourceAgentId가 있으면 tag=agent-{id}', async () => {
      await createNotification({ type: 'error', title: 't', message: 'm', sourceAgentId: 'ag-1' });
      expect(mockSendPush).toHaveBeenCalledWith('t', 'm', '/m/chat/ag-1', 'agent-ag-1');
    });

    it('sourceAgentId가 없으면 tag=notif-{type}', async () => {
      await createNotification({ type: 'error', title: 't', message: 'm' });
      expect(mockSendPush).toHaveBeenCalledWith('t', 'm', '/m/status', 'notif-error');
    });
  });

  describe('푸시 실패 격리 (RISK-01) — await 하지 않는다', () => {
    it('푸시가 reject해도 반환값·예외에 영향 없다', async () => {
      h.returning.mockResolvedValueOnce([{ id: 4, createdAt: 'x' }]);
      mockSendPush.mockRejectedValueOnce(new Error('push fail'));

      const result = await createNotification({ type: 'info', title: 't', message: 'm', sourceAgentId: 'a' });

      expect(result).toEqual({ id: 4 });
      await flushMicrotasks();
      expect(mockLogError).toHaveBeenCalled();
    });

    it('푸시가 동기적으로 throw해도 반환값·예외에 영향 없다', async () => {
      h.returning.mockResolvedValueOnce([{ id: 5, createdAt: 'x' }]);
      mockSendPush.mockImplementationOnce(() => {
        throw new Error('sync fail');
      });

      const result = await createNotification({ type: 'error', title: 't', message: 'm' });

      expect(result).toEqual({ id: 5 });
    });

    it('푸시를 await 하지 않는다 (createNotification이 푸시 완료를 기다리지 않고 즉시 반환)', async () => {
      let resolvePush: () => void = () => {};
      mockSendPush.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolvePush = resolve;
          })
      );

      const result = await createNotification({ type: 'info', title: 't', message: 'm', sourceAgentId: 'a' });

      expect(result).toEqual({ id: 1 });
      resolvePush();
    });
  });
});
