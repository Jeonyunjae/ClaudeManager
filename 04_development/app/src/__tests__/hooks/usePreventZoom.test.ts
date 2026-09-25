/**
 * @vitest-environment jsdom
 *
 * hooks/usePreventZoom.ts 단위 테스트 — BUG-028(iOS Safari 핀치 확대 차단).
 * viewport의 user-scalable=no를 iOS Safari가 무시할 수 있어, gesturestart 등
 * 비표준 제스처 이벤트를 document에 등록해 preventDefault로 보강한다. 여기서는
 * 마운트 시 등록/언마운트 시 해제, 그리고 preventDefault 호출 자체를 검증한다.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { GESTURE_EVENTS, preventGestureZoom, usePreventZoom } from '@/hooks/usePreventZoom';

describe('preventGestureZoom', () => {
  it('이벤트의 preventDefault를 호출한다', () => {
    const event = { preventDefault: vi.fn() } as unknown as Event;
    preventGestureZoom(event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });
});

describe('usePreventZoom', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('마운트 시 gesturestart/gesturechange/gestureend를 passive:false로 등록한다', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');

    renderHook(() => usePreventZoom());

    // jsdom/testing-library가 내부적으로 document.addEventListener를 추가로 호출할 수 있어
    // (예: act 환경 설정), 전체 호출 수가 아니라 이 훅이 등록한 리스너만 골라서 검증한다.
    const ourCalls = addSpy.mock.calls.filter(([, listener]) => listener === preventGestureZoom);
    expect(ourCalls).toHaveLength(GESTURE_EVENTS.length);
    for (const eventName of GESTURE_EVENTS) {
      expect(addSpy).toHaveBeenCalledWith(eventName, preventGestureZoom, { passive: false });
    }
  });

  it('언마운트 시 등록한 리스너를 모두 해제한다', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => usePreventZoom());
    expect(removeSpy).not.toHaveBeenCalled();

    unmount();

    expect(removeSpy).toHaveBeenCalledTimes(GESTURE_EVENTS.length);
    for (const eventName of GESTURE_EVENTS) {
      expect(removeSpy).toHaveBeenCalledWith(eventName, preventGestureZoom);
    }
  });

  it('실제로 document에서 gesturestart를 dispatch하면 preventDefault가 호출된다', () => {
    renderHook(() => usePreventZoom());

    const event = new Event('gesturestart', { cancelable: true });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});
