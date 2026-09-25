'use client';

import { useEffect } from 'react';

/**
 * iOS Safari가 표준이 아닌 방식으로 쏘는 핀치 제스처 이벤트 — BUG-028.
 * `viewport`의 `userScalable: false`를 iOS Safari가 무시하는 경우가 있어 보강용으로 막는다.
 */
export const GESTURE_EVENTS = ['gesturestart', 'gesturechange', 'gestureend'] as const;

/** 핀치 확대 제스처 이벤트 핸들러 (순수 함수 — 테스트 대상). preventDefault만 한다. */
export function preventGestureZoom(e: Event): void {
  e.preventDefault();
}

/**
 * 모바일 셸(`/m` layout) 마운트 중 iOS Safari의 핀치 확대를 막는다 — BUG-028.
 * `document`에 gesturestart/gesturechange/gestureend를 `passive: false`로 등록해야
 * preventDefault가 실제로 동작한다. 언마운트 시 반드시 해제한다(다른 화면에 영향 없게).
 */
export function usePreventZoom(): void {
  useEffect(() => {
    const options: AddEventListenerOptions = { passive: false };
    for (const eventName of GESTURE_EVENTS) {
      document.addEventListener(eventName, preventGestureZoom, options);
    }
    return () => {
      for (const eventName of GESTURE_EVENTS) {
        document.removeEventListener(eventName, preventGestureZoom);
      }
    };
  }, []);
}
