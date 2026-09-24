/**
 * iOS / 설치(standalone) 판정 유틸 — FR-003·FR-010, DES-006/007 iOS 사실.
 *
 * 판정 로직은 순수 함수로 분리해 DOM 없이 단위 테스트할 수 있게 한다.
 * 훅·컴포넌트에서 쓰는 `isIOS()`·`isStandalone()`는 브라우저 전역을 읽어 순수 함수에 넘기는 얇은 래퍼다.
 */

/** User-Agent 문자열로 iPhone·iPad·iPod 판정 (iPadOS 13+의 데스크톱 UA 위장은 다루지 않는다 — Phase 1 범위 밖). */
export function isIOSUserAgent(userAgent: string): boolean {
  return /iphone|ipad|ipod/i.test(userAgent);
}

/** `navigator.standalone`(iOS Safari 고유) 또는 `matchMedia('(display-mode: standalone)')`로 설치 여부 판정. */
export function isStandaloneDisplay(
  navigatorLike: { standalone?: boolean },
  mediaMatches: boolean
): boolean {
  return navigatorLike.standalone === true || mediaMatches === true;
}

/** 실제 브라우저 환경에서 iOS 여부를 판정한다. SSR(window 없음)에서는 false. */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return isIOSUserAgent(navigator.userAgent);
}

/** 실제 브라우저 환경에서 standalone(홈 화면 설치 앱) 여부를 판정한다. SSR에서는 false. */
export function isStandalone(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  const mediaMatches = window.matchMedia
    ? window.matchMedia('(display-mode: standalone)').matches
    : false;
  return isStandaloneDisplay(nav, mediaMatches);
}
