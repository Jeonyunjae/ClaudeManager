'use client';

import { create } from 'zustand';
import apiClient from '@/lib/api';

type Part = {
  id: string;
  name: string;
  description?: string;
  skillName: string;
  skillVersion: string;
  sensitivityLevel: string;
  color?: string;
  status: string;
  agentCount: number;
  projectCount: number;
  createdAt: string;
};

type PartState = {
  parts: Part[];
  selectedPartId: string | null;
  isLoading: boolean;
  fetchParts: () => Promise<void>;
  selectPart: (id: string | null) => void;
};

export const usePartStore = create<PartState>((set) => ({
  parts: [],
  selectedPartId: null,
  isLoading: false,

  fetchParts: async () => {
    set({ isLoading: true });
    try {
      const res = await apiClient.get<Part[]>('/api/parts');
      set({ parts: res.data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  selectPart: (id) => set({ selectedPartId: id }),
}));
