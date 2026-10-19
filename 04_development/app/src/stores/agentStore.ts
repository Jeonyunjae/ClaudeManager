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
  statusMessage?: string,
  stoppedAt?: string
): AgentTreeNode[] {
  return nodes.map((node) => {
    if (node.id === agentId) {
      return {
        ...node,
        status: status as AgentTreeNode['status'],
        statusMessage: statusMessage ?? node.statusMessage,
        stoppedAt: stoppedAt ?? node.stoppedAt,
      };
    }
    return {
      ...node,
      children: updateStatusInTree(node.children, agentId, status, statusMessage, stoppedAt),
    };
  });
}

/** BUG-034: 새 에이전트를 부모 아래에 붙인다. 부모가 트리에 없으면 최상위에 둔다 */
export function insertIntoTree(nodes: AgentTreeNode[], agent: AgentTreeNode, parentId?: string): AgentTreeNode[] {
  if (!parentId) return [...nodes, agent];
  let placed = false;
  const walk = (list: AgentTreeNode[]): AgentTreeNode[] =>
    list.map((node) => {
      if (node.id === parentId) {
        placed = true;
        return { ...node, children: [...node.children.filter((c) => c.id !== agent.id), agent] };
      }
      return { ...node, children: walk(node.children) };
    });
  const next = walk(nodes);
  return placed ? next : [...nodes, agent];
}

type AgentState = {
  tree: AgentTreeNode[];
  agents: Map<string, AgentTreeNode>;
  mainAgentId: string | null;
  isLoading: boolean;
  initialized: boolean;
  error: string | null;
  fetchTree: () => Promise<void>;
  initMain: () => Promise<void>;
  updateAgentStatus: (agentId: string, status: string, statusMessage?: string, stoppedAt?: string) => void;
  addAgent: (agent: AgentTreeNode, parentId?: string) => void;
  removeAgent: (agentId: string) => void;
  getAgent: (id: string) => AgentTreeNode | undefined;
};

export const useAgentStore = create<AgentState>((set, get) => ({
  tree: [],
  agents: new Map(),
  mainAgentId: null,
  isLoading: false,
  initialized: false,
  error: null,

  initMain: async () => {
    console.log('[agentStore] initMain started');
    try {
      const res = await apiClient.post<{ agent: { id: string }; created: boolean }>('/api/agents/init-main', {});
      set({ mainAgentId: res.data.agent.id });
      console.log('[agentStore] initMain done:', res.data.agent.id);
    } catch (err) {
      console.error('[agentStore] initMain failed:', err);
    }
  },

  fetchTree: async () => {
    console.log('[agentStore] fetchTree started');
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.get<AgentTreeNode[]>('/api/agents/tree');
      const tree = res.data;
      console.log('[agentStore] fetchTree done:', tree.length, 'nodes');
      set({ tree, agents: flattenTree(tree), isLoading: false, initialized: true });
    } catch (err) {
      console.error('[agentStore] fetchTree failed:', err);
      set({ isLoading: false, initialized: true });
    }
  },

  updateAgentStatus: (agentId, status, statusMessage, stoppedAt) => {
    const { tree } = get();
    const newTree = updateStatusInTree(tree, agentId, status, statusMessage, stoppedAt);
    set({ tree: newTree, agents: flattenTree(newTree) });
  },

  addAgent: (agent, parentId) => {
    set((state) => {
      const newTree = insertIntoTree(state.tree, agent, parentId);
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
