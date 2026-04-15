'use client';

import { create } from 'zustand';
import type { Notification } from '@/types/notification';
import apiClient from '@/lib/api';

type NotificationState = {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  fetchNotifications: (unreadOnly?: boolean) => Promise<void>;
  markRead: (ids: number[]) => Promise<void>;
  markAllRead: () => Promise<void>;
  addNotification: (notification: Notification) => void;
};

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async (unreadOnly = false) => {
    set({ isLoading: true });
    try {
      const url = unreadOnly
        ? '/api/notifications?unread=true'
        : '/api/notifications';
      const res = await apiClient.getPaginated<Notification>(url);
      const unreadCount = res.data.filter((n) => !n.isRead).length;
      set({ notifications: res.data, unreadCount, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  markRead: async (ids) => {
    await apiClient.post('/api/notifications/mark-read', { ids });
    set((state) => ({
      notifications: state.notifications.map((n) =>
        ids.includes(n.id) ? { ...n, isRead: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - ids.length),
    }));
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
}));
