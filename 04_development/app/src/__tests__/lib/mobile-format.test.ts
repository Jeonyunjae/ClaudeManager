/**
 * lib/mobile-format.ts 단위 테스트 — DES-006 상대시각·상태 표시명
 */
import { describe, it, expect } from 'vitest';
import {
  formatRelativeTime,
  agentStatusLabel,
  agentRoleLabel,
  agentInitial,
  parseFlexibleTimestamp,
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

// BUG-004: Postgres `now()::text` 형식(공백 구분자·마이크로초·`+HH`/`+HH:MM` 오프셋)을
// iOS Safari에서도 Invalid Date("NaN")가 아니라 정상 파싱해야 한다.
describe('mobile-format.ts - parseFlexibleTimestamp (BUG-004)', () => {
  it('공백 구분자 + 마이크로초 6자리 + +00 오프셋(전형적인 Postgres UTC 출력)', () => {
    const ms = parseFlexibleTimestamp('2026-09-24 01:33:54.123456+00');
    expect(ms).not.toBeNull();
    expect(new Date(ms as number).toISOString()).toBe('2026-09-24T01:33:54.123Z');
  });

  it('시만 있는 타임존 오프셋(+09)을 +09:00으로 보정한다', () => {
    const ms = parseFlexibleTimestamp('2026-09-24 10:33:54+09');
    expect(ms).not.toBeNull();
    expect(new Date(ms as number).toISOString()).toBe('2026-09-24T01:33:54.000Z');
  });

  it('시:분 오프셋(+09:30)을 그대로 반영한다', () => {
    const ms = parseFlexibleTimestamp('2026-09-24 11:03:54+09:30');
    expect(ms).not.toBeNull();
    expect(new Date(ms as number).toISOString()).toBe('2026-09-24T01:33:54.000Z');
  });

  it('오프셋이 없으면 UTC로 가정한다', () => {
    const ms = parseFlexibleTimestamp('2026-09-24 01:33:54');
    expect(ms).not.toBeNull();
    expect(new Date(ms as number).toISOString()).toBe('2026-09-24T01:33:54.000Z');
  });

  it('표준 ISO(T 구분자, Z)는 그대로 정상 파싱된다', () => {
    const ms = parseFlexibleTimestamp('2026-09-24T01:33:54.000Z');
    expect(ms).not.toBeNull();
    expect(new Date(ms as number).toISOString()).toBe('2026-09-24T01:33:54.000Z');
  });

  it('파싱 불가능한 값은 null을 반환한다 (NaN 표시 금지)', () => {
    expect(parseFlexibleTimestamp('not-a-date')).toBeNull();
    expect(parseFlexibleTimestamp('')).toBeNull();
  });
});

describe('mobile-format.ts - formatRelativeTime (BUG-004)', () => {
  it('Postgres now()::text 형식(공백+마이크로초+오프셋)도 정상적으로 상대시각을 표시한다', () => {
    const now = new Date('2026-09-24T01:34:24.000Z');
    expect(formatRelativeTime('2026-09-24 01:33:54.123456+00', now)).toBe('방금');
  });

  it('파싱 불가능한 값은 "NaN"이 아니라 빈 문자열을 반환한다', () => {
    expect(formatRelativeTime('not-a-date')).toBe('');
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
