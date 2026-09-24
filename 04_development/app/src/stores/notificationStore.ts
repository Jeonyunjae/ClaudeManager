'use client';

import { create } from 'zustand';
import type { Notification } from '@/types/notification';
import apiClient from '@/lib/api';

/** SCR-M03 목록 페이지 크기 (DES-006 §SCR-M03, EVT-M03-7) */
export const NOTIFICATIONS_PAGE_SIZE = 30;

type NotificationState = {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  loadingMore: boolean;
  error: string | null;
  /** DF-011: EVT-M03-7 추가 로딩 실패 — 목록 끝 "다시 시도" */
  loadMoreError: string | null;
  page: number;
  hasMore: boolean;
  fetchNotifications: (unreadOnly?: boolean) => Promise<void>;
  /** EVT-M03-7: 목록 끝 스크롤 -> 다음 30건 */
  loadMore: () => Promise<void>;
  markRead: (ids: number[]) => Promise<void>;
  markAllRead: () => Promise<void>;
  addNotification: (notification: Notification) => void;
  /** WS `notification:read` 반영 — 다른 기기에서 읽음 처리된 것을 배지에 맞춘다 */
  applyRead: (ids: (number | string)[] | 'all') => void;
};

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  loadingMore: false,
  error: null,
  loadMoreError: null,
  page: 1,
  hasMore: false,

  fetchNotifications: async (unreadOnly = false) => {
    set({ isLoading: true, error: null, loadMoreError: null });
    try {
      const url = unreadOnly
        ? `/api/notifications?unread=true&page=1&limit=${NOTIFICATIONS_PAGE_SIZE}`
        : `/api/notifications?page=1&limit=${NOTIFICATIONS_PAGE_SIZE}`;
      // BUG-005: 배지는 서버가 전체 기준으로 계산한 unreadCount를 쓴다 — 이 페이지(최대 30건)
      // 안에서 필터링하면 30건 밖에 있는 안 읽은 알림이 배지에서 누락된다.
      const res = (await apiClient.getPaginated<Notification>(url)) as { data: Notification[]; pagination: { hasMore: boolean }; unreadCount?: number };
      const unreadCount = Number(res.unreadCount ?? 0);
      set({
        notifications: res.data,
        unreadCount,
        isLoading: false,
        page: 1,
        hasMore: res.pagination.hasMore,
        loadMoreError: null,
      });
    } catch {
      set({ isLoading: false, error: '불러오지 못했습니다' });
    }
  },

  loadMore: async () => {
    const { hasMore, loadingMore, page } = get();
    if (!hasMore || loadingMore) return;

    set({ loadingMore: true, loadMoreError: null });
    try {
      const nextPage = page + 1;
      const res = await apiClient.getPaginated<Notification>(
        `/api/notifications?page=${nextPage}&limit=${NOTIFICATIONS_PAGE_SIZE}`
      );
      set((state) => ({
        notifications: [...state.notifications, ...res.data],
        page: nextPage,
        hasMore: res.pagination.hasMore,
        loadingMore: false,
        loadMoreError: null,
      }));
    } catch {
      // DF-011: 목록 끝 "다시 시도" — loadMoreError가 남아 있는 동안은 스크롤이 자동 재시도하지 않는다.
      set({ loadingMore: false, loadMoreError: '불러오지 못했습니다' });
    }
  },

  markRead: async (ids) => {
    await apiClient.post('/api/notifications/mark-read', { ids });
    set((state) => {
      // BUG-005: unreadCount는 서버 기준값에서 시작하므로, 로드된 목록만으로 다시 세면(필터)
      // 30건 밖의 안 읽은 알림이 사라진 것처럼 보인다 — 이번에 실제로 읽음 처리된 건수만큼만 뺀다.
      let decremented = 0;
      const notifications = state.notifications.map((n) => {
        if (ids.includes(n.id) && !n.isRead) decremented += 1;
        return ids.includes(n.id) ? { ...n, isRead: true } : n;
      });
      return { notifications, unreadCount: Math.max(0, state.unreadCount - decremented) };
    });
  },

  markAllRead: async () => {
    await apiClient.post('/api/notifications/mark-read', { ids: [] });
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));
  },

  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },

  applyRead: (ids) => {
    set((state) => {
      if (ids === 'all') {
        return {
          notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
          unreadCount: 0,
        };
      }
      // BUG-005: 목록 필터가 아니라 실제로 상태가 바뀐 건수만큼만 unreadCount를 줄인다
      // (근거는 markRead와 동일 — 서버 기준 unreadCount가 로드된 목록보다 클 수 있다).
      const idSet = new Set(ids.map(String));
      let decremented = 0;
      const notifications = state.notifications.map((n) => {
        if (idSet.has(String(n.id)) && !n.isRead) decremented += 1;
        return idSet.has(String(n.id)) ? { ...n, isRead: true } : n;
      });
      return { notifications, unreadCount: Math.max(0, state.unreadCount - decremented) };
    });
  },
}));
