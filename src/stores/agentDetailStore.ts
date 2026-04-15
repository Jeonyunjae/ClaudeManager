'use client';

import { create } from 'zustand';
import type { AgentDetail, AgentConversation, AgentNote, AgentLog } from '@/types/agent';
import apiClient from '@/lib/api';

type ActiveTab = 'conversation' | 'note' | 'log' | 'terminal';

type AgentDetailState = {
  selectedAgent: AgentDetail | null;
  activeTab: ActiveTab;
  conversations: AgentConversation[];
  notes: AgentNote[];
  logs: AgentLog[];
  isOpen: boolean;
  isLoading: boolean;
  openAgent: (agentId: string) => Promise<void>;
  closeAgent: () => void;
  setActiveTab: (tab: ActiveTab) => void;
  fetchConversations: (agentId: string) => Promise<void>;
  fetchNotes: (agentId: string) => Promise<void>;
  fetchLogs: (agentId: string, search?: string) => Promise<void>;
  updateNote: (file: string, content: string) => void;
};

export const useAgentDetailStore = create<AgentDetailState>((set, get) => ({
  selectedAgent: null,
  activeTab: 'conversation',
  conversations: [],
  notes: [],
  logs: [],
  isOpen: false,
  isLoading: false,

  openAgent: async (agentId) => {
    set({ isOpen: true, isLoading: true, activeTab: 'conversation' });
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
      notes: [],
      logs: [],
    });
  },

  setActiveTab: (tab) => {
    set({ activeTab: tab });
    const agent = get().selectedAgent;
    if (!agent) return;

    switch (tab) {
      case 'conversation':
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
        `/api/agents/${agentId}/conversations`
      );
      set({ conversations: res.data });
    } catch {}
  },

  fetchNotes: async (agentId) => {
    try {
      const res = await apiClient.get<AgentNote[]>(`/api/agents/${agentId}/notes`);
      set({ notes: res.data });
    } catch {}
  },

  fetchLogs: async (agentId, search) => {
    try {
      const url = search
        ? `/api/agents/${agentId}/logs?search=${encodeURIComponent(search)}`
        : `/api/agents/${agentId}/logs`;
      const res = await apiClient.getPaginated<AgentLog>(url);
      set({ logs: res.data });
    } catch {}
  },

  updateNote: (file, content) => {
    set((state) => ({
      notes: state.notes.map((n) =>
        n.file === file ? { ...n, content, updatedAt: new Date().toISOString() } : n
      ),
    }));
  },
}));
