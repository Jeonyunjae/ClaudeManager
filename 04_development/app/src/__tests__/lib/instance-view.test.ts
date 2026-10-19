/**
 * Instance 화면 규칙 단위 테스트 — BUG-034
 */
import { describe, it, expect } from 'vitest';
import { isInstanceVisible, sortInstances, formatElapsed, instanceSubtitle } from '@/lib/instance-view';
import type { AgentTreeNode } from '@/types/agent';

const NOW = Date.parse('2026-10-19T12:00:00.000Z');
const node = (id: string, status: AgentTreeNode['status'], startedAt: string, stoppedAt?: string): AgentTreeNode =>
  ({ id, name: id, role: 'instance', status, startedAt, stoppedAt, statusMessage: '조사', children: [] });

describe('isInstanceVisible (보관 규칙)', () => {
  it('Instance가 아니면 항상 보인다', () => {
    expect(isInstanceVisible({ role: 'sub', status: 'idle', stoppedAt: '2020-01-01T00:00:00Z' }, NOW)).toBe(true);
  });
  it('진행 중이면 보인다', () => {
    expect(isInstanceVisible({ role: 'instance', status: 'active', stoppedAt: null }, NOW)).toBe(true);
  });
  it('끝난 지 하루 안이면 보이고, 지나면 숨긴다', () => {
    expect(isInstanceVisible({ role: 'instance', status: 'idle', stoppedAt: '2026-10-19T00:00:00.000Z' }, NOW)).toBe(true);
    expect(isInstanceVisible({ role: 'instance', status: 'idle', stoppedAt: '2026-10-18T11:00:00.000Z' }, NOW)).toBe(false);
  });
});

describe('sortInstances', () => {
  it('진행 중(먼저 시작한 순) → 최근 완료 순, 최대 개수', () => {
    const list = [
      node('done-old', 'idle', '2026-10-19T09:00:00Z', '2026-10-19T09:05:00Z'),
      node('run-late', 'active', '2026-10-19T11:50:00Z'),
      node('done-new', 'idle', '2026-10-19T11:00:00Z', '2026-10-19T11:30:00Z'),
      node('run-early', 'active', '2026-10-19T11:40:00Z'),
    ];
    expect(sortInstances(list).map((n) => n.id)).toEqual(['run-early', 'run-late', 'done-new', 'done-old']);
    expect(sortInstances(list, 2).map((n) => n.id)).toEqual(['run-early', 'run-late']);
  });
});

describe('formatElapsed / instanceSubtitle', () => {
  it('경과 시간 표기', () => {
    expect(formatElapsed('2026-10-19T11:59:15Z', undefined, NOW)).toBe('45초');
    expect(formatElapsed('2026-10-19T11:56:48Z', undefined, NOW)).toBe('3분 12초');
    expect(formatElapsed('2026-10-19T10:55:00Z', undefined, NOW)).toBe('1시간 5분');
    expect(formatElapsed(undefined)).toBe('');
  });
  it('부제 = 하는 일 · 상태 · 경과', () => {
    expect(instanceSubtitle(node('a', 'active', '2026-10-19T11:59:00Z'), NOW)).toBe('조사 · 진행 중 · 1분 0초');
    expect(instanceSubtitle(node('b', 'idle', '2026-10-19T11:00:00Z', '2026-10-19T11:02:30Z'), NOW)).toBe('조사 · 완료 · 2분 30초');
    expect(instanceSubtitle(node('c', 'error', '2026-10-19T11:00:00Z', '2026-10-19T11:00:10Z'), NOW)).toBe('조사 · 오류 · 10초');
  });
});
