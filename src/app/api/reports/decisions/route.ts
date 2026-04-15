import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { approvals, approvalHistory } from '@/lib/schema';
import { and, gte, lte, desc, ne } from 'drizzle-orm';
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
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE), 10);
  const offset = (page - 1) * limit;

  const conditions = [ne(approvals.status, 'pending')];
  if (from) conditions.push(gte(approvals.createdAt, from));
  if (to) conditions.push(lte(approvals.createdAt, to));

  const whereClause = and(...conditions);

  const resolved = db.select()
    .from(approvals)
    .where(whereClause)
    .orderBy(desc(approvals.resolvedAt))
    .limit(limit)
    .offset(offset)
    .all();

  const data = resolved.map((approval) => {
    const history = db.select()
      .from(approvalHistory)
      .where(
        and(
          // Get the resolution history entry for this approval
          // approvalHistory stores each action taken on an approval
          gte(approvalHistory.approvalId, approval.id)
        )
      )
      .limit(1)
      .get();

    return {
      id: approval.id,
      date: approval.resolvedAt || approval.createdAt,
      question: approval.title,
      decision: approval.status,
      decidedBy: 'user',
      background: approval.content,
      rationale: history?.comment || approval.resolution,
    };
  });

  return NextResponse.json({ data });
}
