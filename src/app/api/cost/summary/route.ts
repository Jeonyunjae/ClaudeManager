import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { costRecords, apiKeys, settings } from '@/lib/schema';
import { gte, sql, eq } from 'drizzle-orm';

function getPeriodStart(period: string): string {
  const now = new Date();
  switch (period) {
    case 'day':
      now.setDate(now.getDate() - 1);
      break;
    case 'week':
      now.setDate(now.getDate() - 7);
      break;
    case 'month':
    default:
      now.setMonth(now.getMonth() - 1);
      break;
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

  const totalResult = db.select({
    totalCost: sql<number>`COALESCE(SUM(cost), 0)`,
  })
    .from(costRecords)
    .where(gte(costRecords.createdAt, periodStart))
    .get();

  const totalCost = totalResult?.totalCost ?? 0;

  const costLimitSetting = db.select().from(settings).where(eq(settings.key, 'costLimit')).get();
  const costLimit = costLimitSetting ? parseFloat(costLimitSetting.value) : 1000;

  // Model breakdown
  const modelBreakdown = db.select({
    model: costRecords.modelName,
    cost: sql<number>`COALESCE(SUM(cost), 0)`,
  })
    .from(costRecords)
    .where(gte(costRecords.createdAt, periodStart))
    .groupBy(costRecords.modelName)
    .all()
    .map((row) => ({
      model: row.model,
      cost: row.cost,
      percentage: totalCost > 0 ? Math.round((row.cost / totalCost) * 100) : 0,
    }));

  // Key breakdown
  const keyBreakdown = db.select({
    apiKeyId: costRecords.apiKeyId,
    cost: sql<number>`COALESCE(SUM(cost), 0)`,
  })
    .from(costRecords)
    .where(gte(costRecords.createdAt, periodStart))
    .groupBy(costRecords.apiKeyId)
    .all()
    .map((row) => {
      const key = row.apiKeyId
        ? db.select().from(apiKeys).where(eq(apiKeys.id, row.apiKeyId)).get()
        : null;
      return {
        provider: key?.provider || 'unknown',
        cost: row.cost,
      };
    });

  return NextResponse.json({
    data: {
      totalCost,
      costLimit,
      percentage: costLimit > 0 ? Math.round((totalCost / costLimit) * 100) : 0,
      modelBreakdown,
      keyBreakdown,
    },
  });
}
