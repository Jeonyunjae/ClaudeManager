/**
 * handleUnauthorized 단위 테스트 — NFR-003 / EVT-SH-3
 * API 401 응답 시: 토큰 삭제 + `/login?next={현재경로}` 이동.
 * `/api/auth/*` 경로 자체의 401(로그인 실패 등)은 이 처리를 건너뛴다.
 */
import { describe, it, expect, vi } from 'vitest';
import { handleUnauthorized, type LocationLike, type StorageLike } from '@/lib/api';

function makeLocation(pathname: string, search = ''): LocationLike & { replace: ReturnType<typeof vi.fn> } {
  return {
    pathname,
    search,
    replace: vi.fn((_url: string) => {}),
  };
}

function makeStorage(): StorageLike & { removeItem: ReturnType<typeof vi.fn> } {
  return { removeItem: vi.fn((_key: string) => {}) };
}

describe('handleUnauthorized', () => {
  it('/api/auth/* 요청의 401은 아무 것도 하지 않는다', () => {
    const location = makeLocation('/m/chat');
    const storage = makeStorage();

    handleUnauthorized('/api/auth/login', location, storage);

    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(location.replace).not.toHaveBeenCalled();
  });

  it('일반 API 401은 토큰을 삭제하고 next=현재경로로 로그인 화면으로 이동한다', () => {
    const location = makeLocation('/m/chat/agent-1', '?tab=cli');
    const storage = makeStorage();

    handleUnauthorized('/api/agents/agent-1/conversations', location, storage);

    expect(storage.removeItem).toHaveBeenCalledWith('auth_token');
    expect(location.replace).toHaveBeenCalledWith(
      `/login?next=${encodeURIComponent('/m/chat/agent-1?tab=cli')}`
    );
  });

  it('현재 화면이 이미 /login이면 next 없이 이동한다', () => {
    const location = makeLocation('/login', '?next=%2Fm%2Fchat');
    const storage = makeStorage();

    handleUnauthorized('/api/agents/tree', location, storage);

    expect(storage.removeItem).toHaveBeenCalledWith('auth_token');
    expect(location.replace).toHaveBeenCalledWith('/login');
  });

  it('현재 화면이 이미 /setup이면 next 없이 이동한다', () => {
    const location = makeLocation('/setup');
    const storage = makeStorage();

    handleUnauthorized('/api/agents/tree', location, storage);

    expect(location.replace).toHaveBeenCalledWith('/login');
  });
});
