import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { agentLogs, costRecords } from '@/lib/schema';
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

  const logs = await db.select()
    .from(agentLogs)
    .where(whereClause)
    .orderBy(desc(agentLogs.createdAt))
    .limit(limit)
    .offset(offset);

  const [countResult] = await db.select({ count: sql<number>`count(*)` })
    .from(agentLogs)
    .where(whereClause)
    .limit(1);

  const total = countResult?.count ?? 0;

  // Aggregate cost from cost_records (single source of truth)
  const [costAgg] = await db.select({
    totalCost: sql<number>`COALESCE(SUM(${costRecords.cost}), 0)`,
    totalInputTokens: sql<number>`COALESCE(SUM(${costRecords.inputTokens}), 0)`,
    totalOutputTokens: sql<number>`COALESCE(SUM(${costRecords.outputTokens}), 0)`,
  }).from(costRecords).where(eq(costRecords.agentId, agentId)).limit(1);

  return NextResponse.json({
    costSummary: {
      totalCost: costAgg?.totalCost || 0,
      totalInputTokens: costAgg?.totalInputTokens || 0,
      totalOutputTokens: costAgg?.totalOutputTokens || 0,
    },
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
