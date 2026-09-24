/**
 * mobileChatStore 단위 테스트 — FR-004·FR-005, DES-007 §4 메시지 전송,
 * apply*(WS 반영) 순수 로직 검증
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetPaginated = vi.fn();
const mockPost = vi.fn();

vi.mock('@/lib/api', () => ({
  default: {
    getPaginated: mockGetPaginated,
    post: mockPost,
  },
}));

describe('mobileChatStore', () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetPaginated.mockReset();
    mockPost.mockReset();
  });

  it('load 성공 시 messages·hasMore를 채운다', async () => {
    mockGetPaginated.mockResolvedValue({
      data: [{ id: 'm1', timestamp: '2026-09-24T01:00:00.000Z', content: 'hi', type: 'report' }],
      pagination: { page: 1, limit: 30, total: 1, hasMore: false },
    });

    const { useMobileChatStore } = await import('@/stores/mobileChatStore');
    await useMobileChatStore.getState().load('a1');

    const s = useMobileChatStore.getState().getAgentState('a1');
    expect(s.messages).toHaveLength(1);
    expect(s.hasMore).toBe(false);
    expect(s.loading).toBe(false);
    expect(mockGetPaginated).toHaveBeenCalledWith('/api/agents/a1/conversations?page=1&limit=30');
  });

  it('load 실패 시 error를 설정한다', async () => {
    mockGetPaginated.mockRejectedValue(new Error('network'));

    const { useMobileChatStore } = await import('@/stores/mobileChatStore');
    await useMobileChatStore.getState().load('a1');

    const s = useMobileChatStore.getState().getAgentState('a1');
    expect(s.loading).toBe(false);
    expect(s.error).toBe('불러오지 못했습니다');
  });

  it('loadMore는 이전 페이지를 앞에 붙이고 page를 증가시킨다', async () => {
    mockGetPaginated
      .mockResolvedValueOnce({
        data: [{ id: 'm2', timestamp: '2026-09-24T02:00:00.000Z', content: 'second', type: 'report' }],
        pagination: { page: 1, limit: 30, total: 2, hasMore: true },
      })
      .mockResolvedValueOnce({
        data: [{ id: 'm1', timestamp: '2026-09-24T01:00:00.000Z', content: 'first', type: 'report' }],
        pagination: { page: 2, limit: 30, total: 2, hasMore: false },
      });

    const { useMobileChatStore } = await import('@/stores/mobileChatStore');
    await useMobileChatStore.getState().load('a1');
    await useMobileChatStore.getState().loadMore('a1');

    const s = useMobileChatStore.getState().getAgentState('a1');
    expect(s.messages.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(s.page).toBe(2);
    expect(s.hasMore).toBe(false);
  });

  it('hasMore=false면 loadMore를 호출해도 API를 부르지 않는다', async () => {
    const { useMobileChatStore } = await import('@/stores/mobileChatStore');
    await useMobileChatStore.getState().loadMore('a1');
    expect(mockGetPaginated).not.toHaveBeenCalled();
  });

  // DF-011: EVT-M02-4 추가 로딩 실패 — 목록 맨 위 "불러오지 못했습니다 · 다시"
  it('loadMore 실패 시 loadMoreError를 설정하고, 성공하면 다시 비운다', async () => {
    mockGetPaginated
      .mockResolvedValueOnce({
        data: [{ id: 'm1', timestamp: '2026-09-24T01:00:00.000Z', content: 'first', type: 'report' }],
        pagination: { page: 1, limit: 30, total: 2, hasMore: true },
      })
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({
        data: [{ id: 'm0', timestamp: '2026-09-24T00:00:00.000Z', content: 'zeroth', type: 'report' }],
        pagination: { page: 2, limit: 30, total: 2, hasMore: false },
      });

    const { useMobileChatStore } = await import('@/stores/mobileChatStore');
    await useMobileChatStore.getState().load('a1');

    await useMobileChatStore.getState().loadMore('a1');
    let s = useMobileChatStore.getState().getAgentState('a1');
    expect(s.loadMoreError).toBe('불러오지 못했습니다');
    expect(s.loadingMore).toBe(false);

    // "다시" — 재시도 성공 시 loadMoreError가 풀린다
    await useMobileChatStore.getState().loadMore('a1');
    s = useMobileChatStore.getState().getAgentState('a1');
    expect(s.loadMoreError).toBeNull();
    expect(s.messages.map((m) => m.id)).toEqual(['m0', 'm1']);
  });

  it('send: 낙관적 버블을 추가하고 성공하면 sending을 해제하고 true를 반환한다', async () => {
    mockPost.mockResolvedValue({ data: { userMessage: { id: 'u1', sender: 'user', content: '안녕' }, status: 'processing', responseMsgId: 'r1' } });

    const { useMobileChatStore } = await import('@/stores/mobileChatStore');
    const promise = useMobileChatStore.getState().send('a1', '안녕');

    // 낙관적 버블은 await 전에도 반영되어야 한다
    expect(useMobileChatStore.getState().getAgentState('a1').messages).toHaveLength(1);
    expect(useMobileChatStore.getState().getAgentState('a1').sending).toBe(true);

    const ok = await promise;

    const s = useMobileChatStore.getState().getAgentState('a1');
    expect(ok).toBe(true);
    expect(s.sending).toBe(false);
    expect(s.messages[0].content).toBe('안녕');
    expect(s.messages[0].failed).toBeUndefined();
  });

  it('send: 공백만 있으면 아무 것도 하지 않고 false를 반환한다', async () => {
    const { useMobileChatStore } = await import('@/stores/mobileChatStore');
    const ok = await useMobileChatStore.getState().send('a1', '   ');
    expect(ok).toBe(false);
    expect(mockPost).not.toHaveBeenCalled();
    expect(useMobileChatStore.getState().getAgentState('a1').messages).toHaveLength(0);
  });

  // DF-009: 전송 실패 시 호출부(MessageComposer)가 입력 내용을 복원할 수 있도록 false를 반환한다
  it('send: 실패하면 버블에 failed 표시를 남기고 sending을 해제하며 false를 반환한다', async () => {
    mockPost.mockRejectedValue(new Error('500'));

    const { useMobileChatStore } = await import('@/stores/mobileChatStore');
    const ok = await useMobileChatStore.getState().send('a1', '안녕');

    const s = useMobileChatStore.getState().getAgentState('a1');
    expect(ok).toBe(false);
    expect(s.sending).toBe(false);
    expect(s.messages[0].failed).toBe(true);
  });

  it('resend: 실패 버블을 재전송하면 성공 시 failed가 풀린다', async () => {
    mockPost.mockRejectedValueOnce(new Error('500'));
    const { useMobileChatStore } = await import('@/stores/mobileChatStore');
    await useMobileChatStore.getState().send('a1', '재시도 테스트');
    const failedId = useMobileChatStore.getState().getAgentState('a1').messages[0].id;

    mockPost.mockResolvedValueOnce({ data: {} });
    await useMobileChatStore.getState().resend('a1', failedId);

    const s = useMobileChatStore.getState().getAgentState('a1');
    expect(s.messages[0].failed).toBe(false);
    expect(s.sending).toBe(false);
  });

  describe('apply* (WS 반영 순수 로직)', () => {
    it('applyStream: 같은 responseMsgId면 content를 누적 갱신한다', async () => {
      const { useMobileChatStore } = await import('@/stores/mobileChatStore');
      useMobileChatStore.getState().applyStream({ agentId: 'a1', responseMsgId: 'r1', content: '안' });
      useMobileChatStore.getState().applyStream({ agentId: 'a1', responseMsgId: 'r1', content: '안녕' });

      const s = useMobileChatStore.getState().getAgentState('a1');
      expect(s.streaming).toEqual({ responseMsgId: 'r1', content: '안녕' });
    });

    it('applyTool: 도구 이름을 스트리밍 상태에 반영한다', async () => {
      const { useMobileChatStore } = await import('@/stores/mobileChatStore');
      useMobileChatStore.getState().applyStream({ agentId: 'a1', responseMsgId: 'r1', content: '분석 중' });
      useMobileChatStore.getState().applyTool({ agentId: 'a1', responseMsgId: 'r1', name: 'Bash' });

      const s = useMobileChatStore.getState().getAgentState('a1');
      expect(s.streaming?.tool).toBe('Bash');
      expect(s.streaming?.content).toBe('분석 중');
    });

    it('applyTyping: typing 플래그를 반영한다', async () => {
      const { useMobileChatStore } = await import('@/stores/mobileChatStore');
      useMobileChatStore.getState().applyTyping({ agentId: 'a1', isTyping: true });
      expect(useMobileChatStore.getState().getAgentState('a1').typing).toBe(true);
      useMobileChatStore.getState().applyTyping({ agentId: 'a1', isTyping: false });
      expect(useMobileChatStore.getState().getAgentState('a1').typing).toBe(false);
    });

    it('applyQueue: 대기열 깊이를 반영한다', async () => {
      const { useMobileChatStore } = await import('@/stores/mobileChatStore');
      useMobileChatStore.getState().applyQueue({ agentId: 'a1', depth: 2 });
      expect(useMobileChatStore.getState().getAgentState('a1').queueDepth).toBe(2);
    });

    it('applyMessage(agent): 스트리밍을 지우고 확정 버블을 추가한다', async () => {
      const { useMobileChatStore } = await import('@/stores/mobileChatStore');
      useMobileChatStore.getState().applyStream({ agentId: 'a1', responseMsgId: 'r1', content: '작성 중' });
      useMobileChatStore.getState().applyMessage({
        id: 'r1',
        sender: 'sub-1',
        content: '완료했습니다',
        messageType: 'text',
        agentId: 'a1',
        createdAt: '2026-09-24T03:00:00.000Z',
      });

      const s = useMobileChatStore.getState().getAgentState('a1');
      expect(s.streaming).toBeNull();
      expect(s.messages).toHaveLength(1);
      expect(s.messages[0]).toMatchObject({ id: 'r1', content: '완료했습니다', type: 'report' });
    });

    it('applyMessage(user): 낙관적 버블을 실제 id로 맞바꾼다 (중복 생성 방지)', async () => {
      mockPost.mockResolvedValue({ data: {} });
      const { useMobileChatStore } = await import('@/stores/mobileChatStore');
      await useMobileChatStore.getState().send('a1', '실전 메시지');

      useMobileChatStore.getState().applyMessage({
        id: 'real-user-msg-1',
        sender: 'user',
        content: '실전 메시지',
        messageType: 'text',
        agentId: 'a1',
        createdAt: '2026-09-24T03:00:00.000Z',
      });

      const s = useMobileChatStore.getState().getAgentState('a1');
      expect(s.messages).toHaveLength(1);
      expect(s.messages[0].id).toBe('real-user-msg-1');
    });
  });
});
