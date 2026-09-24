/**
 * lib/desktop-nav.ts 단위 테스트 — BUG-002 (NFR-001).
 * 데스크톱 TopNav 알림 클릭 시 모바일 전용 경로(/m/...)로는 이동하지 않아야 한다.
 */
import { describe, it, expect } from 'vitest';
import { desktopTargetFor } from '@/lib/desktop-nav';

describe('desktopTargetFor (BUG-002)', () => {
  it('/m/으로 시작하는 targetUrl은 이동하지 않는다 (null)', () => {
    expect(desktopTargetFor('/m/chat/agent-1')).toBeNull();
    expect(desktopTargetFor('/m/notifications')).toBeNull();
    expect(desktopTargetFor('/m/status')).toBeNull();
  });

  it('/m/으로 시작하지 않는 targetUrl은 그대로 반환한다 (기존 데스크톱 동작)', () => {
    expect(desktopTargetFor('/dashboard')).toBe('/dashboard');
    expect(desktopTargetFor('/resources')).toBe('/resources');
  });

  it('targetUrl이 없으면 null을 반환한다', () => {
    expect(desktopTargetFor(undefined)).toBeNull();
    expect(desktopTargetFor(null)).toBeNull();
    expect(desktopTargetFor('')).toBeNull();
  });

  it("'/m'만 있고 슬래시가 없는 경로는 /m/ 접두사가 아니므로 그대로 반환한다", () => {
    expect(desktopTargetFor('/mission-control')).toBe('/mission-control');
  });
});
