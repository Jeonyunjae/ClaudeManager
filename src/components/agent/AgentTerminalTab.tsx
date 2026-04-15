'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useAgentDetailStore } from '@/stores/agentDetailStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { Button } from '@/components/ui/button';

export function AgentTerminalTab() {
  const { selectedAgent } = useAgentDetailStore();
  const { connected, connect, disconnect } = useTerminalStore();
  const termRef = useRef<HTMLDivElement>(null);
  const [termLoaded, setTermLoaded] = useState(false);

  useEffect(() => {
    // Lazy load xterm
    if (connected && termRef.current && !termLoaded) {
      import('xterm').then(({ Terminal }) => {
        import('xterm/css/xterm.css');
        const term = new Terminal({
          fontSize: 12,
          fontFamily: 'var(--font-mono), monospace',
          theme: {
            background: '#1a1a2e',
            foreground: '#e0e0e0',
            cursor: '#a78bfa',
          },
          rows: 24,
          cols: 80,
        });

        if (termRef.current) {
          term.open(termRef.current);
          setTermLoaded(true);

          term.onData((data) => {
            useTerminalStore.getState().send(data);
          });
        }

        return () => {
          term.dispose();
        };
      });
    }
  }, [connected, termLoaded]);

  if (!selectedAgent) return null;

  if (!selectedAgent.tmuxSession) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-[var(--text-tertiary)]">
        이 에이전트에는 tmux 세션이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {!connected ? (
          <Button size="sm" onClick={() => connect(selectedAgent.id)}>
            터미널 연결
          </Button>
        ) : (
          <Button size="sm" variant="danger" onClick={disconnect}>
            연결 해제
          </Button>
        )}
        <span className="text-xs text-[var(--text-tertiary)]">
          Session: {selectedAgent.tmuxSession}
        </span>
      </div>

      <div
        ref={termRef}
        className="bg-[#1a1a2e] rounded-[var(--radius-md)] min-h-[400px] overflow-hidden"
      />
    </div>
  );
}
