'use client';

import { useEffect, useRef, useState } from 'react';
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
 * EVT-SH-2: 끊김→연결 전이일 때만 참 (그 외 전이는 재조회하지 않는다).
 * 순수 로직으로 분리해 테스트 용이성을 확보한다.
 */
export function isReconnectTransition(prevConnected: boolean, nextConnected: boolean): boolean {
  return prevConnected === false && nextConnected === true;
}

/**
 * 앱이 백그라운드에서 돌아왔을 때(visibilitychange) 연결을 다시 시도해야 하는지 판정한다
 * (FR-005 수용 기준 "백그라운드에서 돌아옴 → 연결 복구"). 순수 로직 — 테스트 용이.
 */
export function shouldReconnectOnVisible(visibilityState: string, isConnected: boolean): boolean {
  return visibilityState === 'visible' && !isConnected;
}

/**
 * WS 연결 상태 (헤더 StatusDot·ConnectionBar 용, EVT-SH-1·EVT-SH-2).
 * `wsClient.isConnected`는 getter일 뿐 리렌더를 유발하지 않으므로
 * `connection:open`·`connection:close` 이벤트를 구독해 리액트 상태로 옮긴다.
 *
 * `onReconnect`를 넘기면 끊김→연결 전이(EVT-SH-2)에서 정확히 한 번 호출된다 —
 * 호출부는 여기서 "현재 화면 재조회"(대화면이면 conversations 1페이지, 목록이면
 * inbox·tree)를 수행한다 (DES-007 §4 "(끊김 중) WS 재연결 → (재조회)").
 *
 * 탭이 백그라운드에서 돌아올 때(visibilitychange)도 연결 상태를 확인해, 끊긴 채라면
 * 곧바로 재연결을 시도한다 — 그 결과로 오는 `connection:open`이 위 재조회를 이어서 부른다.
 */
export function useWsConnectionStatus(onReconnect?: () => void): boolean {
  const [connected, setConnected] = useState<boolean>(() => wsClient.isConnected);
  const connectedRef = useRef(connected);
  const onReconnectRef = useRef(onReconnect);

  useEffect(() => {
    onReconnectRef.current = onReconnect;
  }, [onReconnect]);

  useEffect(() => {
    const offOpen = wsClient.on('connection:open', () => {
      if (isReconnectTransition(connectedRef.current, true)) {
        onReconnectRef.current?.();
      }
      connectedRef.current = true;
      setConnected(true);
    });
    const offClose = wsClient.on('connection:close', () => {
      connectedRef.current = false;
      setConnected(false);
    });
    return () => {
      offOpen();
      offClose();
    };
  }, []);

  useEffect(() => {
    function handleVisibility(): void {
      if (shouldReconnectOnVisible(document.visibilityState, wsClient.isConnected)) {
        wsClient.connect(localStorage.getItem('auth_token') ?? '');
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  return connected;
}
