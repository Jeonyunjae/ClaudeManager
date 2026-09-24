/**
 * inboxStore 단위 테스트 — FR-006·FR-007, EVT-M01-2(확인함 낙관적 갱신·롤백)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('@/lib/api', () => ({
  default: {
    get: mockGet,
    post: mockPost,
  },
}));

describe('inboxStore', () => {
  beforeEach(() => {
    vi.resetModules();
    mockGet.mockReset();
    mockPost.mockReset();
  });

  it('fetchInbox 성공 시 items·count를 반영한다', async () => {
    mockGet.mockResolvedValue({
      data: [
        { agentId: 'a1', agentName: 'Main', role: 'main', agentStatus: 'idle', lastMessageId: 'm1', preview: 'p', lastMessageAt: '2026-09-24T01:00:00.000Z' },
      ],
      meta: { count: 1 },
    });

    const { useInboxStore } = await import('@/stores/inboxStore');
    await useInboxStore.getState().fetchInbox();

    expect(useInboxStore.getState().items).toHaveLength(1);
    expect(useInboxStore.getState().count).toBe(1);
    expect(useInboxStore.getState().loading).toBe(false);
    expect(useInboxStore.getState().error).toBeNull();
  });

  it('fetchInbox 실패 시 에러를 표시하고 loading을 해제한다', async () => {
    mockGet.mockRejectedValue(new Error('network'));

    const { useInboxStore } = await import('@/stores/inboxStore');
    await useInboxStore.getState().fetchInbox();

    expect(useInboxStore.getState().loading).toBe(false);
    expect(useInboxStore.getState().error).toBe('불러오지 못했습니다');
  });

  it('ack 성공 시 해당 항목을 목록에서 제거하고 count를 줄인다', async () => {
    mockGet.mockResolvedValue({
      data: [
        { agentId: 'a1', agentName: 'Main', role: 'main', agentStatus: 'idle', lastMessageId: 'm1', preview: 'p', lastMessageAt: '2026-09-24T01:00:00.000Z' },
        { agentId: 'a2', agentName: 'Sub', role: 'sub', agentStatus: 'active', lastMessageId: 'm2', preview: 'p2', lastMessageAt: '2026-09-24T02:00:00.000Z' },
      ],
      meta: { count: 2 },
    });
    mockPost.mockResolvedValue({ data: { agentId: 'a1', ackAt: '2026-09-24T03:00:00.000Z' } });

    const { useInboxStore } = await import('@/stores/inboxStore');
    await useInboxStore.getState().fetchInbox();
    await useInboxStore.getState().ack('a1');

    expect(mockPost).toHaveBeenCalledWith('/api/inbox/a1/ack', {});
    expect(useInboxStore.getState().items.map((i) => i.agentId)).toEqual(['a2']);
    expect(useInboxStore.getState().count).toBe(1);
  });

  it('ack 실패 시 제거했던 항목을 되돌리고 에러를 표시한다', async () => {
    mockGet.mockResolvedValue({
      data: [
        { agentId: 'a1', agentName: 'Main', role: 'main', agentStatus: 'idle', lastMessageId: 'm1', preview: 'p', lastMessageAt: '2026-09-24T01:00:00.000Z' },
      ],
      meta: { count: 1 },
    });
    mockPost.mockRejectedValue(new Error('server error'));

    const { useInboxStore } = await import('@/stores/inboxStore');
    await useInboxStore.getState().fetchInbox();
    await useInboxStore.getState().ack('a1');

    expect(useInboxStore.getState().items).toHaveLength(1);
    expect(useInboxStore.getState().items[0].agentId).toBe('a1');
    expect(useInboxStore.getState().count).toBe(1);
    expect(useInboxStore.getState().error).toBe('처리 실패 — 다시 시도');
  });

  it('목록에 없는 agentId를 ack 하면 아무 일도 하지 않는다', async () => {
    mockGet.mockResolvedValue({ data: [], meta: { count: 0 } });

    const { useInboxStore } = await import('@/stores/inboxStore');
    await useInboxStore.getState().fetchInbox();
    await useInboxStore.getState().ack('nope');

    expect(mockPost).not.toHaveBeenCalled();
  });
});
