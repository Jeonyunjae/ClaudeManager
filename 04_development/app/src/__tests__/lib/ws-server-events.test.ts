/**
 * ws-server.ts SERVER_EVENTS 정합 테스트 (DF-007)
 * 대상: notification:read, chat:tool, chat:queue가 S->C 이벤트 타입 목록에
 * 빠져 있던 결함. 실제로 broadcast되는 이벤트인데 타입 목록에는 없었다.
 */
import { describe, it, expect } from 'vitest';
import { SERVER_EVENTS } from '@/server/ws-server';

describe('SERVER_EVENTS', () => {
  it('notification:read, chat:tool, chat:queue를 포함한다', () => {
    expect(SERVER_EVENTS).toContain('notification:read');
    expect(SERVER_EVENTS).toContain('chat:tool');
    expect(SERVER_EVENTS).toContain('chat:queue');
  });
});
