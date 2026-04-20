'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { useAgentDetailStore } from '@/stores/agentDetailStore';
import { useTerminalStore } from '@/stores/terminalStore';
import wsClient from '@/lib/ws';
import { Button } from '@/components/ui/button';

type Terminal = {
  open: (element: HTMLElement) => void;
  write: (data: string) => void;
  onData: (cb: (data: string) => void) => void;
  dispose: () => void;
};

export function AgentTerminalTab() {
  const { selectedAgent } = useAgentDetailStore();
  const { connected, sessionId, connect, disconnect, setSessionId, setConnected } = useTerminalStore();
  const termRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const cleanupRef = useRef<(() => void)[]>([]);

  // Handle terminal:connect response (receive sessionId from server)
  useEffect(() => {
    const unsub = wsClient.on('terminal:connect', (payload) => {
      const data = payload as { sessionId: string; agentId: string };
      if (data.sessionId) {
        setSessionId(data.sessionId);
        setConnected(true);
      }
    });
    return unsub;
  }, [setSessionId, setConnected]);

  // Handle terminal:output events -- write to xterm
  useEffect(() => {
    const unsub = wsClient.on('terminal:output', (payload) => {
      const data = payload as { sessionId: string; data: string };
      if (data.data && terminalRef.current) {
        terminalRef.current.write(data.data);
      }
    });
    cleanupRef.current.push(unsub);
    return unsub;
  }, [sessionId]);

  // Lazy load xterm and initialize terminal
  const initTerminal = useCallback(async () => {
    if (!termRef.current || terminalRef.current) return;

    const { Terminal } = await import('xterm');
    await import('xterm/css/xterm.css');

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
      cursorBlink: true,
    });

    if (termRef.current) {
      term.open(termRef.current);
      terminalRef.current = term as unknown as Terminal;

      // Send keystrokes to server via WebSocket
      term.onData((data: string) => {
        useTerminalStore.getState().send(data);
      });
    }
  }, []);

  // Initialize terminal when connected
  useEffect(() => {
    if (connected) {
      initTerminal();
    }
  }, [connected, initTerminal]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (terminalRef.current) {
        terminalRef.current.dispose();
        terminalRef.current = null;
      }
      cleanupRef.current.forEach((fn) => fn());
      cleanupRef.current = [];
    };
  }, []);

  if (!selectedAgent) return null;

  if (!selectedAgent.tmuxSession) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-[var(--text-tertiary)]">
        This agent has no tmux session.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {!connected ? (
          <Button size="sm" onClick={() => connect(selectedAgent.id)}>
            Connect Terminal
          </Button>
        ) : (
          <Button size="sm" variant="danger" onClick={() => {
            disconnect();
            if (terminalRef.current) {
              terminalRef.current.dispose();
              terminalRef.current = null;
            }
          }}>
            Disconnect
          </Button>
        )}
        <span className="text-xs text-[var(--text-tertiary)]">
          Session: {selectedAgent.tmuxSession}
        </span>
        {connected && sessionId && (
          <span className="text-xs text-green-400">Connected</span>
        )}
      </div>

      <div
        ref={termRef}
        className="bg-[#1a1a2e] rounded-[var(--radius-md)] min-h-[400px] overflow-hidden"
      />
    </div>
  );
}
