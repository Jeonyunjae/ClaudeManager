'use client';

import { create } from 'zustand';
import type { AgentDetail, AgentConversation, AgentNote, AgentLog } from '@/types/agent';
import apiClient from '@/lib/api';

type ActiveTab = 'info' | 'cli' | 'chat' | 'log' | 'note';

/** 채팅 메시지에 딸린 부가 정보 (도구 사용·대기·취소 표시) */
export type ChatMeta = {
  tools?: { name: string; target?: string }[];
  queued?: boolean;
  cancelled?: boolean;
};

export type CLILogEntry = {
  timestamp: string;
  command: string;
  prompt: string;
  response: string;
  costUsd: number;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  isError: boolean;
};

export type CLISessionInfo = {
  sessionId: string | null;
  status: string;
  messageCount: number;
  startedAt: string | null;
  logs: CLILogEntry[];
};

export type NoteFolder = {
  name: string;
  path: string;
};

export type NoteFileEntry = {
  name: string;
  path: string;
  updatedAt: string;
};

export type NoteBrowseResult = {
  folders: NoteFolder[];
  files: NoteFileEntry[];
  current: string;
};

type AgentDetailState = {
  selectedAgent: AgentDetail | null;
  activeTab: ActiveTab;
  conversations: AgentConversation[];
  conversationPage: number;
  hasMoreConversations: boolean;
  isLoadingMore: boolean;
  notes: AgentNote[];
  noteFolders: NoteFolder[];
  noteCurrentPath: string;
  noteLoading: boolean;
  selectedNoteContent: AgentNote | null;
  noteContentLoading: boolean;
  logs: AgentLog[];
  logCostSummary: { totalCost: number; totalInputTokens: number; totalOutputTokens: number } | null;
  cliSession: CLISessionInfo | null;
  isOpen: boolean;
  isLoading: boolean;
  isSending: boolean;
  sendingAgents: Set<string>;
  isAgentSending: (agentId: string) => boolean;
  /** 에이전트별 대기 중인 질문 수 (서버 대기열을 WS로 받아 반영) */
  queueDepths: Record<string, number>;
  queueDepth: (agentId: string) => number;
  setQueueDepth: (agentId: string, depth: number) => void;
  markQueued: (messageId: string, queued: boolean) => void;
  markCancelled: (messageId: string) => void;
  cancelQueued: (agentId: string, messageId: string) => Promise<void>;
  openAgent: (agentId: string) => Promise<void>;
  closeAgent: () => void;
  setActiveTab: (tab: ActiveTab) => void;
  fetchConversations: (agentId: string) => Promise<void>;
  loadMoreConversations: (agentId: string) => Promise<void>;
  fetchNotes: (agentId: string, subpath?: string) => Promise<void>;
  fetchNoteContent: (agentId: string, filePath: string) => Promise<void>;
  fetchLogs: (agentId: string, search?: string) => Promise<void>;
  fetchCLILogs: (agentId: string) => Promise<void>;
  sendMessage: (agentId: string, content: string, attachments?: { filename: string; path: string; type: string }[]) => Promise<void>;
  cancelChat: (agentId: string) => Promise<void>;
  receiveWsMessage: (message: { id: string; sender: string; content: string; messageType: string; agentId: string }) => void;
  receiveWsStream: (data: { agentId: string; responseMsgId: string; content: string }) => void;
  receiveWsTool: (data: { agentId: string; responseMsgId: string; name: string; target?: string }) => void;
  receiveWsTyping: (data: { agentId: string; isTyping: boolean }) => void;
  addConversation: (conv: AgentConversation) => void;
  updateNote: (file: string, content: string) => void;
  saveNote: (agentId: string, file: string, content: string) => Promise<void>;
  deleteNote: (agentId: string, file: string) => Promise<void>;
  updateNotesPath: (agentId: string, notesPath: string) => Promise<void>;
};

export const useAgentDetailStore = create<AgentDetailState>((set, get) => ({
  selectedAgent: null,
  activeTab: 'info',
  conversations: [],
  conversationPage: 1,
  hasMoreConversations: false,
  isLoadingMore: false,
  notes: [],
  noteFolders: [],
  noteCurrentPath: '',
  noteLoading: false,
  selectedNoteContent: null,
  noteContentLoading: false,
  logs: [],
  logCostSummary: null,
  cliSession: null,
  isOpen: false,
  isLoading: false,
  isSending: false,
  sendingAgents: new Set<string>(),
  queueDepths: {},

  isAgentSending: (agentId: string) => {
    return get().sendingAgents.has(agentId);
  },

  queueDepth: (agentId: string) => get().queueDepths[agentId] ?? 0,

  setQueueDepth: (agentId, depth) =>
    set((state) => ({ queueDepths: { ...state.queueDepths, [agentId]: depth } })),

  markQueued: (messageId, queued) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === messageId ? { ...c, metadata: { ...(c.metadata ?? {}), queued } } : c
      ),
    })),

  markCancelled: (messageId) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === messageId
          ? { ...c, metadata: { ...(c.metadata ?? {}), queued: false, cancelled: true } }
          : c
      ),
    })),

  cancelQueued: async (agentId, messageId) => {
    try {
      await apiClient.del(`/api/agents/${agentId}/queued?messageId=${encodeURIComponent(messageId)}`);
      get().markCancelled(messageId);
    } catch {
      // 이미 실행이 시작됐으면 취소되지 않는다 — 표시도 바꾸지 않는다
    }
  },

  openAgent: async (agentId) => {
    // 팝업 안에서 설정을 바꾼 뒤 같은 에이전트를 다시 부르는 것은 새로고침이다 — 보던 탭을 유지한다.
    const { isOpen, selectedAgent, activeTab } = get();
    const refreshing = isOpen && selectedAgent?.id === agentId;
    set({ isOpen: true, isLoading: true });
    try {
      const res = await apiClient.get<AgentDetail>(`/api/agents/${agentId}`);
      // 새로 열 때는 대화 탭부터. Part/Instance는 대화 탭이 없어 정보 탭 (getTabsForRole 참조)
      const noChat = res.data.role === 'part' || res.data.role === 'instance';
      const tab: ActiveTab = refreshing ? activeTab : noChat ? 'info' : 'chat';
      set({ selectedAgent: res.data, isLoading: false, activeTab: tab });
      get().fetchConversations(agentId);
    } catch {
      set({ isLoading: false, ...(refreshing ? {} : { activeTab: 'info' as ActiveTab }) });
    }
  },

  closeAgent: () => {
    set({
      isOpen: false,
      selectedAgent: null,
      conversations: [],
      conversationPage: 1,
      hasMoreConversations: false,
      notes: [],
      noteFolders: [],
      noteCurrentPath: '',
      selectedNoteContent: null,
      logs: [],
      logCostSummary: null,
      cliSession: null,
    });
  },

  setActiveTab: (tab) => {
    set({ activeTab: tab });
    const agent = get().selectedAgent;
    if (!agent) return;

    switch (tab) {
      case 'cli':
        get().fetchCLILogs(agent.id);
        break;
      case 'chat':
        get().fetchConversations(agent.id);
        break;
      case 'note':
        get().fetchNotes(agent.id);
        break;
      case 'log':
        get().fetchLogs(agent.id);
        break;
    }
  },

  fetchConversations: async (agentId) => {
    try {
      const res = await apiClient.getPaginated<AgentConversation>(
        `/api/agents/${agentId}/conversations?page=1&limit=50`
      );
      set({
        conversations: res.data,
        conversationPage: 1,
        hasMoreConversations: res.pagination.hasMore,
      });
    } catch {}
  },

  loadMoreConversations: async (agentId) => {
    const { conversationPage, hasMoreConversations, isLoadingMore } = get();
    if (!hasMoreConversations || isLoadingMore) return;

    set({ isLoadingMore: true });
    try {
      const nextPage = conversationPage + 1;
      const res = await apiClient.getPaginated<AgentConversation>(
        `/api/agents/${agentId}/conversations?page=${nextPage}&limit=50`
      );
      set((state) => ({
        conversations: [...res.data, ...state.conversations],
        conversationPage: nextPage,
        hasMoreConversations: res.pagination.hasMore,
        isLoadingMore: false,
      }));
    } catch {
      set({ isLoadingMore: false });
    }
  },

  fetchNotes: async (agentId, subpath) => {
    set({ noteLoading: true });
    try {
      const query = subpath ? `?subpath=${encodeURIComponent(subpath)}` : '';
      const res = await apiClient.get<NoteBrowseResult>(`/api/agents/${agentId}/notes${query}`);
      set({
        notes: res.data.files as unknown as AgentNote[],
        noteFolders: res.data.folders,
        noteCurrentPath: res.data.current,
        noteLoading: false,
      });
    } catch {
      set({ noteLoading: false });
    }
  },

  fetchNoteContent: async (agentId, filePath) => {
    set({ noteContentLoading: true });
    try {
      const res = await apiClient.get<AgentNote>(`/api/agents/${agentId}/notes?file=${encodeURIComponent(filePath)}`);
      set({ selectedNoteContent: res.data, noteContentLoading: false });
    } catch {
      set({ noteContentLoading: false });
    }
  },

  fetchLogs: async (agentId, search) => {
    try {
      const url = search
        ? `/api/agents/${agentId}/logs?search=${encodeURIComponent(search)}`
        : `/api/agents/${agentId}/logs`;
      const res = await apiClient.get<{
        data: AgentLog[];
        costSummary: { totalCost: number; totalInputTokens: number; totalOutputTokens: number };
      }>(url as never);
      const raw = res as unknown as {
        data: AgentLog[];
        costSummary: { totalCost: number; totalInputTokens: number; totalOutputTokens: number };
      };
      set({ logs: raw.data, logCostSummary: raw.costSummary || null });
    } catch {}
  },

  fetchCLILogs: async (agentId) => {
    try {
      const res = await apiClient.get<CLISessionInfo>(`/api/agents/${agentId}/cli-logs`);
      set({ cliSession: res.data });
    } catch {}
  },

  sendMessage: async (agentId, content, attachments) => {
    // 답변 중이어도 막지 않는다. 서버 대기열이 순서를 지켜 처리한다.
    if (!content.trim()) return;
    const newSending = new Set(get().sendingAgents);
    newSending.add(agentId);
    set({ isSending: true, sendingAgents: newSending });

    const attachmentLabel = attachments && attachments.length > 0
      ? `\n\n📎 ${attachments.map(a => a.filename).join(', ')}`
      : '';

    const userMsg: AgentConversation = {
      id: `temp-${Date.now()}`,
      timestamp: new Date().toISOString(),
      fromAgent: 'user',
      toAgent: agentId,
      content: content.trim() + attachmentLabel,
      type: 'instruction',
    };
    set((state) => ({ conversations: [...state.conversations, userMsg] }));

    // Request browser notification permission early
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    try {
      // Server returns immediately — CLI runs in background
      await apiClient.post<{
        userMessage: { id: string; sender: string; content: string };
        status: string;
        responseMsgId: string;
      }>(`/api/agents/${agentId}/chat`, { content: content.trim(), attachments });

      // isSending stays true — will be cleared when WS response arrives
    } catch {
      const errSending = new Set(get().sendingAgents);
      errSending.delete(agentId);
      set({ isSending: errSending.size > 0, sendingAgents: errSending });
      const errMsg: AgentConversation = {
        id: `err-${Date.now()}`,
        timestamp: new Date().toISOString(),
        fromAgent: 'system',
        toAgent: 'user',
        content: 'Failed to send message. Check if CLI is authenticated.',
        type: 'report',
      };
      set((state) => ({ conversations: [...state.conversations, errMsg] }));
    }
  },

  cancelChat: async (agentId) => {
    try {
      await apiClient.post(`/api/agents/${agentId}/cancel-chat`, {});
    } catch {
      // ignore
    }
    const s = new Set(get().sendingAgents);
    s.delete(agentId);
    set({ isSending: s.size > 0, sendingAgents: s });
  },

  /**
   * Called when a WebSocket chat:message arrives with the agent's response.
   */
  receiveWsMessage: (message: { id: string; sender: string; content: string; messageType: string; agentId: string }) => {
    if (message.sender === 'user') return;
    const selected = get().selectedAgent;
    if (selected && message.agentId !== selected.id) return;

    const agentMsg: AgentConversation = {
      id: message.id,
      timestamp: new Date().toISOString(),
      fromAgent: message.sender,
      toAgent: 'user',
      content: message.content,
      type: 'report',
    };
    // Replace streaming message with final message
    const streamId = `stream-${message.id}`;
    const doneSending = new Set(get().sendingAgents);
    doneSending.delete(message.agentId);
    set((state) => ({
      conversations: [
        ...state.conversations.filter((c) => c.id !== streamId),
        agentMsg,
      ],
      isSending: doneSending.size > 0,
      sendingAgents: doneSending,
    }));

    // Browser notification
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const preview = message.content.length > 100
        ? message.content.substring(0, 100) + '…'
        : message.content;
      new Notification(`${message.sender} 응답 완료`, {
        body: preview,
        icon: '/next.svg',
        tag: `chat-${message.id}`,
      });
    }
  },

  /**
   * Called when WS chat:stream event arrives (real-time token streaming).
   */
  receiveWsStream: (data: { agentId: string; responseMsgId: string; content: string }) => {
    const selected = get().selectedAgent;
    if (selected && data.agentId !== selected.id) return;

    const state = get();
    const streamId = `stream-${data.responseMsgId}`;
    const existing = state.conversations.find((c) => c.id === streamId);

    if (existing) {
      set({
        conversations: state.conversations.map((c) =>
          c.id === streamId ? { ...c, content: data.content } : c
        ),
      });
    } else {
      const streamMsg: AgentConversation = {
        id: streamId,
        timestamp: new Date().toISOString(),
        fromAgent: '...',
        toAgent: 'user',
        content: data.content,
        type: 'report',
      };
      set({ conversations: [...state.conversations, streamMsg] });
    }
  },

  /**
   * 에이전트가 도구를 실행할 때마다 도착. 스트리밍 말풍선에 누적 표시한다.
   * 응답이 확정되면 서버가 metadata.tools 로 다시 내려주므로 새로고침해도 남는다.
   */
  receiveWsTool: (data) => {
    const selected = get().selectedAgent;
    if (selected && data.agentId !== selected.id) return;

    const state = get();
    const streamId = `stream-${data.responseMsgId}`;
    const entry = { name: data.name, target: data.target };
    const existing = state.conversations.find((c) => c.id === streamId);

    if (existing) {
      set({
        conversations: state.conversations.map((c) =>
          c.id === streamId
            ? { ...c, metadata: { ...(c.metadata ?? {}), tools: [...(c.metadata?.tools ?? []), entry] } }
            : c
        ),
      });
      return;
    }

    // 아직 본문이 한 글자도 안 왔을 때도 도구는 보여야 한다
    const placeholder: AgentConversation = {
      id: streamId,
      timestamp: new Date().toISOString(),
      fromAgent: '...',
      toAgent: 'user',
      content: '',
      type: 'report',
      metadata: { tools: [entry] },
    };
    set({ conversations: [...state.conversations, placeholder] });
  },

  /**
   * Called when WS chat:typing event arrives.
   */
  receiveWsTyping: (data: { agentId: string; isTyping: boolean }) => {
    if (!data.isTyping) {
      // Typing stopped but no message yet — don't clear isSending here,
      // it will be cleared when receiveWsMessage fires
    }
  },

  addConversation: (conv) => {
    set((state) => ({ conversations: [...state.conversations, conv] }));
  },

  updateNote: (file, content) => {
    set((state) => ({
      notes: state.notes.map((n) =>
        n.file === file ? { ...n, content, updatedAt: new Date().toISOString() } : n
      ),
    }));
  },

  saveNote: async (agentId, file, content) => {
    const res = await apiClient.post<AgentNote>(`/api/agents/${agentId}/notes`, { file, content });
    const saved = res.data;
    set((state) => {
      const exists = state.notes.some((n) => n.file === saved.file);
      if (exists) {
        return { notes: state.notes.map((n) => n.file === saved.file ? saved : n) };
      }
      return { notes: [...state.notes, saved] };
    });
  },

  deleteNote: async (agentId, file) => {
    await apiClient.del(`/api/agents/${agentId}/notes?file=${encodeURIComponent(file)}`);
    set((state) => ({
      notes: state.notes.filter((n) => n.file !== file),
    }));
  },

  updateNotesPath: async (agentId, notesPath) => {
    const res = await apiClient.put<AgentDetail>(`/api/agents/${agentId}`, { notesPath });
    set({ selectedAgent: res.data });
  },
}));
