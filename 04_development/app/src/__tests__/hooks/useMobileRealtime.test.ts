/**
 * useMobileRealtime 순수 함수 단위 테스트 — FR-005, DES-006 EVT-SH-1·EVT-SH-2, DES-007 §4
 * (환경이 node이므로 훅 자체가 아니라 재조회 트리거 판정을 담당하는 순수 함수만 검증한다)
 */
import { describe, it, expect } from 'vitest';
import { isReconnectTransition, shouldReconnectOnVisible } from '@/hooks/useMobileRealtime';

describe('isReconnectTransition', () => {
  it('끊김(false) → 연결(true) 전이면 참이다 (EVT-SH-2: 재조회 트리거)', () => {
    expect(isReconnectTransition(false, true)).toBe(true);
  });

  it('이미 연결된 상태에서 다시 open 이벤트가 와도(전이 아님) 거짓이다', () => {
    expect(isReconnectTransition(true, true)).toBe(false);
  });

  it('연결 → 끊김 전이는 거짓이다 (재조회 대상이 아니다)', () => {
    expect(isReconnectTransition(true, false)).toBe(false);
  });

  it('끊김 상태 유지도 거짓이다', () => {
    expect(isReconnectTransition(false, false)).toBe(false);
  });
});

describe('shouldReconnectOnVisible', () => {
  it('탭이 보이는 상태로 돌아왔고 아직 끊긴 채면 재연결을 시도해야 한다', () => {
    expect(shouldReconnectOnVisible('visible', false)).toBe(true);
  });

  it('탭이 보이는 상태로 돌아왔지만 이미 연결돼 있으면 재연결하지 않는다', () => {
    expect(shouldReconnectOnVisible('visible', true)).toBe(false);
  });

  it('탭이 백그라운드(hidden)면 연결 여부와 무관하게 재연결하지 않는다', () => {
    expect(shouldReconnectOnVisible('hidden', false)).toBe(false);
    expect(shouldReconnectOnVisible('hidden', true)).toBe(false);
  });
});
