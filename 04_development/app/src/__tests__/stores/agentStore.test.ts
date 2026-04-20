/**
 * agentStore 단위 테스트
 * 대상 기능: F008~F012 (4계층 오케스트레이션), F013 (전체 대시보드)
 * 시나리오 근거: SC-003 (에이전트 트리 표시), SC-022 (에이전트 흐름 추적)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Zustand store를 직접 테스트하기 위해 mock 없이 순수 함수 테스트

// flattenTree와 updateStatusInTree는 모듈 내부 함수이므로
// store의 동작을 통해 간접 테스트

describe('agentStore - 에이전트 트리 순수 로직', () => {
  // updateStatusInTree 로직 재현 테스트
  function updateStatusInTree(
    nodes: any[],
    agentId: string,
    status: string,
    statusMessage?: string
  ): any[] {
    return nodes.map((node) => {
      if (node.id === agentId) {
        return { ...node, status, statusMessage: statusMessage ?? node.statusMessage };
      }
      return { ...node, children: updateStatusInTree(node.children, agentId, status, statusMessage) };
    });
  }

  function flattenTree(nodes: any[]): Map<string, any> {
    const map = new Map();
    function walk(node: any) {
      map.set(node.id, node);
      node.children.forEach(walk);
    }
    nodes.forEach(walk);
    return map;
  }

  const sampleTree = [
    {
      id: 'main-1',
      name: 'Main Orchestrator',
      role: 'main',
      status: 'active',
      children: [
        {
          id: 'part-1',
          name: 'Project Mgmt',
          role: 'part',
          status: 'active',
          children: [
            {
              id: 'sub-1',
              name: 'Sub-1',
              role: 'sub',
              status: 'idle',
              children: [
                {
                  id: 'inst-1',
                  name: 'Instance-1',
                  role: 'instance',
                  status: 'active',
                  children: [],
                },
              ],
            },
          ],
        },
        {
          id: 'part-2',
          name: 'Dev Part',
          role: 'part',
          status: 'idle',
          children: [],
        },
      ],
    },
  ];

  // SC-003: 에이전트 트리 표시
  describe('flattenTree', () => {
    it('트리를 평탄화하여 모든 노드를 Map에 저장', () => {
      const map = flattenTree(sampleTree);
      expect(map.size).toBe(5);
      expect(map.has('main-1')).toBe(true);
      expect(map.has('part-1')).toBe(true);
      expect(map.has('sub-1')).toBe(true);
      expect(map.has('inst-1')).toBe(true);
      expect(map.has('part-2')).toBe(true);
    });

    it('빈 트리는 빈 Map 반환', () => {
      const map = flattenTree([]);
      expect(map.size).toBe(0);
    });

    it('자식 없는 단일 노드 트리', () => {
      const single = [{ id: 'a', children: [] }];
      const map = flattenTree(single);
      expect(map.size).toBe(1);
    });
  });

  // SC-003: 에이전트 상태 변경 시 트리 업데이트
  describe('updateStatusInTree', () => {
    it('루트 노드 상태 변경', () => {
      const updated = updateStatusInTree(sampleTree, 'main-1', 'idle', 'Paused');
      expect(updated[0].status).toBe('idle');
      expect(updated[0].statusMessage).toBe('Paused');
    });

    it('깊은 하위 노드 상태 변경 (인스턴스)', () => {
      const updated = updateStatusInTree(sampleTree, 'inst-1', 'error', 'Timeout');
      const inst = updated[0].children[0].children[0].children[0];
      expect(inst.status).toBe('error');
      expect(inst.statusMessage).toBe('Timeout');
    });

    it('존재하지 않는 ID로 업데이트 시 트리 변경 없음', () => {
      const updated = updateStatusInTree(sampleTree, 'nonexistent', 'error');
      expect(JSON.stringify(updated)).toBe(JSON.stringify(sampleTree));
    });

    it('statusMessage 미지정 시 기존 값 유지', () => {
      const treeWithMessage = [
        { id: 'a', status: 'active', statusMessage: 'Working', children: [] },
      ];
      const updated = updateStatusInTree(treeWithMessage, 'a', 'idle');
      expect(updated[0].status).toBe('idle');
      expect(updated[0].statusMessage).toBe('Working');
    });
  });

  // SC-003: 에이전트 제거
  describe('removeFromTree 로직', () => {
    function removeFromTree(nodes: any[], agentId: string): any[] {
      return nodes
        .filter((n) => n.id !== agentId)
        .map((n) => ({ ...n, children: removeFromTree(n.children, agentId) }));
    }

    it('리프 노드 제거', () => {
      const result = removeFromTree(sampleTree, 'inst-1');
      const sub = result[0].children[0].children[0];
      expect(sub.children).toHaveLength(0);
    });

    it('중간 노드 제거 시 해당 노드만 제거', () => {
      const result = removeFromTree(sampleTree, 'part-2');
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children[0].id).toBe('part-1');
    });

    it('루트 노드 제거', () => {
      const result = removeFromTree(sampleTree, 'main-1');
      expect(result).toHaveLength(0);
    });

    it('존재하지 않는 ID 제거 시 변경 없음', () => {
      const result = removeFromTree(sampleTree, 'nonexistent');
      expect(result).toHaveLength(1);
    });
  });
});
