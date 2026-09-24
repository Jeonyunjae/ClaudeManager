/**
 * lib/platform.ts 순수 함수 단위 테스트 — iOS·standalone 판정 (DES-006/007 iOS 사실)
 */
import { describe, it, expect } from 'vitest';
import { isIOSUserAgent, isStandaloneDisplay } from '@/lib/platform';

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

describe('isIOSUserAgent', () => {
  it('iPhone UA는 true', () => {
    expect(isIOSUserAgent(IPHONE_UA)).toBe(true);
  });

  it('Android·데스크톱 UA는 false', () => {
    expect(isIOSUserAgent(ANDROID_UA)).toBe(false);
    expect(isIOSUserAgent(DESKTOP_UA)).toBe(false);
  });
});

describe('isStandaloneDisplay', () => {
  it('navigator.standalone === true면 true', () => {
    expect(isStandaloneDisplay({ standalone: true }, false)).toBe(true);
  });

  it('matchMedia(display-mode: standalone)이 true면 true', () => {
    expect(isStandaloneDisplay({ standalone: false }, true)).toBe(true);
    expect(isStandaloneDisplay({}, true)).toBe(true);
  });

  it('둘 다 아니면 false', () => {
    expect(isStandaloneDisplay({ standalone: false }, false)).toBe(false);
    expect(isStandaloneDisplay({}, false)).toBe(false);
  });
});
