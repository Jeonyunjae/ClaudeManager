'use client';

import { create } from 'zustand';
import apiClient from '@/lib/api';

type ReportType = 'progress' | 'decisions' | 'flow';

type ReportState = {
  selectedType: ReportType;
  dateRange: { from?: string; to?: string };
  reports: unknown[];
  isLoading: boolean;
  setType: (type: ReportType) => void;
  setDateRange: (from?: string, to?: string) => void;
  fetchReports: (partId?: string) => Promise<void>;
};

export const useReportStore = create<ReportState>((set, get) => ({
  selectedType: 'progress',
  dateRange: {},
  reports: [],
  isLoading: false,

  setType: (type) => {
    set({ selectedType: type });
    get().fetchReports();
  },

  setDateRange: (from, to) => {
    set({ dateRange: { from, to } });
    get().fetchReports();
  },

  fetchReports: async (partId) => {
    set({ isLoading: true });
    const { selectedType, dateRange } = get();
    const params = new URLSearchParams();
    if (partId) params.set('partId', partId);
    if (dateRange.from) params.set('from', dateRange.from);
    if (dateRange.to) params.set('to', dateRange.to);

    try {
      const res = await apiClient.get<unknown[]>(
        `/api/reports/${selectedType}?${params.toString()}`
      );
      set({ reports: res.data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },
}));
