/**
 * authStore.checkAuth() 단위 테스트 — NFR-003 (만료 임박 갱신), DES-007 §3
 *
 * 상태 흐름:
 *   Valid --(진입 시 남은 기간 ≤2일)--> NearExpiry --(refresh 성공)--> Valid
 *   NearExpiry --(refresh 실패)--> NearExpiry (토큰 유지, 다음 진입 재시도)
 *   (모든 상태) --(exp < now)--> NoToken (토큰 삭제)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockPost = vi.fn();
const mockSetToken = vi.fn();
const mockClearToken = vi.fn();
const mockGetToken = vi.fn();

vi.mock('@/lib/api', () => ({
  default: {
    post: mockPost,
    setToken: mockSetToken,
    clearToken: mockClearToken,
    getToken: mockGetToken,
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

function base64url(json: unknown): string {
  const base64 = Buffer.from(JSON.stringify(json)).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeToken(expSeconds: number): string {
  const header = base64url({ alg: 'HS256', typ: 'JWT' });
  const payload = base64url({ exp: expSeconds, sub: 'admin' });
  return `${header}.${payload}.fakesignature`;
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('authStore.checkAuth', () => {
  const store: {
    getItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
  } = {
    getItem: vi.fn(),
    removeItem: vi.fn(),
    setItem: vi.fn(),
  };

  beforeEach(() => {
    vi.resetModules();
    mockPost.mockReset();
    mockSetToken.mockReset();
    mockClearToken.mockReset();
    mockConnect.mockReset();
    mockDisconnect.mockReset();
    store.getItem.mockReset();
    store.removeItem.mockReset();
    store.setItem.mockReset();

    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('유효 기간이 넉넉하면 refresh를 호출하지 않는다', async () => {
    const token = makeToken(Math.floor(Date.now() / 1000) + 10 * 24 * 60 * 60); // 10일 뒤
    store.getItem.mockReturnValue(token);

    const { useAuthStore } = await import('@/stores/authStore');
    useAuthStore.getState().checkAuth();
    await flushMicrotasks();

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().token).toBe(token);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('남은 기간이 2일 이하면 refresh를 호출하고 성공 시 토큰을 교체한다', async () => {
    const token = makeToken(Math.floor(Date.now() / 1000) + 1 * 24 * 60 * 60); // 1일 뒤
    const newToken = makeToken(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60);
    store.getItem.mockReturnValue(token);
    mockPost.mockResolvedValue({ data: { token: newToken } });

    const { useAuthStore } = await import('@/stores/authStore');
    useAuthStore.getState().checkAuth();
    await flushMicrotasks();

    expect(mockPost).toHaveBeenCalledWith('/api/auth/refresh');
    expect(mockSetToken).toHaveBeenCalledWith(newToken);
    expect(mockConnect).toHaveBeenCalledWith(newToken);
    expect(useAuthStore.getState().token).toBe(newToken);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('refresh 실패 시 기존 토큰을 유지한다', async () => {
    const token = makeToken(Math.floor(Date.now() / 1000) + 1 * 24 * 60 * 60);
    store.getItem.mockReturnValue(token);
    mockPost.mockRejectedValue(new Error('network error'));

    const { useAuthStore } = await import('@/stores/authStore');
    useAuthStore.getState().checkAuth();
    await flushMicrotasks();

    expect(mockPost).toHaveBeenCalledWith('/api/auth/refresh');
    expect(useAuthStore.getState().token).toBe(token);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(mockClearToken).not.toHaveBeenCalled();
  });

  it('이미 만료된 토큰이면 삭제하고 미인증 처리한다', async () => {
    const token = makeToken(Math.floor(Date.now() / 1000) - 60); // 60초 전 만료
    store.getItem.mockReturnValue(token);

    const { useAuthStore } = await import('@/stores/authStore');
    useAuthStore.getState().checkAuth();
    await flushMicrotasks();

    expect(mockClearToken).toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().token).toBe(null);
  });

  it('디코드에 실패하는 토큰은 기존 동작(그대로 인증)을 유지한다', async () => {
    store.getItem.mockReturnValue('not-a-jwt');

    const { useAuthStore } = await import('@/stores/authStore');
    useAuthStore.getState().checkAuth();
    await flushMicrotasks();

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().token).toBe('not-a-jwt');
    expect(mockPost).not.toHaveBeenCalled();
  });
});
