/**
 * @vitest-environment jsdom
 *
 * lib/platform.ts의 브라우저 전역 래퍼(isIOS·isStandalone) 단위 테스트 — FR-003·FR-010, DES-006/007.
 * 순수 함수(isIOSUserAgent·isStandaloneDisplay)는 platform.test.ts(node 환경)에서 이미 검증했다.
 * 이 파일은 jsdom 환경에서 실제 navigator·window를 통해 얇은 래퍼 자체를 검증한다.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { isIOS, isStandalone } from '@/lib/platform';

describe('isIOS (브라우저 래퍼)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('iPhone UA면 true', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15',
    });
    expect(isIOS()).toBe(true);
  });

  it('Android UA면 false', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)' });
    expect(isIOS()).toBe(false);
  });
});

describe('isStandalone (브라우저 래퍼)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('navigator.standalone === true면 true', () => {
    vi.stubGlobal('navigator', { standalone: true });
    vi.stubGlobal('window', { matchMedia: undefined });
    expect(isStandalone()).toBe(true);
  });

  it('matchMedia(display-mode: standalone)이 matches:true면 true', () => {
    const matchMedia = vi.fn(() => ({ matches: true }));
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('window', { matchMedia });
    expect(isStandalone()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith('(display-mode: standalone)');
  });

  it('matchMedia가 없으면(구형 브라우저) false로 취급한다', () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('window', { matchMedia: undefined });
    expect(isStandalone()).toBe(false);
  });

  it('둘 다 아니면 false', () => {
    vi.stubGlobal('navigator', { standalone: false });
    vi.stubGlobal('window', { matchMedia: vi.fn(() => ({ matches: false })) });
    expect(isStandalone()).toBe(false);
  });
});
