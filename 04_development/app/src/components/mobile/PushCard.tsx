'use client';

import React, { useState } from 'react';
import { usePushSubscription, type PushState } from '@/hooks/usePushSubscription';
import { InstallGuideSheet, PermissionGuideSheet } from '@/components/mobile/BottomSheet';

/** PushState별 문구 (DES-006 §SCR-M03 푸시 카드 상태) */
const PUSH_STATE_TEXT: Record<PushState, string> = {
  unsupported: '이 브라우저는 푸시를 지원하지 않습니다',
  'needs-install': '푸시 알림은 홈 화면에 추가한 앱에서만 받을 수 있습니다',
  'server-disabled': '서버에 푸시 설정이 없습니다 (VAPID)',
  default: '에이전트가 답을 마치면 폰으로 알려 드립니다',
  subscribed: '푸시 알림 켜짐',
  denied: '알림 권한이 꺼져 있습니다',
};

/**
 * SCR-M03 푸시 카드 — DES-006 §푸시 카드 상태, EVT-M03-3~6.
 *
 * 토스트 컴포넌트가 아직 없어(발견 시점 기준) 실패 문구는 카드 안 인라인 텍스트로 대체한다.
 */
export function PushCard() {
  const { state, loading, error, subscribe, unsubscribe } = usePushSubscription();
  const [installOpen, setInstallOpen] = useState(false);
  const [permissionOpen, setPermissionOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // EVT-M03-3: [푸시 켜기] — 탭 핸들러 안에서 곧바로 호출해야 iOS가 사용자 제스처로 인정한다.
  async function handleSubscribe(): Promise<void> {
    setBusy(true);
    try {
      await subscribe();
    } finally {
      setBusy(false);
    }
  }

  // EVT-M03-4: [푸시 끄기]
  async function handleUnsubscribe(): Promise<void> {
    setBusy(true);
    try {
      await unsubscribe();
    } finally {
      setBusy(false);
    }
  }

  const secondaryButtonClass =
    'min-h-[44px] px-4 rounded-[var(--radius-md)] border border-[var(--primary-200)] text-[var(--primary-600)] text-sm font-medium disabled:opacity-50';
  const primaryButtonClass =
    'min-h-[44px] px-4 rounded-[var(--radius-md)] bg-[var(--primary-500)] text-white text-sm font-medium disabled:opacity-50';

  return (
    <section className="px-4 py-3" aria-label="푸시 알림">
      <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--primary-50)] shadow-[var(--shadow-sm)] p-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-1">푸시 알림</h2>

        {loading ? (
          <p className="text-sm text-[var(--text-tertiary)]">확인 중…</p>
        ) : (
          <>
            <p className="text-sm text-[var(--text-secondary)]">{PUSH_STATE_TEXT[state]}</p>

            {error && <p className="text-xs text-[var(--status-error-text)] mt-1">{error}</p>}

            {state === 'needs-install' && (
              <div className="flex justify-end mt-3">
                <button type="button" onClick={() => setInstallOpen(true)} className={secondaryButtonClass}>
                  설치 방법
                </button>
              </div>
            )}

            {state === 'default' && (
              <div className="flex justify-end mt-3">
                <button type="button" onClick={handleSubscribe} disabled={busy} className={primaryButtonClass}>
                  푸시 켜기
                </button>
              </div>
            )}

            {state === 'subscribed' && (
              <div className="flex justify-end mt-3">
                <button type="button" onClick={handleUnsubscribe} disabled={busy} className={secondaryButtonClass}>
                  푸시 끄기
                </button>
              </div>
            )}

            {state === 'denied' && (
              <div className="flex justify-end mt-3">
                <button type="button" onClick={() => setPermissionOpen(true)} className={secondaryButtonClass}>
                  켜는 방법
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <InstallGuideSheet open={installOpen} onClose={() => setInstallOpen(false)} />
      <PermissionGuideSheet open={permissionOpen} onClose={() => setPermissionOpen(false)} />
    </section>
  );
}
