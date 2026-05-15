'use client';

import { create } from 'zustand';
import type { AgentDetail, AgentConversation, AgentNote, AgentLog } from '@/types/agent';
import apiClient from '@/lib/api';

type ActiveTab = 'info' | 'cli' | 'chat' | 'log' | 'note';

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

  isAgentSending: (agentId: string) => {
    return get().sendingAgents.has(agentId);
  },

  openAgent: async (agentId) => {
    set({ isOpen: true, isLoading: true, activeTab: 'info' });
    try {
      const res = await apiClient.get<AgentDetail>(`/api/agents/${agentId}`);
      set({ selectedAgent: res.data, isLoading: false });
      get().fetchConversations(agentId);
    } catch {
      set({ isLoading: false });
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
    if (!content.trim() || get().sendingAgents.has(agentId)) return;
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
