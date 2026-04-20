'use client';

import { create } from 'zustand';
import type { Approval } from '@/types/approval';
import apiClient from '@/lib/api';

type ApprovalState = {
  pendingList: Approval[];
  isLoading: boolean;
  fetchPending: () => Promise<void>;
  approve: (id: string, comment?: string) => Promise<void>;
  reject: (id: string, comment: string) => Promise<void>;
  modify: (id: string, comment: string) => Promise<void>;
  addPending: (approval: Approval) => void;
  removePending: (id: string) => void;
};

export const useApprovalStore = create<ApprovalState>((set, get) => ({
  pendingList: [],
  isLoading: false,

  fetchPending: async () => {
    set({ isLoading: true });
    try {
      const res = await apiClient.get<Approval[]>('/api/approvals/pending');
      set({ pendingList: res.data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  approve: async (id, comment) => {
    await apiClient.post(`/api/approvals/${id}/approve`, { comment });
    set((state) => ({
      pendingList: state.pendingList.filter((a) => a.id !== id),
    }));
  },

  reject: async (id, comment) => {
    await apiClient.post(`/api/approvals/${id}/reject`, { comment });
    set((state) => ({
      pendingList: state.pendingList.filter((a) => a.id !== id),
    }));
  },

  modify: async (id, comment) => {
    await apiClient.post(`/api/approvals/${id}/modify`, { comment });
    set((state) => ({
      pendingList: state.pendingList.filter((a) => a.id !== id),
    }));
  },

  addPending: (approval) => {
    set((state) => ({
      pendingList: [approval, ...state.pendingList],
    }));
  },

  removePending: (id) => {
    set((state) => ({
      pendingList: state.pendingList.filter((a) => a.id !== id),
    }));
  },
}));
