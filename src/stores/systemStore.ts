'use client';

import { create } from 'zustand';
import type { SystemHealth } from '@/types/settings';
import apiClient from '@/lib/api';

type RecoveryStatus = {
  phase: string;
  progress: number;
  recoveredAgents: string[];
} | null;

type SystemState = {
  health: SystemHealth | null;
  recoveryStatus: RecoveryStatus;
  isLoading: boolean;
  fetchHealth: () => Promise<void>;
  updateHealth: (health: Partial<SystemHealth>) => void;
  setRecoveryStatus: (status: RecoveryStatus) => void;
};

export const useSystemStore = create<SystemState>((set) => ({
  health: null,
  recoveryStatus: null,
  isLoading: false,

  fetchHealth: async () => {
    set({ isLoading: true });
    try {
      const res = await apiClient.get<SystemHealth>('/api/system/health');
      set({ health: res.data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  updateHealth: (partial) => {
    set((state) => ({
      health: state.health ? { ...state.health, ...partial } : null,
    }));
  },

  setRecoveryStatus: (status) => set({ recoveryStatus: status }),
}));
