'use client';

import { create } from 'zustand';
import type { GlobalSettings } from '@/types/settings';
import apiClient from '@/lib/api';

type SettingsState = {
  settings: GlobalSettings | null;
  isLoading: boolean;
  fetchSettings: () => Promise<void>;
  updateSettings: (settings: Partial<GlobalSettings>) => Promise<void>;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  isLoading: false,

  fetchSettings: async () => {
    set({ isLoading: true });
    try {
      const res = await apiClient.get<GlobalSettings>('/api/settings');
      set({ settings: res.data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  updateSettings: async (newSettings) => {
    await apiClient.put('/api/settings', newSettings);
    set((state) => ({
      settings: state.settings ? { ...state.settings, ...newSettings } : null,
    }));
  },
}));
