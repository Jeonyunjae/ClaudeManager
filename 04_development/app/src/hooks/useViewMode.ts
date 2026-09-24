'use client';

import { useCallback, useState } from 'react';
import { useIsMobile } from './useMediaQuery';

export type ViewMode = 'auto' | 'mobile' | 'desktop';

export const VIEW_MODE_STORAGE_KEY = 'cm_view_mode';

type ResolveViewParams = {
  isMobile: boolean;
  mode: ViewMode;
};

/**
 * 보기 모드 판정 (순수 함수, DES-007 §5) — FR-001·FR-002
 *
 * - `mode === 'desktop'` (ForcedDesktop): 폭과 무관하게 항상 데스크톱
 * - `mode === 'mobile'`: 폭과 무관하게 항상 모바일
 * - `mode === 'auto'`: 폭 판정(`isMobile`)을 그대로 따른다
 */
export function resolveView({ isMobile, mode }: ResolveViewParams): boolean {
  if (mode === 'desktop') return false;
  if (mode === 'mobile') return true;
  return isMobile;
}

/** sessionStorage에 저장된 값이 유효한 ViewMode가 아니면 'auto'로 취급한다 */
export function normalizeViewMode(value: string | null): ViewMode {
  return value === 'mobile' || value === 'desktop' ? value : 'auto';
}

function readViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'auto';
  return normalizeViewMode(window.sessionStorage.getItem(VIEW_MODE_STORAGE_KEY));
}

export type UseViewModeResult = {
  mode: ViewMode;
  shouldUseMobile: boolean;
  setViewMode: (mode: ViewMode) => void;
};

/**
 * 보기 모드 훅 (FR-001, FR-002) — DES-001 `useViewMode`
 *
 * `useIsMobile`(폭 판정)과 sessionStorage `cm_view_mode`(수동 전환)를 합쳐
 * `shouldUseMobile`을 계산한다.
 */
export function useViewMode(): UseViewModeResult {
  const isMobile = useIsMobile();
  // 지연 초기화로 첫 렌더에서 바로 읽는다 (마운트 후 setState하는 effect를 피한다).
  // SSR에서는 window가 없어 'auto'로 시작하고, 클라이언트 첫 렌더에서 실제 값으로 정해진다.
  const [mode, setMode] = useState<ViewMode>(() => readViewMode());

  const setViewMode = useCallback((next: ViewMode) => {
    if (typeof window !== 'undefined') {
      if (next === 'auto') {
        window.sessionStorage.removeItem(VIEW_MODE_STORAGE_KEY);
      } else {
        window.sessionStorage.setItem(VIEW_MODE_STORAGE_KEY, next);
      }
    }
    setMode(next);
  }, []);

  return {
    mode,
    shouldUseMobile: resolveView({ isMobile, mode }),
    setViewMode,
  };
}
