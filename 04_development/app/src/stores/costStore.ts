'use client';

import { create } from 'zustand';
import type { CostSummary, CostByModel, CostTrend, CostPeriod } from '@/types/cost';
import apiClient from '@/lib/api';

type CostState = {
  summary: CostSummary | null;
  byModel: CostByModel[];
  trend: CostTrend[];
  period: CostPeriod;
  isLoading: boolean;
  setPeriod: (period: CostPeriod) => void;
  fetchSummary: () => Promise<void>;
  fetchByModel: () => Promise<void>;
  fetchTrend: () => Promise<void>;
  fetchAll: () => Promise<void>;
  updateSummary: (summary: Partial<CostSummary>) => void;
};

export const useCostStore = create<CostState>((set, get) => ({
  summary: null,
  byModel: [],
  trend: [],
  period: 'month',
  isLoading: false,

  setPeriod: (period) => {
    set({ period });
    get().fetchAll();
  },

  fetchSummary: async () => {
    const { period } = get();
    try {
      const res = await apiClient.get<CostSummary>(`/api/cost/summary?period=${period}`);
      set({ summary: res.data });
    } catch {}
  },

  fetchByModel: async () => {
    const { period } = get();
    try {
      const res = await apiClient.get<CostByModel[]>(`/api/cost/by-model?period=${period}`);
      set({ byModel: res.data });
    } catch {}
  },

  fetchTrend: async () => {
    const { period } = get();
    try {
      const res = await apiClient.get<CostTrend[]>(`/api/cost/trend?period=${period}`);
      set({ trend: res.data });
    } catch {}
  },

  fetchAll: async () => {
    set({ isLoading: true });
    await Promise.all([get().fetchSummary(), get().fetchByModel(), get().fetchTrend()]);
    set({ isLoading: false });
  },

  updateSummary: (partial) => {
    set((state) => ({
      summary: state.summary ? { ...state.summary, ...partial } : null,
    }));
  },
}));
