'use client';

import { create } from 'zustand';
import type { ChatMessage } from '@/types/chat';
import apiClient from '@/lib/api';
import wsClient from '@/lib/ws';

type ChatState = {
  messages: ChatMessage[];
  input: string;
  isTyping: boolean;
  isLoading: boolean;
  hasMore: boolean;
  page: number;
  setInput: (input: string) => void;
  sendMessage: () => Promise<void>;
  loadMessages: (page?: number) => Promise<void>;
  loadMore: () => Promise<void>;
  addMessage: (message: ChatMessage) => void;
  setTyping: (isTyping: boolean) => void;
};

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  input: '',
  isTyping: false,
  isLoading: false,
  hasMore: true,
  page: 1,

  setInput: (input) => set({ input }),

  sendMessage: async () => {
    const { input } = get();
    if (!input.trim()) return;

    set({ input: '' });

    try {
      wsClient.send('chat:send', { content: input });
    } catch (err) {
      // Fallback to REST
      try {
        await apiClient.post('/api/chat/send', { content: input });
      } catch {
        console.error('Failed to send message');
      }
    }
  },

  loadMessages: async (page = 1) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.getPaginated<ChatMessage>(
        `/api/chat/messages?page=${page}&limit=50`
      );
      if (page === 1) {
        set({
          messages: res.data.reverse(),
          hasMore: res.pagination.hasMore,
          page,
          isLoading: false,
        });
      } else {
        set((state) => ({
          messages: [...res.data.reverse(), ...state.messages],
          hasMore: res.pagination.hasMore,
          page,
          isLoading: false,
        }));
      }
    } catch {
      set({ isLoading: false });
    }
  },

  loadMore: async () => {
    const { hasMore, page, isLoading } = get();
    if (!hasMore || isLoading) return;
    await get().loadMessages(page + 1);
  },

  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages, message],
    }));
  },

  setTyping: (isTyping) => set({ isTyping }),
}));
