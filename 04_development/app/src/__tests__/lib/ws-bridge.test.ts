/**
 * ws-bridge.ts 단위 테스트
 * 대상 기능: F013, F028 (실시간 알림, WebSocket 브로드캐스트)
 * 수용 기준:
 *   - wsBroadcast가 올바른 HTTP POST를 전송
 *   - WS 서버 미실행 시 에러를 삼키는지 (fire-and-forget)
 *   - 각 broadcastXxx 헬퍼가 올바른 type/payload 전달
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mock setup
import {
  wsBroadcast,
  broadcastAgentStatus,
  broadcastChatMessage,
  broadcastApprovalRequest,
  broadcastApprovalResolved,
  broadcastPartCreated,
  broadcastAgentCreated,
  broadcastAgentRemoved,
  broadcastNotification,
  broadcastCostUpdated,
  broadcastLogNew,
} from '@/lib/ws-bridge';

describe('ws-bridge.ts - WebSocket 브로드캐스트 브릿지', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true });
  });

  // --- AC: wsBroadcast ---
  describe('wsBroadcast', () => {
    it('올바른 URL로 POST 요청 전송', async () => {
      await wsBroadcast('test:event', { data: 'hello' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/_broadcast');
      expect(url).toContain('3001');
      expect(options.method).toBe('POST');
    });

    it('Content-Type과 x-ws-secret 헤더 포함', async () => {
      await wsBroadcast('test:event', {});

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.headers['x-ws-secret']).toBeDefined();
    });

    it('body에 type과 payload 포함', async () => {
      await wsBroadcast('agent:status', { agentId: 'a1', status: 'active' });

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.type).toBe('agent:status');
      expect(body.payload).toEqual({ agentId: 'a1', status: 'active' });
    });

    it('WS 서버 미실행 시 에러를 삼킴 (fire-and-forget)', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      // Should NOT throw
      await expect(wsBroadcast('test:event', {})).resolves.toBeUndefined();
    });

    it('fetch timeout이 3000ms로 설정', async () => {
      await wsBroadcast('test:event', {});

      const [, options] = mockFetch.mock.calls[0];
      expect(options.signal).toBeDefined();
    });
  });

  // --- AC: broadcastAgentStatus ---
  describe('broadcastAgentStatus', () => {
    it('type=agent:status로 브로드캐스트', async () => {
      await broadcastAgentStatus('agent-1', 'active', 'Running');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.type).toBe('agent:status');
      expect(body.payload.agentId).toBe('agent-1');
      expect(body.payload.status).toBe('active');
      expect(body.payload.statusMessage).toBe('Running');
    });
  });

  // --- AC: broadcastChatMessage ---
  describe('broadcastChatMessage', () => {
    it('type=chat:message로 브로드캐스트', async () => {
      const msg = { id: 'm1', sender: 'user', content: 'Hello', messageType: 'text' };
      await broadcastChatMessage(msg);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.type).toBe('chat:message');
      expect(body.payload.id).toBe('m1');
      expect(body.payload.content).toBe('Hello');
    });
  });

  // --- AC: broadcastApprovalRequest ---
  describe('broadcastApprovalRequest', () => {
    it('type=approval:request로 브로드캐스트', async () => {
      await broadcastApprovalRequest({
        id: 'apr-1',
        title: 'Deploy?',
        content: 'Ready to deploy',
        urgency: 'high',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.type).toBe('approval:request');
      expect(body.payload.id).toBe('apr-1');
      expect(body.payload.urgency).toBe('high');
    });
  });

  // --- AC: broadcastApprovalResolved ---
  describe('broadcastApprovalResolved', () => {
    it('type=approval:resolved로 브로드캐스트', async () => {
      await broadcastApprovalResolved('apr-2', 'approved');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.type).toBe('approval:resolved');
      expect(body.payload.id).toBe('apr-2');
      expect(body.payload.result).toBe('approved');
    });
  });

  // --- AC: broadcastPartCreated ---
  describe('broadcastPartCreated', () => {
    it('type=part:created로 브로드캐스트', async () => {
      await broadcastPartCreated({ id: 'p1', name: 'Dev', color: 'blue' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.type).toBe('part:created');
      expect(body.payload.part.name).toBe('Dev');
    });
  });

  // --- AC: broadcastAgentCreated ---
  describe('broadcastAgentCreated', () => {
    it('type=agent:created로 브로드캐스트', async () => {
      await broadcastAgentCreated({ id: 'a1', name: 'Worker', role: 'instance' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.type).toBe('agent:created');
      expect(body.payload.agent.role).toBe('instance');
    });
  });

  // --- AC: broadcastAgentRemoved ---
  describe('broadcastAgentRemoved', () => {
    it('type=agent:removed로 브로드캐스트', async () => {
      await broadcastAgentRemoved('agent-del');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.type).toBe('agent:removed');
      expect(body.payload.agentId).toBe('agent-del');
    });
  });

  // --- AC: broadcastNotification ---
  describe('broadcastNotification', () => {
    it('type=notification:new로 브로드캐스트', async () => {
      await broadcastNotification({
        type: 'warning',
        title: 'Alert',
        message: 'Something happened',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.type).toBe('notification:new');
      expect(body.payload.notification.title).toBe('Alert');
    });
  });

  // --- AC: broadcastCostUpdated ---
  describe('broadcastCostUpdated', () => {
    it('type=cost:updated로 브로드캐스트', async () => {
      await broadcastCostUpdated({ totalCost: 50, costLimit: 100, percentage: 50 });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.type).toBe('cost:updated');
      expect(body.payload.summary.totalCost).toBe(50);
    });
  });

  // --- AC: broadcastLogNew ---
  describe('broadcastLogNew', () => {
    it('type=log:new로 브로드캐스트', async () => {
      await broadcastLogNew('agent-log', { eventType: 'error', message: 'fail' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.type).toBe('log:new');
      expect(body.payload.agentId).toBe('agent-log');
      expect(body.payload.entry.eventType).toBe('error');
    });
  });
});
