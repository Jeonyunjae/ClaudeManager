'use client';

import { create } from 'zustand';
import apiClient from '@/lib/api';

/** DES-002 §GET /api/inbox 응답 항목 */
export type InboxItem = {
  agentId: string;
  agentName: string;
  role: string;
  agentStatus: string;
  lastMessageId: string;
  preview: string;
  lastMessageAt: string;
};

type InboxApiResponse = {
  data: InboxItem[];
  meta: { count: number };
};

type InboxState = {
  items: InboxItem[];
  count: number;
  loading: boolean;
  error: string | null;
  fetchInbox: () => Promise<void>;
  ack: (agentId: string) => Promise<void>;
};

export const useInboxStore = create<InboxState>((set, get) => ({
  items: [],
  count: 0,
  loading: false,
  error: null,

  fetchInbox: async () => {
    set({ loading: true, error: null });
    try {
      const res = (await apiClient.get<InboxItem[]>('/api/inbox')) as unknown as InboxApiResponse;
      set({ items: res.data, count: res.meta?.count ?? res.data.length, loading: false });
    } catch {
      set({ loading: false, error: '불러오지 못했습니다' });
    }
  },

  // EVT-M01-2: 확인함 — 낙관적으로 카드를 제거하고, 실패하면 되돌린다.
  ack: async (agentId: string) => {
    const prevItems = get().items;
    if (!prevItems.some((i) => i.agentId === agentId)) return;

    const nextItems = prevItems.filter((i) => i.agentId !== agentId);
    set({ items: nextItems, count: nextItems.length, error: null });

    try {
      await apiClient.post(`/api/inbox/${agentId}/ack`, {});
    } catch {
      set({ items: prevItems, count: prevItems.length, error: '처리 실패 — 다시 시도' });
    }
  },
}));
