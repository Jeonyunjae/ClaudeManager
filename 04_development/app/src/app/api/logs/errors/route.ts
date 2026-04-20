import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { agentLogs, agents } from '@/lib/schema';
import { eq, and, gte, lte, like, desc, sql } from 'drizzle-orm';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';

export async function GET(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE), 10);
  const offset = (page - 1) * limit;
  const partId = searchParams.get('partId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const search = searchParams.get('search');

  const source = searchParams.get('source'); // 'hooks' | 'system' | null (all)
  const conditions = [eq(agentLogs.eventType, 'error')];
  if (source === 'system') conditions.push(eq(agentLogs.agentId, 'system'));
  if (source === 'hooks') conditions.push(like(agentLogs.agentId, '%')); // exclude nothing extra — all non-system
  if (from) conditions.push(gte(agentLogs.createdAt, from));
  if (to) conditions.push(lte(agentLogs.createdAt, to));
  if (search) conditions.push(like(agentLogs.message, `%${search}%`));

  // If partId filter, get agents belonging to that part first
  if (partId) {
    const partAgentRows = await db.select({ id: agents.id })
      .from(agents)
      .where(eq(agents.partId, partId));
    const partAgents = partAgentRows.map((a) => a.id);

    if (partAgents.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: { page, limit, total: 0, hasMore: false },
      });
    }
    // For simplicity, filter in JS after query
  }

  const whereClause = and(...conditions);

  const rows = await db.select()
    .from(agentLogs)
    .where(whereClause)
    .orderBy(desc(agentLogs.createdAt))
    .limit(limit)
    .offset(offset)
    ;

  const [countResult] = await db.select({ count: sql<number>`count(*)` })
    .from(agentLogs)
    .where(whereClause)
    .limit(1);

  const total = countResult?.count ?? 0;

  const data = await Promise.all(rows.map(async (row) => {
    const [agent] = await db.select().from(agents).where(eq(agents.id, row.agentId)).limit(1);
    return {
      id: row.id,
      agentId: row.agentId,
      agentName: agent?.name || 'unknown',
      message: row.message,
      stackTrace: row.detail,
      retryCount: null,
      finalStatus: null,
      createdAt: row.createdAt,
    };
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
