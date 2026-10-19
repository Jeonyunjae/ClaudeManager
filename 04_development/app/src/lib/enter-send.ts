/**
 * 한글 입력 + Enter 전송 제어 (BUG-033, M-103).
 *
 * 브라우저마다 "조합 끝(compositionend)"과 Enter keydown 순서가 다르다.
 *
 * | 환경 | 순서 |
 * |---|---|
 * | Chrome(macOS·Windows) | keydown(조합 중) → compositionend → keydown(조합 아님) |
 * | 일부 Windows IME | keydown(조합 중) → compositionend (두 번째 keydown 없음) |
 * | Safari(macOS) | compositionend → keydown(조합 아님, keyCode 229) |
 *
 * "조합 중 Enter 무시"만 하면 두 번째·세 번째 경우에 Enter를 두 번 눌러야 전송된다(불합격).
 * 그래서 조합 중 Enter는 "보낼 예정"으로 표시만 하고, 조합이 끝나는 순간 한 번 보낸다.
 * 그 직후 따라오는 Enter(첫 번째 경우)는 삼킨다. 결과: 어느 순서든 Enter 1회 = 정확히 1건.
 */
export type EnterKeyEventLike = {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
};

export type EnterSendOptions = {
  now?: () => number;
  /** 조합 끝 직후 전송 예약 — 확정된 마지막 글자가 입력값에 반영된 뒤 보내기 위해 다음 틱으로 미룬다 */
  schedule?: (fn: () => void) => void;
  /** 터치 기기는 Enter를 줄바꿈으로 둔다 (BUG-010) */
  isCoarsePointer?: () => boolean;
  /** 조합으로 보낸 직후 이 시간 안의 Enter는 같은 키 입력의 중복이다 */
  duplicateWindowMs?: number;
};

export class EnterSendController {
  private composing = false;
  private pending = false;
  private lastCompositionSendAt = Number.NEGATIVE_INFINITY;
  private readonly now: () => number;
  private readonly schedule: (fn: () => void) => void;
  private readonly isCoarsePointer: () => boolean;
  private readonly duplicateWindowMs: number;

  constructor(private readonly send: () => void, options: EnterSendOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.schedule = options.schedule ?? ((fn) => setTimeout(fn, 0));
    this.isCoarsePointer = options.isCoarsePointer ?? (() => false);
    this.duplicateWindowMs = options.duplicateWindowMs ?? 300;
  }

  compositionStart(): void {
    this.composing = true;
  }

  compositionEnd(): void {
    this.composing = false;
    if (!this.pending) return;
    this.pending = false;
    this.lastCompositionSendAt = this.now();
    this.schedule(() => this.send());
  }

  /** @returns true면 호출부가 `preventDefault()` 한다 (줄바꿈이 들어가지 않게) */
  keyDown(e: EnterKeyEventLike): boolean {
    if (e.key !== 'Enter' || e.shiftKey) return false;
    if (this.isCoarsePointer()) return false;

    // 아직 조합 중 — 조합 확정을 막지 않고, 끝나는 순간 보낸다
    if (this.composing || e.isComposing) {
      this.pending = true;
      return false;
    }

    // 조합 끝에 이미 보낸 바로 그 Enter가 한 번 더 온 것 (Chrome) — 삼킨다
    if (this.now() - this.lastCompositionSendAt < this.duplicateWindowMs) return true;

    this.pending = false;
    this.send();
    return true;
  }
}

/**
 * 보조 안전장치 — 같은 대상에 같은 내용이 `windowMs` 안에 다시 전송되면 막는다 (M-103 요구).
 * @returns true면 중복이라 보내지 않는다
 */
export function createSendDeduper(windowMs = 1000, now: () => number = () => Date.now()) {
  const last = new Map<string, { content: string; at: number }>();
  return (target: string, content: string): boolean => {
    const t = now();
    const prev = last.get(target);
    if (prev && prev.content === content && t - prev.at < windowMs) return true;
    last.set(target, { content, at: t });
    return false;
  };
}
