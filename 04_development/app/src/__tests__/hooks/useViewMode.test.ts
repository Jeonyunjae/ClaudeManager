/**
 * useViewMode 순수 함수 단위 테스트 — FR-001, FR-002, DES-007 §5
 * (환경이 node이므로 DOM 필요한 훅 자체가 아니라 순수 함수만 검증한다)
 */
import { describe, it, expect } from 'vitest';
import { resolveView, normalizeViewMode } from '@/hooks/useViewMode';

describe('resolveView', () => {
  it('mode=auto: 폭 판정을 그대로 따른다', () => {
    expect(resolveView({ isMobile: true, mode: 'auto' })).toBe(true);
    expect(resolveView({ isMobile: false, mode: 'auto' })).toBe(false);
  });

  it('mode=desktop(ForcedDesktop): 폭이 좁아도 항상 데스크톱', () => {
    expect(resolveView({ isMobile: true, mode: 'desktop' })).toBe(false);
    expect(resolveView({ isMobile: false, mode: 'desktop' })).toBe(false);
  });

  it('mode=mobile: 폭이 넓어도 항상 모바일', () => {
    expect(resolveView({ isMobile: false, mode: 'mobile' })).toBe(true);
    expect(resolveView({ isMobile: true, mode: 'mobile' })).toBe(true);
  });
});

describe('normalizeViewMode', () => {
  it('mobile·desktop은 그대로 통과시킨다', () => {
    expect(normalizeViewMode('mobile')).toBe('mobile');
    expect(normalizeViewMode('desktop')).toBe('desktop');
  });

  it('null·빈 값·알 수 없는 값은 auto로 취급한다', () => {
    expect(normalizeViewMode(null)).toBe('auto');
    expect(normalizeViewMode('')).toBe('auto');
    expect(normalizeViewMode('bogus')).toBe('auto');
  });
});
