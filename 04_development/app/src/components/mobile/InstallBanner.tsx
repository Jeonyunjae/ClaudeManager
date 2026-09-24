'use client';

import React, { useEffect, useState } from 'react';
import { isIOS, isStandalone } from '@/lib/platform';
import { InstallGuideSheet } from '@/components/mobile/BottomSheet';

/** DES-009 §브라우저 저장소 키 — 설치 안내 배너를 닫은 경우 */
export const INSTALL_HINT_DISMISSED_KEY = 'cm_install_hint_dismissed';

/**
 * SCR-M01 설치 배너 — DES-006 §SCR-M01 구성 요소, EVT-M01-4·EVT-M01-5.
 *
 * iOS Safari(미설치)에서만 보인다. 한 번 닫으면(✕) localStorage에 저장해 다시 보이지 않는다.
 */
export function InstallBanner() {
  const [visible, setVisible] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = window.localStorage.getItem(INSTALL_HINT_DISMISSED_KEY) === '1';
    // UA·standalone·localStorage는 SSR 렌더에 없어 마운트 후에만 판정할 수 있다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(isIOS() && !isStandalone() && !dismissed);
  }, []);

  // EVT-M01-5: 배너 ✕ -> 배너 숨김 + localStorage 저장
  function handleDismiss(): void {
    window.localStorage.setItem(INSTALL_HINT_DISMISSED_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-[var(--primary-50)] text-[var(--primary-700)] border-b border-[var(--primary-100)]">
      {/* EVT-M01-4: 배너 탭 -> MOD-M01 */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="flex-1 min-h-[44px] flex items-center text-left text-sm"
      >
        홈 화면에 추가하면 푸시 알림을 받을 수 있습니다
      </button>
      <button
        type="button"
        aria-label="설치 안내 닫기"
        onClick={handleDismiss}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        ✕
      </button>

      <InstallGuideSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
}
