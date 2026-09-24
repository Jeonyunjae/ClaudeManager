'use client';

import { create } from 'zustand';
import apiClient from '@/lib/api';
import wsClient from '@/lib/ws';
import { decodeJwtExp, getRemainingDays } from '@/lib/jwt-exp';
import { TOKEN_REFRESH_THRESHOLD_DAYS } from '@/lib/constants';

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
    if (!token) {
      set({ hasCheckedAuth: true });
      return;
    }

    // 서명 검증 없이 exp만 본다 — 만료 여부/임박 여부 판단용 (NFR-003).
    // 디코드 실패(형식이 아니거나 exp 없음)는 기존 동작(그대로 인증 처리)을 유지한다.
    const exp = decodeJwtExp(token);

    if (exp !== null && getRemainingDays(exp) < 0) {
      // 이미 만료됨 — 토큰 삭제, 미인증 처리
      apiClient.clearToken();
      set({ token: null, isAuthenticated: false, hasCheckedAuth: true });
      return;
    }

    wsClient.connect(token);
    set({ token, isAuthenticated: true, hasCheckedAuth: true });

    if (exp !== null && getRemainingDays(exp) <= TOKEN_REFRESH_THRESHOLD_DAYS) {
      void refreshTokenIfNearExpiry(set);
    }
  },
}));

/**
 * 만료 임박(≤ TOKEN_REFRESH_THRESHOLD_DAYS) 시 새 토큰을 받아 교체한다 (NFR-003).
 * 실패하면 기존 토큰을 그대로 두고 다음 앱 진입에서 재시도한다.
 */
async function refreshTokenIfNearExpiry(set: (partial: Partial<AuthState>) => void): Promise<void> {
  try {
    const res = await apiClient.post<{ token: string }>('/api/auth/refresh');
    const newToken = res.data.token;
    apiClient.setToken(newToken);
    wsClient.connect(newToken);
    set({ token: newToken });
  } catch {
    // 실패 시 기존 토큰 유지 — 다음 진입에서 재시도
  }
}
