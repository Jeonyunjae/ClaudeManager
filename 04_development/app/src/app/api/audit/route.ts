import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { auditLogs } from '@/lib/schema';
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
  const actorType = searchParams.get('actorType');
  const action = searchParams.get('action');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const search = searchParams.get('search');

  const conditions = [];
  if (actorType) conditions.push(eq(auditLogs.actorType, actorType));
  if (action) conditions.push(eq(auditLogs.action, action));
  if (from) conditions.push(gte(auditLogs.createdAt, from));
  if (to) conditions.push(lte(auditLogs.createdAt, to));
  if (search) conditions.push(like(auditLogs.detail, `%${search}%`));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db.select()
    .from(auditLogs)
    .where(whereClause)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset)
    ;

  const [countResult] = await db.select({ count: sql<number>`count(*)` })
    .from(auditLogs)
    .where(whereClause)
    .limit(1);

  const total = countResult?.count ?? 0;

  return NextResponse.json({
    data: rows,
    pagination: {
      page,
      limit,
      total,
      hasMore: offset + limit < total,
    },
  });
}
