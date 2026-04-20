'use client';

import { create } from 'zustand';
import wsClient from '@/lib/ws';

type TerminalState = {
  sessionId: string | null;
  connected: boolean;
  connect: (agentId: string) => void;
  disconnect: () => void;
  send: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  setConnected: (connected: boolean) => void;
  setSessionId: (sessionId: string) => void;
};

export const useTerminalStore = create<TerminalState>((set, get) => ({
  sessionId: null,
  connected: false,

  connect: (agentId) => {
    wsClient.send('terminal:connect', { agentId });
  },

  disconnect: () => {
    const { sessionId } = get();
    if (sessionId) {
      wsClient.send('terminal:disconnect', { sessionId });
    }
    set({ sessionId: null, connected: false });
  },

  send: (data) => {
    const { sessionId } = get();
    if (sessionId) {
      wsClient.send('terminal:input', { sessionId, data });
    }
  },

  resize: (cols, rows) => {
    const { sessionId } = get();
    if (sessionId) {
      wsClient.send('terminal:resize', { sessionId, cols, rows });
    }
  },

  setConnected: (connected) => set({ connected }),
  setSessionId: (sessionId) => set({ sessionId, connected: true }),
}));
