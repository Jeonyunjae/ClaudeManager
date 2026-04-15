import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { auditLogs } from '@/lib/schema';
import { eq, or, and, desc } from 'drizzle-orm';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  const { id: agentId } = await params;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE), 10);
  const offset = (page - 1) * limit;

  // Build conversations from audit logs where agent is actor or target
  const conversations = db.select()
    .from(auditLogs)
    .where(
      or(
        and(eq(auditLogs.actorType, 'agent'), eq(auditLogs.actorId, agentId)),
        and(eq(auditLogs.resource, 'agent'), eq(auditLogs.resourceId, agentId))
      )
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  const total = db.select()
    .from(auditLogs)
    .where(
      or(
        and(eq(auditLogs.actorType, 'agent'), eq(auditLogs.actorId, agentId)),
        and(eq(auditLogs.resource, 'agent'), eq(auditLogs.resourceId, agentId))
      )
    )
    .all().length;

  const data = conversations.map((log) => ({
    id: log.id,
    timestamp: log.createdAt,
    fromAgent: log.actorId || 'unknown',
    toAgent: log.resourceId || 'unknown',
    content: log.detail || log.action,
    type: log.action.includes('approve') || log.action.includes('reject')
      ? 'approval'
      : log.action.includes('instruct')
        ? 'instruction'
        : log.action.includes('report')
          ? 'report'
          : 'question',
  }));

  return NextResponse.json({
    data,
    pagination: {
      page,
      limit,
      total,
      hasMore: offset + limit < total,
    },
  });
}
