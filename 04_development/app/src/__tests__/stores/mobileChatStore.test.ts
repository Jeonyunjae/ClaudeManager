/**
 * mobileChatStore 단위 테스트 — FR-004·FR-005, DES-007 §4 메시지 전송,
 * apply*(WS 반영) 순수 로직 검증
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetPaginated = vi.fn();
const mockPost = vi.fn();
const mockUpload = vi.fn();
const mockPrepareImage = vi.fn();

vi.mock('@/lib/api', () => ({
  default: {
    getPaginated: mockGetPaginated,
    post: mockPost,
    upload: mockUpload,
  },
}));

vi.mock('@/lib/image-prepare', () => ({
  prepareImage: mockPrepareImage,
}));

describe('mobileChatStore', () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetPaginated.mockReset();
    mockPost.mockReset();
    mockUpload.mockReset();
    mockPrepareImage.mockReset();
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

  describe('사진 첨부 (FEAT-001)', () => {
    const photo = { filename: 'IMG_0001.jpg', path: '/app/data/uploads/u1.jpg', type: 'image/jpeg' };

    it('send: 첨부를 채팅 API에 함께 보내고, 버블에는 서버와 같은 📎 표시를 붙인다', async () => {
      mockPost.mockResolvedValue({ data: {} });
      const { useMobileChatStore } = await import('@/stores/mobileChatStore');

      const ok = await useMobileChatStore.getState().send('a1', ' 이거 봐줘 ', [photo]);

      expect(ok).toBe(true);
      expect(mockPost).toHaveBeenCalledWith('/api/agents/a1/chat', { content: '이거 봐줘', attachments: [photo] });
      expect(useMobileChatStore.getState().getAgentState('a1').messages[0].content).toBe('이거 봐줘\n\n📎 IMG_0001.jpg');
    });

    it('send: 글 없이 사진만 보내면 기본 문장으로 보낸다', async () => {
      mockPost.mockResolvedValue({ data: {} });
      const { useMobileChatStore } = await import('@/stores/mobileChatStore');
      const { ATTACHMENT_ONLY_PROMPT } = await import('@/lib/constants');

      const ok = await useMobileChatStore.getState().send('a1', '', [photo]);

      expect(ok).toBe(true);
      expect(mockPost).toHaveBeenCalledWith('/api/agents/a1/chat', { content: ATTACHMENT_ONLY_PROMPT, attachments: [photo] });
    });

    it('send: 첨부가 없으면 기존과 같은 본문 { content }만 보낸다', async () => {
      mockPost.mockResolvedValue({ data: {} });
      const { useMobileChatStore } = await import('@/stores/mobileChatStore');
      await useMobileChatStore.getState().send('a1', '안녕');
      expect(mockPost).toHaveBeenCalledWith('/api/agents/a1/chat', { content: '안녕' });
    });

    it('resend: 실패한 사진 메시지를 다시 보내면 원래 글과 첨부로 재전송한다', async () => {
      mockPost.mockRejectedValueOnce(new Error('500'));
      const { useMobileChatStore } = await import('@/stores/mobileChatStore');
      await useMobileChatStore.getState().send('a1', '봐줘', [photo]);
      const failedId = useMobileChatStore.getState().getAgentState('a1').messages[0].id;

      mockPost.mockResolvedValueOnce({ data: {} });
      await useMobileChatStore.getState().resend('a1', failedId);

      expect(mockPost).toHaveBeenLastCalledWith('/api/agents/a1/chat', { content: '봐줘', attachments: [photo] });
    });

    it('WS chat:message(서버 표시문)가 오면 사진 낙관적 버블을 실 id로 맞바꾼다', async () => {
      mockPost.mockResolvedValue({ data: {} });
      const { useMobileChatStore } = await import('@/stores/mobileChatStore');
      await useMobileChatStore.getState().send('a1', '봐줘', [photo]);

      useMobileChatStore.getState().applyMessage({
        id: 'real-1', sender: 'user', content: '봐줘\n\n📎 IMG_0001.jpg', messageType: 'text', agentId: 'a1', createdAt: '2026-09-26T00:00:00.000Z',
      });

      const msgs = useMobileChatStore.getState().getAgentState('a1').messages;
      expect(msgs).toHaveLength(1);
      expect(msgs[0].id).toBe('real-1');
    });

    it('uploadImage: 줄인 사진을 FormData로 올리고 채팅용 첨부 정보를 돌려준다', async () => {
      const original = new File(['big'], 'IMG_0001.HEIC', { type: 'image/heic' });
      const prepared = new File(['small'], 'IMG_0001.jpg', { type: 'image/jpeg' });
      mockPrepareImage.mockResolvedValue(prepared);
      mockUpload.mockResolvedValue({ data: { id: 'u1', ...photo, size: 5, ext: '.jpg', storedName: 'u1.jpg' } });
      const { useMobileChatStore } = await import('@/stores/mobileChatStore');

      const result = await useMobileChatStore.getState().uploadImage(original);

      expect(mockPrepareImage).toHaveBeenCalledWith(original);
      const [path, form] = mockUpload.mock.calls[0];
      expect(path).toBe('/api/upload');
      expect((form as FormData).get('file')).toBeInstanceOf(File);
      expect(((form as FormData).get('file') as File).name).toBe('IMG_0001.jpg');
      expect(result).toEqual(photo);
    });

    it('uploadImage: 업로드가 실패하면 예외를 그대로 던진다 (입력창이 실패 표시)', async () => {
      mockPrepareImage.mockImplementation(async (f: File) => f);
      mockUpload.mockRejectedValue(new Error('File exceeds 10MB limit.'));
      const { useMobileChatStore } = await import('@/stores/mobileChatStore');
      await expect(useMobileChatStore.getState().uploadImage(new File(['x'], 'a.jpg'))).rejects.toThrow('10MB');
    });
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

    // BUG-008: 재연결 REST 재조회와 WS 수신이 겹치는 경우를 흉내낸다 — 같은 id가 두 번 온다.
    it('같은 id의 에이전트 응답이 두 번 오면 버블을 중복 추가하지 않는다 (BUG-008)', async () => {
      const { useMobileChatStore } = await import('@/stores/mobileChatStore');
      const msg = {
        id: 'r1',
        sender: 'sub-1',
        content: '완료했습니다',
        messageType: 'text',
        agentId: 'a1',
        createdAt: '2026-09-24T03:00:00.000Z',
      };

      useMobileChatStore.getState().applyMessage(msg);
      useMobileChatStore.getState().applyMessage(msg); // 중복 수신

      const s = useMobileChatStore.getState().getAgentState('a1');
      expect(s.messages).toHaveLength(1);
    });

    it('같은 id의 사용자 메시지가 두 번 오면(재조회+WS) 버블을 중복 추가하지 않는다 (BUG-008)', async () => {
      const { useMobileChatStore } = await import('@/stores/mobileChatStore');
      const msg = {
        id: 'real-user-msg-2',
        sender: 'user',
        content: '중복 방지 확인',
        messageType: 'text',
        agentId: 'a1',
        createdAt: '2026-09-24T03:00:00.000Z',
      };

      useMobileChatStore.getState().applyMessage(msg);
      useMobileChatStore.getState().applyMessage(msg);

      const s = useMobileChatStore.getState().getAgentState('a1');
      expect(s.messages).toHaveLength(1);
    });
  });
});
