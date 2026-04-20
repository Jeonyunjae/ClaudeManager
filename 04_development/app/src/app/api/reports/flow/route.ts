import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { auditLogs } from '@/lib/schema';
import { and, gte, lte, eq, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const conditions = [];
  if (projectId) {
    conditions.push(eq(auditLogs.resourceId, projectId));
  }
  if (from) conditions.push(gte(auditLogs.createdAt, from));
  if (to) conditions.push(lte(auditLogs.createdAt, to));

  // Include agent-related audit logs
  conditions.push(eq(auditLogs.actorType, 'agent'));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const logs = await db.select()
    .from(auditLogs)
    .where(whereClause)
    .orderBy(desc(auditLogs.createdAt))
    .limit(200)
    ;

  // Build nodes and edges from audit logs
  const nodeMap = new Map<string, { id: string; agentId: string; agentName: string; action: string; timestamp: string; detail: string }>();
  const edges: Array<{ from: string; to: string; type: string }> = [];

  for (const log of logs) {
    const nodeId = String(log.id);
    nodeMap.set(nodeId, {
      id: nodeId,
      agentId: log.actorId || '',
      agentName: log.actorId || 'unknown',
      action: log.action,
      timestamp: log.createdAt,
      detail: log.detail || '',
    });

    // Create edges between sequential actions by the same agent
    if (log.resourceId && log.actorId) {
      edges.push({
        from: log.actorId,
        to: log.resourceId,
        type: log.action.includes('instruct') ? 'instruction' : 'report',
      });
    }
  }

  return NextResponse.json({
    data: {
      nodes: Array.from(nodeMap.values()),
      edges,
    },
  });
}
