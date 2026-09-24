/**
 * safeNextPath 단위 테스트 — NFR-003 Open Redirect 방지
 * 로그인 후 복귀 경로(`next`)는 같은 출처의 상대 경로만 허용한다.
 */
import { describe, it, expect } from 'vitest';
import { safeNextPath } from '@/lib/safe-next';

describe('safeNextPath', () => {
  it('같은 출처 상대 경로는 그대로 허용한다', () => {
    expect(safeNextPath('/m/chat')).toBe('/m/chat');
    expect(safeNextPath('/dashboard')).toBe('/dashboard');
    expect(safeNextPath('/m/chat/agent-1?tab=cli')).toBe('/m/chat/agent-1?tab=cli');
  });

  it('프로토콜 없는 외부 절대 URL(//evil.com)은 거부한다', () => {
    expect(safeNextPath('//evil.com')).toBeNull();
    expect(safeNextPath('//evil.com/phish')).toBeNull();
  });

  it('스킴이 있는 절대 URL은 거부한다', () => {
    expect(safeNextPath('https://evil.com')).toBeNull();
    expect(safeNextPath('http://evil.com')).toBeNull();
  });

  it('javascript: 스킴은 거부한다', () => {
    expect(safeNextPath('javascript:alert(1)')).toBeNull();
  });

  it('빈 값·null·undefined는 null을 반환한다', () => {
    expect(safeNextPath('')).toBeNull();
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
  });

  it('/로 시작하지 않는 상대 경로는 거부한다', () => {
    expect(safeNextPath('m/chat')).toBeNull();
  });
});
