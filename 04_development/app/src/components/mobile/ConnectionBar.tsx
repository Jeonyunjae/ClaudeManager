'use client';

import React, { useEffect, useState } from 'react';
import wsClient from '@/lib/ws';

type ConnectionBarProps = {
  connected: boolean;
};

/** EVT-SH-1·EVT-SH-2: WS 끊김 표시 — 30초 이상 지속되면 [다시 연결] 버튼을 보인다 */
export function ConnectionBar({ connected }: ConnectionBarProps) {
  const [showReconnectButton, setShowReconnectButton] = useState(false);

  useEffect(() => {
    if (connected) return;
    const timer = setTimeout(() => setShowReconnectButton(true), 30_000);
    return () => {
      clearTimeout(timer);
      setShowReconnectButton(false);
    };
  }, [connected]);

  if (connected) return null;

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-1.5 bg-[var(--status-pending-bg)] text-[var(--status-pending-text)] text-xs">
      <span>연결 끊김 — 재연결 중…</span>
      {showReconnectButton && (
        <button
          type="button"
          onClick={() => wsClient.connect(localStorage.getItem('auth_token') ?? '')}
          className="font-medium underline shrink-0"
        >
          다시 연결
        </button>
      )}
    </div>
  );
}
