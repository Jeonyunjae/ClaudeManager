/**
 * 메시지 입력창 Enter 키 처리 판정 (순수 함수) — BUG-010.
 *
 * - IME(한글 등) 조합 중 Enter는 조합 확정용이다. `isComposing`(표준) 또는
 *   `keyCode === 229`(일부 브라우저·모바일 IME가 조합 중 keydown에 실어 보내는 값,
 *   `isComposing`이 신뢰할 수 없는 환경의 대비)면 전송하지 않고 기본 동작(조합 확정)에
 *   맡긴다 — 아니면 한글 마지막 글자가 중복되거나 잘린다.
 * - 터치 기기(coarse pointer — 손가락 입력)에서는 Enter를 줄바꿈으로 남겨 둔다. 전송은
 *   화면의 [전송] 버튼으로만 한다 — 소프트 키보드의 Enter가 바로 전송되면 여러 줄
 *   메시지를 쓸 방법이 없다(iPhone 등).
 * - 그 외(데스크톱 키보드, 조합 중 아님)에는 전송한다.
 *
 * Shift+Enter(줄바꿈 고정)는 이 함수 밖(MessageComposer)에서 이미 걸러진다 — 여기서는
 * "Shift 없는 Enter"만 판정한다.
 */
export type EnterKeyContext = {
  /** IME 조합 중 여부 — `KeyboardEvent.nativeEvent.isComposing` */
  isComposing: boolean;
  /** 구형/일부 모바일 IME 환경에서 조합 중 keydown에 229가 실린다 */
  keyCode: number;
  /** 터치 입력 기기 — `matchMedia('(pointer: coarse)').matches` */
  isCoarsePointer: boolean;
};

export type EnterKeyAction = 'send' | 'default';

export function decideEnterAction(ctx: EnterKeyContext): EnterKeyAction {
  if (ctx.isComposing || ctx.keyCode === 229) return 'default';
  if (ctx.isCoarsePointer) return 'default';
  return 'send';
}
