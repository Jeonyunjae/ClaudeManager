/**
 * authStore.login / setup / logout / checkAuth(토큰 없음) 단위 테스트.
 * checkAuth의 만료·갱신 분기는 authStore-refresh.test.ts에서 이미 검증했다 — 이 파일은
 * 나머지 액션(로그인·초기 설정·로그아웃)과 "토큰 없음" 분기를 마저 채운다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockPost = vi.fn();
const mockSetToken = vi.fn();
const mockClearToken = vi.fn();

vi.mock('@/lib/api', () => ({
  default: {
    post: mockPost,
    setToken: mockSetToken,
    clearToken: mockClearToken,
  },
}));

const mockConnect = vi.fn();
const mockDisconnect = vi.fn();

vi.mock('@/lib/ws', () => ({
  default: {
    connect: mockConnect,
    disconnect: mockDisconnect,
  },
}));

describe('authStore', () => {
  beforeEach(() => {
    vi.resetModules();
    mockPost.mockReset();
    mockSetToken.mockReset();
    mockClearToken.mockReset();
    mockConnect.mockReset();
    mockDisconnect.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('login', () => {
    it('성공하면 토큰을 저장하고 WS에 연결하며 인증 상태가 된다', async () => {
      mockPost.mockResolvedValue({ data: { token: 'tok-1', expiresAt: '2099-01-01' } });
      const { useAuthStore } = await import('@/stores/authStore');

      await useAuthStore.getState().login('secret');

      expect(mockPost).toHaveBeenCalledWith('/api/auth/login', { password: 'secret' }, true);
      expect(mockSetToken).toHaveBeenCalledWith('tok-1');
      expect(mockConnect).toHaveBeenCalledWith('tok-1');
      const state = useAuthStore.getState();
      expect(state.token).toBe('tok-1');
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('실패하면 에러 메시지를 저장하고 인증 상태를 바꾸지 않는다', async () => {
      mockPost.mockRejectedValue(new Error('bad password'));
      const { useAuthStore } = await import('@/stores/authStore');

      await useAuthStore.getState().login('wrong');

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('bad password');
      expect(mockSetToken).not.toHaveBeenCalled();
    });

    it('Error가 아닌 값으로 실패하면 기본 메시지를 사용한다', async () => {
      mockPost.mockRejectedValue('plain string failure');
      const { useAuthStore } = await import('@/stores/authStore');

      await useAuthStore.getState().login('wrong');

      expect(useAuthStore.getState().error).toBe('Login failed');
    });
  });

  describe('setup', () => {
    it('성공하면 토큰을 저장하고 WS에 연결하며 인증 상태가 된다', async () => {
      mockPost.mockResolvedValue({ data: { token: 'tok-2' } });
      const { useAuthStore } = await import('@/stores/authStore');

      await useAuthStore.getState().setup('secret', 'secret');

      expect(mockPost).toHaveBeenCalledWith(
        '/api/auth/setup',
        { password: 'secret', confirmPassword: 'secret' },
        true
      );
      expect(mockConnect).toHaveBeenCalledWith('tok-2');
      const state = useAuthStore.getState();
      expect(state.token).toBe('tok-2');
      expect(state.isAuthenticated).toBe(true);
    });

    it('실패하면 에러 메시지를 저장한다', async () => {
      mockPost.mockRejectedValue(new Error('mismatch'));
      const { useAuthStore } = await import('@/stores/authStore');

      await useAuthStore.getState().setup('a', 'b');

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBe('mismatch');
    });
  });

  describe('logout', () => {
    it('토큰을 지우고 WS 연결을 끊고 미인증 상태로 되돌린다', async () => {
      mockPost.mockResolvedValue({ data: { token: 'tok-3' } });
      const { useAuthStore } = await import('@/stores/authStore');
      await useAuthStore.getState().login('secret');

      useAuthStore.getState().logout();

      expect(mockClearToken).toHaveBeenCalledTimes(1);
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('checkAuth - 토큰 없음', () => {
    it('localStorage에 토큰이 없으면 hasCheckedAuth만 true로 바뀐다', async () => {
      const store = { getItem: vi.fn(() => null) };
      vi.stubGlobal('window', {});
      vi.stubGlobal('localStorage', store);

      const { useAuthStore } = await import('@/stores/authStore');
      useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.hasCheckedAuth).toBe(true);
      expect(state.isAuthenticated).toBe(false);
      expect(mockConnect).not.toHaveBeenCalled();
    });

    it('window가 없는 환경(SSR)에서는 아무 것도 하지 않는다', async () => {
      vi.stubGlobal('window', undefined);
      const { useAuthStore } = await import('@/stores/authStore');

      useAuthStore.getState().checkAuth();

      expect(useAuthStore.getState().hasCheckedAuth).toBe(false);
    });
  });
});
