/**
 * Agents API Routes 단위 테스트 (트리 빌드 로직 검증)
 * 대상 기능: F012 (에이전트 트리), F013 (전체 대시보드)
 * 시나리오 근거: SC-003 (에이전트 계층 표시), SC-022 (에이전트 흐름 추적)
 */
import { describe, it, expect } from 'vitest';

type AgentRow = {
  id: string;
  name: string;
  role: string;
  status: string;
  statusMessage: string | null;
  partId: string | null;
  parentId: string | null;
};

type TreeNode = {
  id: string;
  name: string;
  role: string;
  status: string;
  statusMessage?: string;
  partId?: string;
  children: TreeNode[];
};

function buildTree(allAgents: AgentRow[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  for (const agent of allAgents) {
    nodeMap.set(agent.id, {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      status: agent.status,
      statusMessage: agent.statusMessage ?? undefined,
      partId: agent.partId ?? undefined,
      children: [],
    });
  }

  const roots: TreeNode[] = [];
  for (const agent of allAgents) {
    const node = nodeMap.get(agent.id)!;
    if (agent.parentId && nodeMap.has(agent.parentId)) {
      nodeMap.get(agent.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

describe('Agents API - 트리 빌드 로직', () => {
  // SC-003: 4계층 구조 빌드
  it('flat 리스트에서 4계층 트리 빌드', () => {
    const agents: AgentRow[] = [
      { id: 'main', name: 'Main', role: 'main', status: 'active', statusMessage: null, partId: null, parentId: null },
      { id: 'part1', name: 'Part1', role: 'part', status: 'active', statusMessage: null, partId: 'p1', parentId: 'main' },
      { id: 'sub1', name: 'Sub1', role: 'sub', status: 'idle', statusMessage: null, partId: 'p1', parentId: 'part1' },
      { id: 'inst1', name: 'Inst1', role: 'instance', status: 'active', statusMessage: 'Working', partId: 'p1', parentId: 'sub1' },
    ];

    const tree = buildTree(agents);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('main');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe('part1');
    expect(tree[0].children[0].children[0].id).toBe('sub1');
    expect(tree[0].children[0].children[0].children[0].id).toBe('inst1');
    expect(tree[0].children[0].children[0].children[0].statusMessage).toBe('Working');
  });

  it('빈 에이전트 목록은 빈 트리 반환', () => {
    const tree = buildTree([]);
    expect(tree).toHaveLength(0);
  });

  it('부모 없는 에이전트는 루트로 처리', () => {
    const agents: AgentRow[] = [
      { id: 'a', name: 'A', role: 'main', status: 'idle', statusMessage: null, partId: null, parentId: null },
      { id: 'b', name: 'B', role: 'main', status: 'idle', statusMessage: null, partId: null, parentId: null },
    ];
    const tree = buildTree(agents);
    expect(tree).toHaveLength(2);
  });

  it('존재하지 않는 parentId를 가진 에이전트는 루트로 처리', () => {
    const agents: AgentRow[] = [
      { id: 'orphan', name: 'Orphan', role: 'part', status: 'idle', statusMessage: null, partId: null, parentId: 'nonexistent' },
    ];
    const tree = buildTree(agents);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('orphan');
  });

  it('여러 Part를 가진 Main', () => {
    const agents: AgentRow[] = [
      { id: 'main', name: 'Main', role: 'main', status: 'active', statusMessage: null, partId: null, parentId: null },
      { id: 'part1', name: 'Part1', role: 'part', status: 'active', statusMessage: null, partId: 'p1', parentId: 'main' },
      { id: 'part2', name: 'Part2', role: 'part', status: 'idle', statusMessage: null, partId: 'p2', parentId: 'main' },
      { id: 'part3', name: 'Part3', role: 'part', status: 'active', statusMessage: null, partId: 'p3', parentId: 'main' },
    ];
    const tree = buildTree(agents);
    expect(tree[0].children).toHaveLength(3);
  });

  // SC-003: null statusMessage는 undefined로 변환
  it('null 값은 undefined로 변환', () => {
    const agents: AgentRow[] = [
      { id: 'a', name: 'A', role: 'main', status: 'idle', statusMessage: null, partId: null, parentId: null },
    ];
    const tree = buildTree(agents);
    expect(tree[0].statusMessage).toBeUndefined();
    expect(tree[0].partId).toBeUndefined();
  });
});
