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

  // SEC-001: %-인코딩된 백슬래시·제어문자로 감춘 오픈 리다이렉트 우회
  it('%-인코딩된 백슬래시(/%5Cevil.com, 디코드하면 /\\evil.com)는 거부한다', () => {
    expect(safeNextPath('/%5Cevil.com')).toBeNull();
  });

  it('원문에 리터럴 탭 문자가 섞인 경로(/\\tevil)는 거부한다', () => {
    expect(safeNextPath('/\tevil')).toBeNull();
  });

  it('%-인코딩된 탭(/%09/evil.com, 디코드하면 /<TAB>/evil.com)은 거부한다', () => {
    expect(safeNextPath('/%09/evil.com')).toBeNull();
  });

  it('query·hash가 있는 정상 상대 경로는 pathname+search+hash 그대로 반환한다', () => {
    expect(safeNextPath('/m/chat?x=1#h')).toBe('/m/chat?x=1#h');
  });

  it('잘못된 %-인코딩(URIError)이면 거부한다', () => {
    expect(safeNextPath('/m/chat?query=100%')).toBeNull();
  });
});
