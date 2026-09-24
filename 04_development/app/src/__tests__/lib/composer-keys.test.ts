/**
 * lib/composer-keys.ts 단위 테스트 — BUG-010.
 * IME 조합 중 Enter, 터치 기기의 Enter 처리 판정(순수 함수)을 검증한다.
 */
import { describe, it, expect } from 'vitest';
import { decideEnterAction } from '@/lib/composer-keys';

const BASE = { isComposing: false, keyCode: 13, isCoarsePointer: false };

describe('decideEnterAction (BUG-010)', () => {
  it('데스크톱·조합 중 아님 → send', () => {
    expect(decideEnterAction(BASE)).toBe('send');
  });

  it('IME 조합 중(isComposing)이면 default(전송하지 않음) — 한글 마지막 글자 중복 방지', () => {
    expect(decideEnterAction({ ...BASE, isComposing: true })).toBe('default');
  });

  it('keyCode 229(구형 IME 조합 신호)면 default', () => {
    expect(decideEnterAction({ ...BASE, isComposing: false, keyCode: 229 })).toBe('default');
  });

  it('터치 기기(coarse pointer)면 Enter는 줄바꿈으로 남긴다 (default)', () => {
    expect(decideEnterAction({ ...BASE, isCoarsePointer: true })).toBe('default');
  });

  it('터치 기기이면서 조합 중이어도 default(둘 다 send를 막는 조건)', () => {
    expect(decideEnterAction({ isComposing: true, keyCode: 229, isCoarsePointer: true })).toBe('default');
  });
});
