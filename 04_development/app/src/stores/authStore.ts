'use client';

import { create } from 'zustand';
import apiClient from '@/lib/api';
import wsClient from '@/lib/ws';

type AuthState = {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /**
   * checkAuth()가 localStorage를 한 번이라도 읽었는지.
   * 이 값이 false인 동안은 "미인증"이 아니라 "아직 모름"이므로
   * 리다이렉트 판단을 해서는 안 된다. (새로고침 시 /login 으로 튕기던 원인)
   */
  hasCheckedAuth: boolean;
  error: string | null;
  login: (password: string) => Promise<void>;
  setup: (password: string, confirmPassword: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  isAuthenticated: false,
  isLoading: false,
  hasCheckedAuth: false,
  error: null,

  login: async (password: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.post<{ token: string; expiresAt: string }>(
        '/api/auth/login',
        { password },
        true
      );
      const token = res.data.token;
      apiClient.setToken(token);
      wsClient.connect(token);
      set({ token, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Login failed',
      });
    }
  },

  setup: async (password: string, confirmPassword: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.post<{ token: string }>(
        '/api/auth/setup',
        { password, confirmPassword },
        true
      );
      const token = res.data.token;
      apiClient.setToken(token);
      wsClient.connect(token);
      set({ token, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Setup failed',
      });
    }
  },

  logout: () => {
    apiClient.clearToken();
    wsClient.disconnect();
    set({ token: null, isAuthenticated: false });
  },

  checkAuth: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('auth_token');
    if (token) {
      wsClient.connect(token);
      set({ token, isAuthenticated: true, hasCheckedAuth: true });
      return;
    }
    set({ hasCheckedAuth: true });
  },
}));
