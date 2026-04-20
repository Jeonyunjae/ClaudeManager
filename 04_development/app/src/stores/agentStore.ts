'use client';

import { create } from 'zustand';
import type { AgentTreeNode } from '@/types/agent';
import apiClient from '@/lib/api';

function flattenTree(nodes: AgentTreeNode[]): Map<string, AgentTreeNode> {
  const map = new Map<string, AgentTreeNode>();
  function walk(node: AgentTreeNode): void {
    map.set(node.id, node);
    node.children.forEach(walk);
  }
  nodes.forEach(walk);
  return map;
}

function updateStatusInTree(
  nodes: AgentTreeNode[],
  agentId: string,
  status: string,
  statusMessage?: string
): AgentTreeNode[] {
  return nodes.map((node) => {
    if (node.id === agentId) {
      return {
        ...node,
        status: status as AgentTreeNode['status'],
        statusMessage: statusMessage ?? node.statusMessage,
      };
    }
    return {
      ...node,
      children: updateStatusInTree(node.children, agentId, status, statusMessage),
    };
  });
}

type AgentState = {
  tree: AgentTreeNode[];
  agents: Map<string, AgentTreeNode>;
  mainAgentId: string | null;
  isLoading: boolean;
  error: string | null;
  fetchTree: () => Promise<void>;
  initMain: () => Promise<void>;
  updateAgentStatus: (agentId: string, status: string, statusMessage?: string) => void;
  addAgent: (agent: AgentTreeNode) => void;
  removeAgent: (agentId: string) => void;
  getAgent: (id: string) => AgentTreeNode | undefined;
};

export const useAgentStore = create<AgentState>((set, get) => ({
  tree: [],
  agents: new Map(),
  mainAgentId: null,
  isLoading: false,
  error: null,

  initMain: async () => {
    try {
      const res = await apiClient.post<{ agent: { id: string }; created: boolean }>('/api/agents/init-main', {});
      set({ mainAgentId: res.data.agent.id });
    } catch {
      // silent fail
    }
  },

  fetchTree: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.get<AgentTreeNode[]>('/api/agents/tree');
      const tree = res.data;
      set({ tree, agents: flattenTree(tree), isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  updateAgentStatus: (agentId, status, statusMessage) => {
    const { tree } = get();
    const newTree = updateStatusInTree(tree, agentId, status, statusMessage);
    set({ tree: newTree, agents: flattenTree(newTree) });
  },

  addAgent: (agent) => {
    set((state) => {
      const newTree = [...state.tree, agent];
      return { tree: newTree, agents: flattenTree(newTree) };
    });
  },

  removeAgent: (agentId) => {
    function removeFromTree(nodes: AgentTreeNode[]): AgentTreeNode[] {
      return nodes
        .filter((n) => n.id !== agentId)
        .map((n) => ({ ...n, children: removeFromTree(n.children) }));
    }
    set((state) => {
      const newTree = removeFromTree(state.tree);
      return { tree: newTree, agents: flattenTree(newTree) };
    });
  },

  getAgent: (id) => {
    return get().agents.get(id);
  },
}));
