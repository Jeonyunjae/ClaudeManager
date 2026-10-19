'use client';

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { EnterSendController } from '@/lib/enter-send';

/**
 * 입력창에 붙이는 Enter 전송 핸들러 (BUG-033). `onSend`는 보낼 시점의 입력값(DOM)을 받는다 —
 * 조합 끝 직후에는 React 상태보다 DOM 값이 먼저 확정되기 때문이다.
 * `setElement`를 textarea의 ref 콜백에 연결한다.
 */
export function useEnterToSend(
  onSend: (text: string) => void,
  options: { coarsePointerNewline?: boolean } = {}
) {
  const onSendRef = useRef(onSend);
  const elementRef = useRef<HTMLTextAreaElement | null>(null);
  const controllerRef = useRef<EnterSendController | null>(null);
  const coarse = options.coarsePointerNewline ?? false;

  useLayoutEffect(() => {
    onSendRef.current = onSend;
  });

  useEffect(() => {
    controllerRef.current = new EnterSendController(() => onSendRef.current(elementRef.current?.value ?? ''), {
      isCoarsePointer: () =>
        coarse && typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches,
    });
  }, [coarse]);

  const setElement = useCallback((el: HTMLTextAreaElement | null) => {
    elementRef.current = el;
  }, []);
  const onCompositionStart = useCallback(() => controllerRef.current?.compositionStart(), []);
  const onCompositionEnd = useCallback(() => controllerRef.current?.compositionEnd(), []);
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const handled = controllerRef.current?.keyDown({
      key: e.key,
      shiftKey: e.shiftKey,
      isComposing: e.nativeEvent.isComposing,
    });
    if (handled) e.preventDefault();
  }, []);

  return { setElement, onCompositionStart, onCompositionEnd, onKeyDown };
}
