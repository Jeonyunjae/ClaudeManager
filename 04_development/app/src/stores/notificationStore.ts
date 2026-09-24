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
  page: 1,
  hasMore: false,

  fetchNotifications: async (unreadOnly = false) => {
    set({ isLoading: true, error: null });
    try {
      const url = unreadOnly
        ? `/api/notifications?unread=true&page=1&limit=${NOTIFICATIONS_PAGE_SIZE}`
        : `/api/notifications?page=1&limit=${NOTIFICATIONS_PAGE_SIZE}`;
      const res = await apiClient.getPaginated<Notification>(url);
      const unreadCount = res.data.filter((n) => !n.isRead).length;
      set({
        notifications: res.data,
        unreadCount,
        isLoading: false,
        page: 1,
        hasMore: res.pagination.hasMore,
      });
    } catch {
      set({ isLoading: false, error: '불러오지 못했습니다' });
    }
  },

  loadMore: async () => {
    const { hasMore, loadingMore, page } = get();
    if (!hasMore || loadingMore) return;

    set({ loadingMore: true });
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
      }));
    } catch {
      set({ loadingMore: false });
    }
  },

  markRead: async (ids) => {
    await apiClient.post('/api/notifications/mark-read', { ids });
    set((state) => {
      const notifications = state.notifications.map((n) =>
        ids.includes(n.id) ? { ...n, isRead: true } : n
      );
      return { notifications, unreadCount: notifications.filter((n) => !n.isRead).length };
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
      let notifications: Notification[];
      if (ids === 'all') {
        notifications = state.notifications.map((n) => ({ ...n, isRead: true }));
      } else {
        const idSet = new Set(ids.map(String));
        notifications = state.notifications.map((n) =>
          idSet.has(String(n.id)) ? { ...n, isRead: true } : n
        );
      }
      return { notifications, unreadCount: notifications.filter((n) => !n.isRead).length };
    });
  },
}));
