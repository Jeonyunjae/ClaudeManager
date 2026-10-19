/**
 * 한글 입력 + Enter 전송 제어 단위 테스트 — BUG-033 (Main M-103)
 * 완료 기준: 평소처럼 한글 입력 후 Enter 1회 = 정확히 1건. 브라우저 3가지 이벤트 순서 모두.
 */
import { describe, it, expect } from 'vitest';
import { EnterSendController, createSendDeduper } from '@/lib/enter-send';

function setup(opts: { coarse?: boolean } = {}) {
  let t = 1000;
  const queue: (() => void)[] = [];
  const sent: string[] = [];
  let value = '';
  const c = new EnterSendController(() => {
    if (value.trim()) sent.push(value);
    value = '';
  }, {
    now: () => t,
    schedule: (fn) => queue.push(fn),
    isCoarsePointer: () => !!opts.coarse,
  });
  const flush = () => { while (queue.length) queue.shift()!(); };
  const advance = (ms: number) => { t += ms; };
  const type = (v: string) => { value = v; };
  const enter = (isComposing: boolean, shiftKey = false) => c.keyDown({ key: 'Enter', shiftKey, isComposing });
  return { c, sent, flush, advance, type, enter, get value() { return value; } };
}

/** Chrome(macOS·Windows): keydown(조합 중) → compositionend → keydown(조합 아님) */
function chromeOrder(s: ReturnType<typeof setup>, text: string) {
  s.c.compositionStart(); s.type(text);
  s.enter(true);
  s.c.compositionEnd();
  s.advance(12);
  const swallowed = s.enter(false);
  s.flush();
  return swallowed;
}
/** 일부 Windows IME: keydown(조합 중) → compositionend, 두 번째 keydown 없음 */
function windowsOrder(s: ReturnType<typeof setup>, text: string) {
  s.c.compositionStart(); s.type(text);
  s.enter(true);
  s.c.compositionEnd();
  s.flush();
}
/** Safari(macOS): compositionend → keydown(조합 아님, keyCode 229) */
function safariOrder(s: ReturnType<typeof setup>, text: string) {
  s.c.compositionStart(); s.type(text);
  s.c.compositionEnd();
  s.enter(false);
  s.flush();
}

describe.each([
  ['Chrome', chromeOrder],
  ['Windows IME', windowsOrder],
  ['Safari', safariOrder],
] as const)('%s 이벤트 순서', (_name, order) => {
  it('검증 1: "가" 입력 후 Enter 1회 → "가" 1건', () => {
    const s = setup();
    order(s, '가');
    expect(s.sent).toEqual(['가']);
  });

  it('검증 2: 긴 문장 + Enter 1회 → 전체 1건, 끝 글자 누락·중복 없음', () => {
    const s = setup();
    order(s, '깃했다. 부서 개편안은 패기');
    expect(s.sent).toEqual(['깃했다. 부서 개편안은 패기']);
  });

  it('검증 5: 연속으로 빠르게 두 메시지 → 각 1건', () => {
    const s = setup();
    order(s, '승인');
    s.advance(400);
    order(s, '가');
    expect(s.sent).toEqual(['승인', '가']);
  });
});

describe('조합이 아닌 입력', () => {
  it('검증 3: 영문·숫자·문장부호로 끝남 + Enter 1회 → 1건', () => {
    const s = setup();
    s.type('OK 123.');
    expect(s.enter(false)).toBe(true);
    expect(s.sent).toEqual(['OK 123.']);
  });

  it('검증 4: Shift+Enter → 전송 없음, 기본 동작(줄바꿈)', () => {
    const s = setup();
    s.type('첫 줄');
    expect(s.enter(false, true)).toBe(false);
    s.c.compositionStart(); s.enter(true, true); s.c.compositionEnd(); s.flush();
    expect(s.sent).toEqual([]);
  });

  it('조합으로 보낸 뒤 300ms가 지나 누른 Enter는 정상 Enter로 처리', () => {
    const s = setup();
    chromeOrder(s, '가');
    s.advance(500);
    s.type('나');
    s.enter(false);
    expect(s.sent).toEqual(['가', '나']);
  });

  it('조합 중 Enter 없이 조합만 끝나면 보내지 않는다 (스페이스 등으로 확정)', () => {
    const s = setup();
    s.c.compositionStart(); s.type('가'); s.c.compositionEnd(); s.flush();
    expect(s.sent).toEqual([]);
  });

  it('터치 기기는 Enter = 줄바꿈, 전송 안 함 (BUG-010 유지)', () => {
    const s = setup({ coarse: true });
    s.type('가');
    expect(s.enter(false)).toBe(false);
    s.c.compositionStart(); s.enter(true); s.c.compositionEnd(); s.flush();
    expect(s.sent).toEqual([]);
  });

  it('Enter가 아닌 키는 무시', () => {
    const s = setup();
    expect(s.c.keyDown({ key: 'a', shiftKey: false, isComposing: false })).toBe(false);
  });
});

describe('createSendDeduper (보조 안전장치)', () => {
  it('같은 대상·같은 내용 1초 안 재전송은 중복', () => {
    let t = 0;
    const dup = createSendDeduper(1000, () => t);
    expect(dup('a1', '승인')).toBe(false);
    t = 500;
    expect(dup('a1', '승인')).toBe(true);
    t = 1600;
    expect(dup('a1', '승인')).toBe(false);
  });

  it('내용이나 대상이 다르면 중복 아님', () => {
    let t = 0;
    const dup = createSendDeduper(1000, () => t);
    expect(dup('a1', '승인')).toBe(false);
    expect(dup('a1', '반려')).toBe(false);
    expect(dup('a2', '반려')).toBe(false);
  });
});
