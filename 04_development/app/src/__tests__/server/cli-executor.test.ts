/**
 * server/cli-executor.ts — processChatInBackground 단위 테스트 (BUG-012).
 *
 * 결함: 응답 저장·chat:message 방송까지 끝난 뒤 호출하는 createNotification이 실패하면
 * (예: notifications insert 실패) 예외가 바깥 catch로 빠져 이미 성공으로 끝난 응답 위에
 * "[Error] ..." 메시지를 다시 저장·방송해 정상 응답을 오류로 둔갑시켰다.
 * 수정: createNotification 호출만 별도 try/catch로 감싸 실패를 로그로만 남긴다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const dbInsertValues = vi.fn(() => Promise.resolve());
const dbUpdateWhere = vi.fn(() => Promise.resolve());
const dbUpdateSet = vi.fn(() => ({ where: dbUpdateWhere }));
const dbSelectLimit = vi.fn(() => Promise.resolve([]));
const dbSelectWhere = vi.fn(() => ({ limit: dbSelectLimit }));
const dbSelectFrom = vi.fn(() => ({ where: dbSelectWhere }));

vi.mock('@/lib/db', () => ({
  default: {
    insert: vi.fn(() => ({ values: dbInsertValues })),
    update: vi.fn(() => ({ set: dbUpdateSet })),
    select: vi.fn(() => ({ from: dbSelectFrom })),
  },
}));

const mockSendMessage = vi.fn();
vi.mock('@/lib/agent-manager', () => ({
  agentManager: {
    sendMessage: (...args: unknown[]) => mockSendMessage(...args),
  },
}));

const mockCreateNotification = vi.fn();
vi.mock('@/lib/notify', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

const mockBroadcast = vi.fn();
vi.mock('@/server/ws-server', () => ({
  broadcast: (...args: unknown[]) => mockBroadcast(...args),
}));

describe('processChatInBackground (BUG-012)', () => {
  beforeEach(() => {
    vi.resetModules();
    dbInsertValues.mockClear();
    dbUpdateWhere.mockClear();
    mockSendMessage.mockReset();
    mockCreateNotification.mockReset();
    mockBroadcast.mockClear();
  });

  it('알림 생성이 실패해도 이미 방송한 성공 chat:message가 error로 덮이지 않는다', async () => {
    mockSendMessage.mockResolvedValue({
      text: '완료했습니다',
      costUsd: 0,
      inputTokens: 0,
      outputTokens: 0,
      modelName: 'sonnet',
      durationMs: 10,
    });
    mockCreateNotification.mockRejectedValue(new Error('notify db down'));

    const { processChatInBackground } = await import('@/server/cli-executor');

    await expect(
      processChatInBackground({
        agentId: 'a1',
        agentName: 'Sub-1',
        cliPrompt: 'hi',
        systemPrompt: 'sys',
        responseMsgId: 'r1',
        userId: 'u1',
      })
    ).resolves.toBeUndefined();

    // chat:message는 성공 내용으로 정확히 한 번만 방송되어야 한다 — error로 덮였다면
    // catch 블록이 다시 [Error] 메시지로 두 번째 chat:message를 방송했을 것이다.
    const chatMessageCalls = mockBroadcast.mock.calls.filter(([type]) => type === 'chat:message');
    expect(chatMessageCalls).toHaveLength(1);
    expect(chatMessageCalls[0][1]).toMatchObject({ content: '완료했습니다', messageType: 'text' });

    // agent:status의 마지막 값도 idle이어야 한다(error로 되돌아가면 안 된다).
    const statusCalls = mockBroadcast.mock.calls.filter(([type]) => type === 'agent:status');
    expect(statusCalls[statusCalls.length - 1][1]).toMatchObject({ status: 'idle' });
  });

  it('알림 생성이 성공하면 그대로 정상 흐름이다 (회귀 방지)', async () => {
    mockSendMessage.mockResolvedValue({
      text: '정상 응답',
      costUsd: 0.01,
      inputTokens: 10,
      outputTokens: 5,
      modelName: 'sonnet',
      durationMs: 5,
    });
    mockCreateNotification.mockResolvedValue({ id: 1 });

    const { processChatInBackground } = await import('@/server/cli-executor');

    await processChatInBackground({
      agentId: 'a2',
      agentName: 'Sub-2',
      cliPrompt: 'hi',
      systemPrompt: 'sys',
      responseMsgId: 'r2',
      userId: 'u1',
    });

    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    const chatMessageCalls = mockBroadcast.mock.calls.filter(([type]) => type === 'chat:message');
    expect(chatMessageCalls).toHaveLength(1);
    expect(chatMessageCalls[0][1]).toMatchObject({ content: '정상 응답' });
  });
});
