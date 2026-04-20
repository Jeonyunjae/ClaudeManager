'use client';

import { create } from 'zustand';
import { apiClient } from '@/lib/api';

export type Priority = 'urgent' | 'high' | 'normal' | 'low';

export interface ProjectWithPriority {
  id: string;
  name: string;
  priority: Priority;
  status: string;
  currentStage?: string;
  progressPercent: number;
  partId: string;
}

type PriorityState = {
  projects: ProjectWithPriority[];
  isLoading: boolean;
  error: string | null;

  fetchProjects: () => Promise<void>;
  updatePriority: (projectId: string, priority: Priority) => Promise<void>;
  reorderProjects: (projectIds: string[]) => Promise<void>;
};

export const usePriorityStore = create<PriorityState>((set, get) => ({
  projects: [],
  isLoading: false,
  error: null,

  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.get<ProjectWithPriority[]>('/api/projects');
      const data = (res as any)?.data ?? res;
      set({ projects: Array.isArray(data) ? data : [], isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  updatePriority: async (projectId: string, priority: Priority) => {
    try {
      await apiClient.put(`/api/projects/${projectId}/priority`, { priority });
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId ? { ...p, priority } : p
        ),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  reorderProjects: async (projectIds: string[]) => {
    try {
      await apiClient.put('/api/projects/reorder', { projectIds });
      await get().fetchProjects();
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },
}));
