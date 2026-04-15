import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { approvals, agents } from '@/lib/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
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
  const status = searchParams.get('status');
  const partId = searchParams.get('partId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const conditions = [];

  if (status) {
    conditions.push(eq(approvals.status, status));
  }
  if (from) {
    conditions.push(gte(approvals.createdAt, from));
  }
  if (to) {
    conditions.push(lte(approvals.createdAt, to));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = db.select()
    .from(approvals)
    .where(whereClause)
    .orderBy(desc(approvals.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  const countResult = db.select({ count: sql<number>`count(*)` })
    .from(approvals)
    .where(whereClause)
    .get();

  const total = countResult?.count ?? 0;

  // Enrich with agent names
  const data = rows.map((row) => {
    const sourceAgent = row.sourceAgentId
      ? db.select().from(agents).where(eq(agents.id, row.sourceAgentId)).get()
      : null;

    return {
      ...row,
      sourceAgentName: sourceAgent?.name || null,
    };
  });

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
