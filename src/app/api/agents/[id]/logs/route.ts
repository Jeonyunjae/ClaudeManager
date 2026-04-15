import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { agentLogs } from '@/lib/schema';
import { eq, and, like, desc, sql } from 'drizzle-orm';
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
  const search = searchParams.get('search');
  const eventType = searchParams.get('eventType');

  const conditions = [eq(agentLogs.agentId, agentId)];

  if (eventType) {
    conditions.push(eq(agentLogs.eventType, eventType));
  }

  if (search) {
    conditions.push(like(agentLogs.message, `%${search}%`));
  }

  const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

  const logs = db.select()
    .from(agentLogs)
    .where(whereClause)
    .orderBy(desc(agentLogs.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  const countResult = db.select({ count: sql<number>`count(*)` })
    .from(agentLogs)
    .where(whereClause)
    .get();

  const total = countResult?.count ?? 0;

  return NextResponse.json({
    data: logs.map((log) => ({
      id: log.id,
      eventType: log.eventType,
      message: log.message,
      detail: log.detail,
      inputTokens: log.inputTokens,
      outputTokens: log.outputTokens,
      cost: log.cost,
      createdAt: log.createdAt,
    })),
    pagination: {
      page,
      limit,
      total,
      hasMore: offset + limit < total,
    },
  });
}
