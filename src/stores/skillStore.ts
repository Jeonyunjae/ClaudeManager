'use client';

import { create } from 'zustand';
import type { Skill, SkillSchema } from '@/types/skill';
import apiClient from '@/lib/api';

type SkillState = {
  skills: Skill[];
  selectedSkill: Skill | null;
  schema: SkillSchema | null;
  formData: Record<string, unknown>;
  isLoading: boolean;
  fetchSkills: () => Promise<void>;
  selectSkill: (skill: Skill | null) => void;
  fetchSchema: (name: string) => Promise<void>;
  setFormField: (key: string, value: unknown) => void;
  execute: (name: string) => Promise<{ partId: string }>;
};

export const useSkillStore = create<SkillState>((set, get) => ({
  skills: [],
  selectedSkill: null,
  schema: null,
  formData: {},
  isLoading: false,

  fetchSkills: async () => {
    set({ isLoading: true });
    try {
      const res = await apiClient.get<Skill[]>('/api/skills');
      set({ skills: res.data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  selectSkill: (skill) => set({ selectedSkill: skill, schema: null, formData: {} }),

  fetchSchema: async (name) => {
    try {
      const res = await apiClient.get<SkillSchema>(`/api/skills/${name}/schema`);
      set({ schema: res.data });
    } catch {}
  },

  setFormField: (key, value) => {
    set((state) => ({
      formData: { ...state.formData, [key]: value },
    }));
  },

  execute: async (name) => {
    const { formData } = get();
    const res = await apiClient.post<{ partId: string; status: string }>(
      `/api/skills/${name}/execute`,
      { input: formData }
    );
    return { partId: res.data.partId };
  },
}));
