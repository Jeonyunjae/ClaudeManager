import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { costRecords, apiKeys } from '@/lib/schema';
import { gte, sql, eq } from 'drizzle-orm';

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
  const periodStart = getPeriodStart(period);

  const rows = await db.select({
    apiKeyId: costRecords.apiKeyId,
    cost: sql<number>`COALESCE(SUM(cost), 0)`,
    callCount: sql<number>`COUNT(*)`,
  })
    .from(costRecords)
    .where(gte(costRecords.createdAt, periodStart))
    .groupBy(costRecords.apiKeyId)
    ;

  const data = await Promise.all(rows.map(async (row) => {
    const key = row.apiKeyId
      ? (await db.select().from(apiKeys).where(eq(apiKeys.id, row.apiKeyId)).limit(1))[0]
      : null;
    return {
      provider: key?.provider || 'unknown',
      keyMasked: key?.keyMasked || '***',
      cost: row.cost,
      callCount: row.callCount,
    };
  }));

  return NextResponse.json({ data });
}
