import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { agents } from '@/lib/schema';
import { getAuthenticatedUserId } from '@/lib/auth';
import type { AgentTreeNode } from '@/types/agent';

export async function GET(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_TOKEN_EXPIRED', message: '인증이 필요합니다.' } },
      { status: 401 }
    );
  }

  try {
    const allAgents = await db.select().from(agents);

    // Build tree from flat list
    const nodeMap = new Map<string, AgentTreeNode>();
    for (const agent of allAgents) {
      nodeMap.set(agent.id, {
        id: agent.id,
        name: agent.name,
        role: agent.role as AgentTreeNode['role'],
        status: agent.status as AgentTreeNode['status'],
        statusMessage: agent.statusMessage ?? undefined,
        partId: agent.partId ?? undefined,
        children: [],
      });
    }

    const roots: AgentTreeNode[] = [];
    for (const agent of allAgents) {
      const node = nodeMap.get(agent.id)!;
      if (agent.parentId && nodeMap.has(agent.parentId)) {
        nodeMap.get(agent.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return NextResponse.json({ data: roots });
  } catch (error) {
    console.error('Agent tree error:', error);
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: '서버 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}
