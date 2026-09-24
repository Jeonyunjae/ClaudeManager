'use client';

import { useEffect, useState } from 'react';
import wsClient from '@/lib/ws';
import { useMobileChatStore } from '@/stores/mobileChatStore';
import { useInboxStore } from '@/stores/inboxStore';
import { useAgentStore } from '@/stores/agentStore';

/**
 * 모바일 화면 전용 WS 구독 (DES-002 §3, DES-006).
 *
 * 데스크톱 `useWebSocket.ts`는 수정하지 않고 **병행 구독**한다 — 같은 이벤트를
 * `wsClient.on`으로 한 번 더 받는 것뿐이라 데스크톱 store(`agentDetailStore`,
 * `chatStore`)에는 영향이 없다 (레이어 규칙, NFR-001). `/m` 레이아웃에 마운트되어
 * 있는 동안만 구독하고, 언마운트 시 `wsClient.on`이 돌려준 해제 함수로 정리한다.
 */
export function useMobileRealtime(): void {
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    unsubscribers.push(
      wsClient.on('chat:stream', (payload) => {
        const data = payload as { agentId: string; responseMsgId: string; content: string };
        useMobileChatStore.getState().applyStream(data);
      })
    );

    unsubscribers.push(
      wsClient.on('chat:tool', (payload) => {
        const data = payload as { agentId: string; responseMsgId: string; name: string; target?: string };
        useMobileChatStore.getState().applyTool(data);
      })
    );

    unsubscribers.push(
      wsClient.on('chat:typing', (payload) => {
        const data = payload as { agentId: string; isTyping: boolean };
        useMobileChatStore.getState().applyTyping(data);
      })
    );

    unsubscribers.push(
      wsClient.on('chat:queue', (payload) => {
        const data = payload as { agentId: string; depth: number };
        useMobileChatStore.getState().applyQueue(data);
      })
    );

    // chat:message: 대화 화면 반영 + 에이전트 발화면 인박스 재조회 (EVT-M01-7, EVT-M02-6)
    unsubscribers.push(
      wsClient.on('chat:message', (payload) => {
        const data = payload as {
          id: string;
          sender: string;
          content: string;
          messageType: string;
          agentId: string;
          createdAt: string;
        };
        useMobileChatStore.getState().applyMessage(data);
        if (data.sender !== 'user') {
          void useInboxStore.getState().fetchInbox();
        }
      })
    );

    // agent:status: 상태 카드·대화 헤더 갱신 (agentStore는 데스크톱과 공용이지만
    // 이 store 자체는 레이어 규칙에서 금지한 "데스크톱 전용 store"가 아니다)
    unsubscribers.push(
      wsClient.on('agent:status', (payload) => {
        const data = payload as { agentId: string; status: string; statusMessage?: string };
        useAgentStore.getState().updateAgentStatus(data.agentId, data.status, data.statusMessage);
      })
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, []);
}

/**
 * WS 연결 상태 (헤더 StatusDot·ConnectionBar 용, EVT-SH-1·EVT-SH-2).
 * `wsClient.isConnected`는 getter일 뿐 리렌더를 유발하지 않으므로
 * `connection:open`·`connection:close` 이벤트를 구독해 리액트 상태로 옮긴다.
 */
export function useWsConnectionStatus(): boolean {
  const [connected, setConnected] = useState<boolean>(() => wsClient.isConnected);

  useEffect(() => {
    const offOpen = wsClient.on('connection:open', () => setConnected(true));
    const offClose = wsClient.on('connection:close', () => setConnected(false));
    return () => {
      offOpen();
      offClose();
    };
  }, []);

  return connected;
}
