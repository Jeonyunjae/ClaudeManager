'use client';

import { create } from 'zustand';

type ViewMode = 'office' | 'split';

type OfficeState = {
  cameraPosition: [number, number, number];
  zoom: number;
  selectedCharacterId: string | null;
  viewMode: ViewMode;
  isChatOpen: boolean;
  setCameraPosition: (pos: [number, number, number]) => void;
  setZoom: (zoom: number) => void;
  selectCharacter: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;
};

export const useOfficeStore = create<OfficeState>((set) => ({
  cameraPosition: [10, 10, 10],
  zoom: 1,
  selectedCharacterId: null,
  viewMode: 'office',
  isChatOpen: false,

  setCameraPosition: (pos) => set({ cameraPosition: pos }),
  setZoom: (zoom) => set({ zoom }),
  selectCharacter: (id) => set({ selectedCharacterId: id }),
  setViewMode: (mode) => set({ viewMode: mode }),
  toggleChat: () => set((s) => ({ isChatOpen: !s.isChatOpen })),
  openChat: () => set({ isChatOpen: true }),
  closeChat: () => set({ isChatOpen: false }),
}));
