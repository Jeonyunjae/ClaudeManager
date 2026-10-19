/**
 * 실시간 에이전트 추가 단위 테스트 — BUG-034
 * Instance는 부모 Sub 아래에 붙어야 대시보드 Instance 열(Sub의 children)에 보인다.
 */
import { describe, it, expect, vi } from 'vitest';
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
import { insertIntoTree } from '@/stores/agentStore';
import type { AgentTreeNode } from '@/types/agent';

const n = (id: string, role: AgentTreeNode['role'], children: AgentTreeNode[] = []): AgentTreeNode =>
  ({ id, name: id, role, status: 'idle', children });

describe('insertIntoTree', () => {
  const tree = [n('main', 'main', [n('part', 'part', [n('sub', 'sub')])])];

  it('parentId가 있으면 그 노드의 children에 붙인다', () => {
    const next = insertIntoTree(tree, n('inst', 'instance'), 'sub');
    expect(next[0].children[0].children[0].children.map((c) => c.id)).toEqual(['inst']);
    expect(next).toHaveLength(1);
  });

  it('같은 id가 이미 있으면 바꿔 끼운다 (중복 없음)', () => {
    const once = insertIntoTree(tree, n('inst', 'instance'), 'sub');
    const twice = insertIntoTree(once, { ...n('inst', 'instance'), status: 'active' }, 'sub');
    const kids = twice[0].children[0].children[0].children;
    expect(kids).toHaveLength(1);
    expect(kids[0].status).toBe('active');
  });

  it('부모가 없거나 모르면 최상위에 둔다', () => {
    expect(insertIntoTree(tree, n('x', 'sub'))).toHaveLength(2);
    expect(insertIntoTree(tree, n('y', 'instance'), 'nope')).toHaveLength(2);
  });
});
