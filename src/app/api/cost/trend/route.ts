import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { costRecords } from '@/lib/schema';
import { gte, sql } from 'drizzle-orm';

function getPeriodStart(period: string): string {
  const now = new Date();
  switch (period) {
    case 'day': now.setDate(now.getDate() - 1); break;
    case 'week': now.setDate(now.getDate() - 7); break;
    case 'month': default: now.setMonth(now.getMonth() - 1); break;
  }
  return now.toISOString();
}

export async function GET(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || 'month';
  const granularity = searchParams.get('granularity') || 'day';
  const periodStart = getPeriodStart(period);

  const dateFormat = granularity === 'hour'
    ? `strftime('%Y-%m-%d %H:00', created_at)`
    : `strftime('%Y-%m-%d', created_at)`;

  const data = db.select({
    date: sql<string>`${sql.raw(dateFormat)}`,
    cost: sql<number>`COALESCE(SUM(cost), 0)`,
  })
    .from(costRecords)
    .where(gte(costRecords.createdAt, periodStart))
    .groupBy(sql`${sql.raw(dateFormat)}`)
    .orderBy(sql`${sql.raw(dateFormat)}`)
    .all();

  return NextResponse.json({ data });
}
