'use client';

import { create } from 'zustand';

type SortOrder = 'priority' | 'name' | 'progress' | 'updated';
type FilterState = {
  status: string | null;
  priority: string | null;
  partId: string | null;
};

type WorkspaceState = {
  // 4-column dashboard state
  selectedProjectId: string | null;
  columnLayout: 'default' | 'wide-chat' | 'wide-projects';
  sortOrder: SortOrder;
  filterState: FilterState;
  isChatOpen: boolean;

  // Agent detail popup
  selectedAgentId: string | null;

  // UI state
  showApprovalBanner: boolean;
  newDepartmentId: string | null;
  sidebarCollapsed: boolean;

  // Actions
  setSelectedProjectId: (id: string | null) => void;
  setColumnLayout: (layout: 'default' | 'wide-chat' | 'wide-projects') => void;
  setSortOrder: (order: SortOrder) => void;
  setFilter: (filter: Partial<FilterState>) => void;
  resetFilter: () => void;
  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;
  setSelectedAgentId: (id: string | null) => void;
  setShowApprovalBanner: (show: boolean) => void;
  setNewDepartmentId: (id: string | null) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  selectedProjectId: null,
  columnLayout: 'default',
  sortOrder: 'priority',
  filterState: { status: null, priority: null, partId: null },
  isChatOpen: true,
  selectedAgentId: null,
  showApprovalBanner: true,
  newDepartmentId: null,
  sidebarCollapsed: false,

  setSelectedProjectId: (id) => set({ selectedProjectId: id }),
  setColumnLayout: (layout) => set({ columnLayout: layout }),
  setSortOrder: (order) => set({ sortOrder: order }),
  setFilter: (filter) =>
    set((s) => ({ filterState: { ...s.filterState, ...filter } })),
  resetFilter: () =>
    set({ filterState: { status: null, priority: null, partId: null } }),
  toggleChat: () => set((s) => ({ isChatOpen: !s.isChatOpen })),
  openChat: () => set({ isChatOpen: true }),
  closeChat: () => set({ isChatOpen: false }),
  setSelectedAgentId: (id) => set({ selectedAgentId: id }),
  setShowApprovalBanner: (show) => set({ showApprovalBanner: show }),
  setNewDepartmentId: (id) => set({ newDepartmentId: id }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
