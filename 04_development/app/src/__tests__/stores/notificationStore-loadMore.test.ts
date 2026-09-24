/**
 * notificationStore.loadMore 단위 테스트 — DF-011 (EVT-M03-7 추가 로딩 실패)
 * 기존 notificationStore.test.ts는 순수 배열 로직만 검증하므로, API 통신이 필요한
 * loadMore·loadMoreError는 mobileChatStore.test.ts와 같은 패턴(apiClient mock)으로 검증한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetPaginated = vi.fn();

vi.mock('@/lib/api', () => ({
  default: {
    getPaginated: mockGetPaginated,
  },
}));

describe('notificationStore.loadMore', () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetPaginated.mockReset();
  });

  it('실패하면 loadMoreError를 설정하고 loadingMore를 해제한다', async () => {
    mockGetPaginated
      .mockResolvedValueOnce({
        data: [{ id: 1, type: 'info', title: 't1', message: 'm1', isRead: false, createdAt: '2026-09-24T00:00:00.000Z' }],
        pagination: { page: 1, limit: 30, total: 2, hasMore: true },
      })
      .mockRejectedValueOnce(new Error('network'));

    const { useNotificationStore } = await import('@/stores/notificationStore');
    await useNotificationStore.getState().fetchNotifications();
    await useNotificationStore.getState().loadMore();

    const s = useNotificationStore.getState();
    expect(s.loadMoreError).toBe('불러오지 못했습니다');
    expect(s.loadingMore).toBe(false);
  });

  it('재시도 성공 시 loadMoreError가 풀리고 다음 페이지가 붙는다', async () => {
    mockGetPaginated
      .mockResolvedValueOnce({
        data: [{ id: 1, type: 'info', title: 't1', message: 'm1', isRead: false, createdAt: '2026-09-24T00:00:00.000Z' }],
        pagination: { page: 1, limit: 30, total: 2, hasMore: true },
      })
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({
        data: [{ id: 2, type: 'info', title: 't2', message: 'm2', isRead: false, createdAt: '2026-09-24T01:00:00.000Z' }],
        pagination: { page: 2, limit: 30, total: 2, hasMore: false },
      });

    const { useNotificationStore } = await import('@/stores/notificationStore');
    await useNotificationStore.getState().fetchNotifications();
    await useNotificationStore.getState().loadMore();
    await useNotificationStore.getState().loadMore();

    const s = useNotificationStore.getState();
    expect(s.loadMoreError).toBeNull();
    expect(s.notifications.map((n) => n.id)).toEqual([1, 2]);
    expect(s.hasMore).toBe(false);
  });

  it('hasMore=false면 loadMore를 호출해도 API를 부르지 않는다', async () => {
    const { useNotificationStore } = await import('@/stores/notificationStore');
    await useNotificationStore.getState().loadMore();
    expect(mockGetPaginated).not.toHaveBeenCalled();
  });
});
