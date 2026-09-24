/**
 * notificationStore 액션 단위 테스트 — F028~F031.
 * 기존 notificationStore.test.ts는 스토어 밖에서 같은 배열 로직을 손으로 재현했을 뿐 실제
 * 액션(store.markRead 등)을 호출하지 않는다. loadMore·fetchNotifications(실패)는
 * notificationStore-loadMore.test.ts에서 검증했으므로, 이 파일은 나머지 액션과
 * fetchNotifications 성공 경로를 실제로 호출해 검증한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Notification } from '@/types/notification';

const mockGetPaginated = vi.fn();
const mockPost = vi.fn();

vi.mock('@/lib/api', () => ({
  default: {
    getPaginated: mockGetPaginated,
    post: mockPost,
  },
}));

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 1,
    type: 'info',
    title: 't',
    message: 'm',
    isRead: false,
    createdAt: '2026-09-24T00:00:00.000Z',
    ...overrides,
  };
}

describe('notificationStore actions', () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetPaginated.mockReset();
    mockPost.mockReset();
  });

  it('fetchNotifications 성공 시 목록·unreadCount·hasMore를 채운다', async () => {
    // BUG-005: unreadCount는 서버가 내려주는 값을 그대로 쓴다 (이 목록 안에서 다시 세지 않는다).
    mockGetPaginated.mockResolvedValue({
      data: [makeNotification({ id: 1, isRead: false }), makeNotification({ id: 2, isRead: true })],
      pagination: { page: 1, limit: 30, total: 2, hasMore: true },
      unreadCount: 1,
    });

    const { useNotificationStore } = await import('@/stores/notificationStore');
    await useNotificationStore.getState().fetchNotifications();

    const state = useNotificationStore.getState();
    expect(state.notifications).toHaveLength(2);
    expect(state.unreadCount).toBe(1);
    expect(state.hasMore).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('fetchNotifications(unreadOnly=true)는 unread 쿼리 파라미터를 붙인다', async () => {
    mockGetPaginated.mockResolvedValue({ data: [], pagination: { page: 1, limit: 30, total: 0, hasMore: false }, unreadCount: 0 });
    const { useNotificationStore } = await import('@/stores/notificationStore');

    await useNotificationStore.getState().fetchNotifications(true);

    expect(mockGetPaginated).toHaveBeenCalledWith(
      expect.stringContaining('unread=true')
    );
  });

  it('fetchNotifications 실패 시 error를 설정한다', async () => {
    mockGetPaginated.mockRejectedValue(new Error('network'));
    const { useNotificationStore } = await import('@/stores/notificationStore');

    await useNotificationStore.getState().fetchNotifications();

    const state = useNotificationStore.getState();
    expect(state.error).toBe('불러오지 못했습니다');
    expect(state.isLoading).toBe(false);
  });

  it('markRead는 서버에 POST하고 대상 알림만 읽음 처리한다', async () => {
    mockGetPaginated.mockResolvedValue({
      data: [makeNotification({ id: 1, isRead: false }), makeNotification({ id: 2, isRead: false })],
      pagination: { page: 1, limit: 30, total: 2, hasMore: false },
      unreadCount: 2,
    });
    mockPost.mockResolvedValue({ data: {} });

    const { useNotificationStore } = await import('@/stores/notificationStore');
    await useNotificationStore.getState().fetchNotifications();
    await useNotificationStore.getState().markRead([1]);

    expect(mockPost).toHaveBeenCalledWith('/api/notifications/mark-read', { ids: [1] });
    const state = useNotificationStore.getState();
    expect(state.notifications.find((n) => n.id === 1)?.isRead).toBe(true);
    expect(state.notifications.find((n) => n.id === 2)?.isRead).toBe(false);
    expect(state.unreadCount).toBe(1);
  });

  it('markAllRead는 모든 알림을 읽음 처리하고 unreadCount를 0으로 만든다', async () => {
    mockGetPaginated.mockResolvedValue({
      data: [makeNotification({ id: 1, isRead: false }), makeNotification({ id: 2, isRead: false })],
      pagination: { page: 1, limit: 30, total: 2, hasMore: false },
      unreadCount: 2,
    });
    mockPost.mockResolvedValue({ data: {} });

    const { useNotificationStore } = await import('@/stores/notificationStore');
    await useNotificationStore.getState().fetchNotifications();
    await useNotificationStore.getState().markAllRead();

    expect(mockPost).toHaveBeenCalledWith('/api/notifications/mark-read', { ids: [] });
    const state = useNotificationStore.getState();
    expect(state.unreadCount).toBe(0);
    expect(state.notifications.every((n) => n.isRead)).toBe(true);
  });

  it('addNotification은 새 알림을 맨 앞에 추가하고 unreadCount를 늘린다', async () => {
    const { useNotificationStore } = await import('@/stores/notificationStore');

    useNotificationStore.getState().addNotification(makeNotification({ id: 99 }));

    const state = useNotificationStore.getState();
    expect(state.notifications[0].id).toBe(99);
    expect(state.unreadCount).toBe(1);
  });

  describe('applyRead', () => {
    it("'all'이면 전체를 읽음 처리한다", async () => {
      const { useNotificationStore } = await import('@/stores/notificationStore');
      useNotificationStore.getState().addNotification(makeNotification({ id: 1 }));
      useNotificationStore.getState().addNotification(makeNotification({ id: 2 }));

      useNotificationStore.getState().applyRead('all');

      const state = useNotificationStore.getState();
      expect(state.notifications.every((n) => n.isRead)).toBe(true);
      expect(state.unreadCount).toBe(0);
    });

    it('id 배열을 넘기면 해당 id만(문자/숫자 혼용 포함) 읽음 처리한다', async () => {
      const { useNotificationStore } = await import('@/stores/notificationStore');
      useNotificationStore.getState().addNotification(makeNotification({ id: 1 }));
      useNotificationStore.getState().addNotification(makeNotification({ id: 2 }));

      useNotificationStore.getState().applyRead(['1']);

      const state = useNotificationStore.getState();
      expect(state.notifications.find((n) => n.id === 1)?.isRead).toBe(true);
      expect(state.notifications.find((n) => n.id === 2)?.isRead).toBe(false);
      expect(state.unreadCount).toBe(1);
    });
  });

  // BUG-005: 서버 unreadCount(45)가 로드된 페이지(30건) 안의 안 읽은 건수(20)보다 클 때
  // 배지가 30건 목록 기준으로 깎이면 안 된다.
  describe('BUG-005 — 배지는 서버 unreadCount 기준, 30건 목록 기준이 아니다', () => {
    it('로드된 목록의 unread 건수보다 서버 unreadCount가 크면 그 값을 그대로 쓴다', async () => {
      mockGetPaginated.mockResolvedValue({
        data: [makeNotification({ id: 1, isRead: false }), makeNotification({ id: 2, isRead: true })],
        pagination: { page: 1, limit: 30, total: 45, hasMore: true },
        unreadCount: 45, // 목록 안에서 필터링하면 1이지만, 서버 전체 기준은 45
      });

      const { useNotificationStore } = await import('@/stores/notificationStore');
      await useNotificationStore.getState().fetchNotifications();

      expect(useNotificationStore.getState().unreadCount).toBe(45);
    });

    it('markRead 이후에도 목록 필터가 아니라 실제로 읽음 처리된 건수만큼만 unreadCount를 줄인다', async () => {
      mockGetPaginated.mockResolvedValue({
        data: [makeNotification({ id: 1, isRead: false }), makeNotification({ id: 2, isRead: true })],
        pagination: { page: 1, limit: 30, total: 45, hasMore: true },
        unreadCount: 45,
      });
      mockPost.mockResolvedValue({ data: {} });

      const { useNotificationStore } = await import('@/stores/notificationStore');
      await useNotificationStore.getState().fetchNotifications();
      await useNotificationStore.getState().markRead([1]);

      // 45에서 이번에 읽음 처리된 1건만 빠져야 한다 (목록 기준 필터링이었다면 0으로 떨어졌을 것)
      expect(useNotificationStore.getState().unreadCount).toBe(44);
    });
  });
});
