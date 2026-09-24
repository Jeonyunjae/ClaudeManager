'use client';

import type { WSMessage } from '@/types/ws-events';
import { WS_PORT, WS_RECONNECT_INITIAL_MS, WS_RECONNECT_MAX_MS } from './constants';

type WSEventHandler = (payload: unknown) => void;

type BuildWsUrlParams = {
  protocol: string;
  hostname: string;
  token: string;
  wssPort: string | undefined;
};

/**
 * WS 접속 주소를 만든다 (순수 함수 — 테스트 용이).
 *
 * HTTPS 페이지이고 NEXT_PUBLIC_WSS_PORT가 있으면 그 포트로 wss 접속한다
 * (Tailscale serve가 HTTPS를 종단하고 다른 포트로 프록시하는 구성, INT-001).
 * 그 외(HTTP이거나 포트 미설정)에는 기존과 동일하게 `WS_PORT`(3001)를 쓴다.
 */
export function buildWsUrl({ protocol, hostname, token, wssPort }: BuildWsUrlParams): string {
  const useWss = protocol === 'https:' && !!wssPort;
  const scheme = useWss ? 'wss:' : protocol === 'https:' ? 'wss:' : 'ws:';
  const port = useWss ? wssPort : WS_PORT;
  return `${scheme}//${hostname}:${port}/ws?token=${token}`;
}

class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<WSEventHandler>> = new Map();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = WS_RECONNECT_INITIAL_MS;
  private isConnecting = false;
  private token: string | null = null;

  connect(token: string): void {
    this.token = token;
    this.doConnect();
  }

  private doConnect(): void {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) return;
    this.isConnecting = true;

    const url = buildWsUrl({
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      token: this.token ?? '',
      wssPort: process.env.NEXT_PUBLIC_WSS_PORT,
    });

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectDelay = WS_RECONNECT_INITIAL_MS;
        this.emit('connection:open', {});
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          this.emit(message.type, message.payload);
        } catch {
          console.error('Failed to parse WebSocket message');
        }
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.emit('connection:close', {});
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.isConnecting = false;
        this.emit('connection:error', {});
      };
    } catch {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.doConnect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, WS_RECONNECT_MAX_MS);
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.token = null;
  }

  send(type: string, payload: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message: WSMessage = {
        type,
        payload,
        timestamp: new Date().toISOString(),
      };
      this.ws.send(JSON.stringify(message));
    }
  }

  on(type: string, handler: WSEventHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  off(type: string, handler: WSEventHandler): void {
    this.handlers.get(type)?.delete(handler);
  }

  private emit(type: string, payload: unknown): void {
    this.handlers.get(type)?.forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`Error in WebSocket handler for ${type}:`, error);
      }
    });
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const wsClient = new WebSocketClient();
export default wsClient;
