'use client';

import { create } from 'zustand';
import apiClient from '@/lib/api';

/** DES-002 §GET /api/agents/{id}/conversations 응답 항목 */
export type ConversationMessage = {
  id: string;
  timestamp: string;
  content: string;
  type: 'instruction' | 'report';
  metadata?: {
    tools?: { name: string; target?: string }[];
    queued?: boolean;
    cancelled?: boolean;
  };
  /** 전송 실패 표시 (클라이언트 전용, DES-007 §4 Failed) */
  failed?: boolean;
};

export type StreamingState = {
  responseMsgId: string;
  content: string;
  tool?: string;
} | null;

export type AgentChatState = {
  messages: ConversationMessage[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  sending: boolean;
  streaming: StreamingState;
  queueDepth: number;
  typing: boolean;
  error: string | null;
  /** DF-011: 이전 대화(EVT-M02-4) 추가 로딩 실패 — 목록 맨 위 "불러오지 못했습니다 · 다시" */
  loadMoreError: string | null;
};

/** 모바일 대화 페이지 크기 (DES-009 `CONVERSATION_PAGE_SIZE_MOBILE`) */
export const CONVERSATION_PAGE_SIZE_MOBILE = 30;

export function emptyAgentChatState(): AgentChatState {
  return {
    messages: [],
    page: 1,
    hasMore: false,
    loading: false,
    loadingMore: false,
    sending: false,
    streaming: null,
    queueDepth: 0,
    typing: false,
    error: null,
    loadMoreError: null,
  };
}

function getOrInit(byAgent: Record<string, AgentChatState>, agentId: string): AgentChatState {
  return byAgent[agentId] ?? emptyAgentChatState();
}

type ChatSendResponse = {
  userMessage: { id: string; sender: string; content: string };
  status: string;
  responseMsgId: string;
};

type MobileChatState = {
  byAgent: Record<string, AgentChatState>;
  getAgentState: (agentId: string) => AgentChatState;

  load: (agentId: string) => Promise<void>;
  loadMore: (agentId: string) => Promise<void>;
  /** 성공 시 true, 실패 시 false — DF-009: 호출부(MessageComposer)가 실패 시 입력 내용을 복원한다 */
  send: (agentId: string, content: string) => Promise<boolean>;
  resend: (agentId: string, messageId: string) => Promise<void>;

  // WS 핸들러가 호출하는 순수 반영 함수들 (테스트 용이)
  applyMessage: (message: { id: string; sender: string; content: string; messageType: string; agentId: string; createdAt: string }) => void;
  applyStream: (data: { agentId: string; responseMsgId: string; content: string }) => void;
  applyTool: (data: { agentId: string; responseMsgId: string; name: string; target?: string }) => void;
  applyTyping: (data: { agentId: string; isTyping: boolean }) => void;
  applyQueue: (data: { agentId: string; depth: number }) => void;

  reset: (agentId: string) => void;
};

export const useMobileChatStore = create<MobileChatState>((set, get) => ({
  byAgent: {},

  getAgentState: (agentId) => getOrInit(get().byAgent, agentId),

  load: async (agentId) => {
    set((state) => ({
      byAgent: {
        ...state.byAgent,
        [agentId]: { ...getOrInit(state.byAgent, agentId), loading: true, error: null, loadMoreError: null },
      },
    }));
    try {
      const res = await apiClient.getPaginated<ConversationMessage>(
        `/api/agents/${agentId}/conversations?page=1&limit=${CONVERSATION_PAGE_SIZE_MOBILE}`
      );
      set((state) => ({
        byAgent: {
          ...state.byAgent,
          [agentId]: {
            ...getOrInit(state.byAgent, agentId),
            messages: res.data,
            page: 1,
            hasMore: res.pagination.hasMore,
            loading: false,
            loadMoreError: null,
          },
        },
      }));
    } catch {
      set((state) => ({
        byAgent: {
          ...state.byAgent,
          [agentId]: { ...getOrInit(state.byAgent, agentId), loading: false, error: '불러오지 못했습니다' },
        },
      }));
    }
  },

  // EVT-M02-4: 위로 스크롤 끝 도달 -> 이전 페이지를 앞에 붙인다 (스크롤 위치는 컴포넌트가 유지)
  loadMore: async (agentId) => {
    const current = getOrInit(get().byAgent, agentId);
    if (!current.hasMore || current.loadingMore) return;

    set((state) => ({
      byAgent: { ...state.byAgent, [agentId]: { ...current, loadingMore: true, loadMoreError: null } },
    }));
    try {
      const nextPage = current.page + 1;
      const res = await apiClient.getPaginated<ConversationMessage>(
        `/api/agents/${agentId}/conversations?page=${nextPage}&limit=${CONVERSATION_PAGE_SIZE_MOBILE}`
      );
      set((state) => {
        const latest = getOrInit(state.byAgent, agentId);
        return {
          byAgent: {
            ...state.byAgent,
            [agentId]: {
              ...latest,
              messages: [...res.data, ...latest.messages],
              page: nextPage,
              hasMore: res.pagination.hasMore,
              loadingMore: false,
              loadMoreError: null,
            },
          },
        };
      });
    } catch {
      // DF-011: 목록 맨 위 "불러오지 못했습니다 · 다시" — 다음 스크롤에서 자동 재시도하지 않고
      // 사용자가 [다시]를 눌러야 재시도한다 (loadMoreError가 남아 있는 동안 컴포넌트가 자동 호출을 막는다).
      set((state) => ({
        byAgent: {
          ...state.byAgent,
          [agentId]: { ...getOrInit(state.byAgent, agentId), loadingMore: false, loadMoreError: '불러오지 못했습니다' },
        },
      }));
    }
  },

  // EVT-M02-2: 전송 — 낙관적 버블 추가, 실패 시 버블에 실패 표시(다시 보내기 가능) + 입력 내용 복원(DF-009)
  send: async (agentId, content) => {
    const trimmed = content.trim();
    if (!trimmed) return false;

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: ConversationMessage = {
      id: tempId,
      timestamp: new Date().toISOString(),
      content: trimmed,
      type: 'instruction',
    };

    set((state) => {
      const current = getOrInit(state.byAgent, agentId);
      return {
        byAgent: {
          ...state.byAgent,
          [agentId]: { ...current, messages: [...current.messages, optimistic], sending: true },
        },
      };
    });

    try {
      await apiClient.post<ChatSendResponse>(`/api/agents/${agentId}/chat`, { content: trimmed });
      set((state) => ({
        byAgent: { ...state.byAgent, [agentId]: { ...getOrInit(state.byAgent, agentId), sending: false } },
      }));
      return true;
    } catch {
      set((state) => {
        const current = getOrInit(state.byAgent, agentId);
        return {
          byAgent: {
            ...state.byAgent,
            [agentId]: {
              ...current,
              sending: false,
              messages: current.messages.map((m) => (m.id === tempId ? { ...m, failed: true } : m)),
            },
          },
        };
      });
      return false;
    }
  },

  // EVT-M02-3: [다시 보내기] — 같은 버블로 재전송한다
  resend: async (agentId, messageId) => {
    const current = getOrInit(get().byAgent, agentId);
    const target = current.messages.find((m) => m.id === messageId);
    if (!target) return;

    set((state) => {
      const s = getOrInit(state.byAgent, agentId);
      return {
        byAgent: {
          ...state.byAgent,
          [agentId]: {
            ...s,
            sending: true,
            messages: s.messages.map((m) => (m.id === messageId ? { ...m, failed: false } : m)),
          },
        },
      };
    });

    try {
      await apiClient.post<ChatSendResponse>(`/api/agents/${agentId}/chat`, { content: target.content });
      set((state) => ({
        byAgent: { ...state.byAgent, [agentId]: { ...getOrInit(state.byAgent, agentId), sending: false } },
      }));
    } catch {
      set((state) => {
        const s = getOrInit(state.byAgent, agentId);
        return {
          byAgent: {
            ...state.byAgent,
            [agentId]: {
              ...s,
              sending: false,
              messages: s.messages.map((m) => (m.id === messageId ? { ...m, failed: true } : m)),
            },
          },
        };
      });
    }
  },

  // WS chat:message — EVT-M02-6. sender=user면 우리가 보낸 낙관적 버블을 실 id로 맞바꾼다.
  applyMessage: (message) => {
    set((state) => {
      const agentId = message.agentId;
      const current = getOrInit(state.byAgent, agentId);

      // BUG-008: 재연결 시 REST 재조회(load/loadMore)와 WS chat:message 수신이 겹치면
      // 같은 id의 메시지가 두 번 들어올 수 있다 — 이미 반영된 id면 버블을 새로 추가하지
      // 않는다(스트리밍/타이핑 상태만 정리한다).
      if (current.messages.some((m) => m.id === message.id)) {
        return {
          byAgent: {
            ...state.byAgent,
            [agentId]: { ...current, streaming: null, typing: false },
          },
        };
      }

      if (message.sender === 'user') {
        const tempIndex = current.messages.findIndex(
          (m) => m.type === 'instruction' && m.id.startsWith('temp-') && !m.failed && m.content === message.content
        );
        let messages: ConversationMessage[];
        if (tempIndex >= 0) {
          messages = current.messages.map((m, i) =>
            i === tempIndex ? { ...m, id: message.id, timestamp: message.createdAt } : m
          );
        } else {
          messages = [
            ...current.messages,
            { id: message.id, timestamp: message.createdAt, content: message.content, type: 'instruction' as const },
          ];
        }
        return { byAgent: { ...state.byAgent, [agentId]: { ...current, messages } } };
      }

      // 에이전트 응답 확정 — 스트리밍 버블을 지우고 확정 버블을 추가한다
      const confirmed: ConversationMessage = {
        id: message.id,
        timestamp: message.createdAt,
        content: message.content,
        type: 'report',
      };
      return {
        byAgent: {
          ...state.byAgent,
          [agentId]: {
            ...current,
            messages: [...current.messages, confirmed],
            streaming: null,
            typing: false,
          },
        },
      };
    });
  },

  // WS chat:stream — EVT-M02-5. 누적 갱신.
  applyStream: (data) => {
    set((state) => {
      const current = getOrInit(state.byAgent, data.agentId);
      const streaming: StreamingState =
        current.streaming && current.streaming.responseMsgId === data.responseMsgId
          ? { ...current.streaming, content: data.content }
          : { responseMsgId: data.responseMsgId, content: data.content };
      return { byAgent: { ...state.byAgent, [data.agentId]: { ...current, streaming } } };
    });
  },

  // WS chat:tool — "도구 실행 중: {tool}" 한 줄
  applyTool: (data) => {
    set((state) => {
      const current = getOrInit(state.byAgent, data.agentId);
      const streaming: StreamingState =
        current.streaming && current.streaming.responseMsgId === data.responseMsgId
          ? { ...current.streaming, tool: data.name }
          : { responseMsgId: data.responseMsgId, content: '', tool: data.name };
      return { byAgent: { ...state.byAgent, [data.agentId]: { ...current, streaming } } };
    });
  },

  // WS chat:typing
  applyTyping: (data) => {
    set((state) => {
      const current = getOrInit(state.byAgent, data.agentId);
      return { byAgent: { ...state.byAgent, [data.agentId]: { ...current, typing: data.isTyping } } };
    });
  },

  // WS chat:queue — "앞선 요청 {depth}건 처리 후 실행됩니다"
  applyQueue: (data) => {
    set((state) => {
      const current = getOrInit(state.byAgent, data.agentId);
      return { byAgent: { ...state.byAgent, [data.agentId]: { ...current, queueDepth: data.depth } } };
    });
  },

  reset: (agentId) => {
    set((state) => {
      const rest = { ...state.byAgent };
      delete rest[agentId];
      return { byAgent: rest };
    });
  },
}));
