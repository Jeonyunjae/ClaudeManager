'use client';

import { create } from 'zustand';
import apiClient from '@/lib/api';

/** GET /api/agents/{id}/notes 목록 응답 (FEAT-002) */
export type DocsFolder = { name: string; path: string };
export type DocsFile = { name: string; path: string; updatedAt: string };
export type DocsRoot = { source: 'custom' | 'project' | 'projects' | 'none'; path: string | null; readOnly: boolean };
export type DocsListing = { folders: DocsFolder[]; files: DocsFile[]; current: string; root?: DocsRoot };
export type DocsFileContent = { file: string; content: string; updatedAt: string };

type MobileDocsState = {
  /** 마지막으로 불러온 목록 — agentId·path가 맞을 때만 화면이 쓴다 */
  listing: (DocsListing & { agentId: string; path: string }) | null;
  doc: (DocsFileContent & { agentId: string }) | null;
  loading: boolean;
  error: string | null;
  loadFolder: (agentId: string, path: string) => Promise<void>;
  loadFile: (agentId: string, file: string) => Promise<void>;
};

/** 모바일 문서 화면 (FEAT-003) — 노트 API를 읽기만 한다 */
export const useMobileDocsStore = create<MobileDocsState>((set) => ({
  listing: null,
  doc: null,
  loading: false,
  error: null,

  loadFolder: async (agentId, path) => {
    set({ loading: true, error: null });
    try {
      const query = path ? `?subpath=${encodeURIComponent(path)}` : '';
      const res = await apiClient.get<DocsListing>(`/api/agents/${agentId}/notes${query}`);
      set({ listing: { ...res.data, agentId, path }, loading: false });
    } catch {
      set({ loading: false, error: '불러오지 못했습니다' });
    }
  },

  loadFile: async (agentId, file) => {
    set({ loading: true, error: null });
    try {
      const res = await apiClient.get<DocsFileContent>(`/api/agents/${agentId}/notes?file=${encodeURIComponent(file)}`);
      set({ doc: { ...res.data, agentId }, loading: false });
    } catch {
      set({ loading: false, error: '문서를 열지 못했습니다' });
    }
  },
}));
