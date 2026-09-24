/**
 * lib/mobile-format.ts 단위 테스트 — DES-006 상대시각·상태 표시명
 */
import { describe, it, expect } from 'vitest';
import {
  formatRelativeTime,
  agentStatusLabel,
  agentRoleLabel,
  agentInitial,
} from '@/lib/mobile-format';

describe('mobile-format.ts - formatRelativeTime', () => {
  const now = new Date('2026-09-24T12:00:00.000Z');

  it('1분 미만이면 "방금"', () => {
    expect(formatRelativeTime('2026-09-24T11:59:30.000Z', now)).toBe('방금');
  });

  it('n분 전', () => {
    expect(formatRelativeTime('2026-09-24T11:57:00.000Z', now)).toBe('3분 전');
  });

  it('59분 전 (경계)', () => {
    expect(formatRelativeTime('2026-09-24T11:01:00.000Z', now)).toBe('59분 전');
  });

  it('n시간 전', () => {
    expect(formatRelativeTime('2026-09-24T00:00:00.000Z', now)).toBe('12시간 전');
  });

  it('24시간 이상이면 날짜', () => {
    expect(formatRelativeTime('2026-09-20T12:00:00.000Z', now)).toBe('2026.09.20');
  });
});

describe('mobile-format.ts - agentStatusLabel', () => {
  it('DES-009 표시명 매핑', () => {
    expect(agentStatusLabel('active')).toBe('작업 중');
    expect(agentStatusLabel('idle')).toBe('대기');
    expect(agentStatusLabel('pending')).toBe('보류');
    expect(agentStatusLabel('error')).toBe('오류');
    expect(agentStatusLabel('stopped')).toBe('정지');
    expect(agentStatusLabel('retrying')).toBe('재시도 중');
  });

  it('알 수 없는 값은 그대로 반환', () => {
    expect(agentStatusLabel('unknown')).toBe('unknown');
  });
});

describe('mobile-format.ts - agentRoleLabel', () => {
  it('DES-009 역할 표시명 매핑', () => {
    expect(agentRoleLabel('main')).toBe('Main');
    expect(agentRoleLabel('sub')).toBe('Sub');
    expect(agentRoleLabel('part')).toBe('Part');
    expect(agentRoleLabel('instance')).toBe('Instance');
  });
});

describe('mobile-format.ts - agentInitial', () => {
  it('이름의 첫 글자를 대문자로 반환', () => {
    expect(agentInitial('ClaudeManagerMobile')).toBe('C');
    expect(agentInitial('main')).toBe('M');
  });

  it('빈 문자열은 물음표', () => {
    expect(agentInitial('')).toBe('?');
    expect(agentInitial('   ')).toBe('?');
  });
});
