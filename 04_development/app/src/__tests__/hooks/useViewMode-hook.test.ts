/**
 * @vitest-environment jsdom
 *
 * hooks/useViewMode.ts의 useViewMode() 훅 자체 단위 테스트 — FR-001, FR-002, DES-007 §5.
 * 순수 함수(resolveView·normalizeViewMode)는 useViewMode.test.ts(node 환경)에서 이미 검증했다.
 * 이 파일은 sessionStorage 초기화 읽기·setViewMode 저장/삭제를 jsdom에서 검증한다.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useViewMode, VIEW_MODE_STORAGE_KEY } from '@/hooks/useViewMode';

// 이 스위트에서는 useIsMobile(matchMedia)이 항상 false(데스크톱 폭)를 주도록 고정한다.
function stubMatchMedia(matches: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

describe('useViewMode', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    stubMatchMedia(false);
  });

  it('sessionStorage에 저장된 값이 없으면 auto로 시작하고 폭 판정을 따른다', () => {
    const { result } = renderHook(() => useViewMode());
    expect(result.current.mode).toBe('auto');
    expect(result.current.shouldUseMobile).toBe(false);
  });

  it('sessionStorage에 mobile이 저장돼 있으면 그 값으로 시작한다', () => {
    window.sessionStorage.setItem(VIEW_MODE_STORAGE_KEY, 'mobile');
    const { result } = renderHook(() => useViewMode());
    expect(result.current.mode).toBe('mobile');
    expect(result.current.shouldUseMobile).toBe(true);
  });

  it('sessionStorage에 알 수 없는 값이 저장돼 있으면 auto로 취급한다', () => {
    window.sessionStorage.setItem(VIEW_MODE_STORAGE_KEY, 'bogus');
    const { result } = renderHook(() => useViewMode());
    expect(result.current.mode).toBe('auto');
  });

  it('setViewMode(mobile)은 sessionStorage에 저장하고 상태를 갱신한다', () => {
    const { result } = renderHook(() => useViewMode());

    act(() => {
      result.current.setViewMode('mobile');
    });

    expect(result.current.mode).toBe('mobile');
    expect(result.current.shouldUseMobile).toBe(true);
    expect(window.sessionStorage.getItem(VIEW_MODE_STORAGE_KEY)).toBe('mobile');
  });

  it('setViewMode(auto)는 sessionStorage 항목을 삭제한다', () => {
    window.sessionStorage.setItem(VIEW_MODE_STORAGE_KEY, 'desktop');
    const { result } = renderHook(() => useViewMode());

    act(() => {
      result.current.setViewMode('auto');
    });

    expect(result.current.mode).toBe('auto');
    expect(window.sessionStorage.getItem(VIEW_MODE_STORAGE_KEY)).toBeNull();
  });

  it('mode=desktop이면 폭이 좁아도(matchMedia matches:true) 항상 데스크톱이다', () => {
    stubMatchMedia(true);
    window.sessionStorage.setItem(VIEW_MODE_STORAGE_KEY, 'desktop');
    const { result } = renderHook(() => useViewMode());
    expect(result.current.shouldUseMobile).toBe(false);
  });
});
