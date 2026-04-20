import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { settings } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { parseAllUsage, aggregateByModel } from '@/lib/cli-usage-parser';

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
  return now.toISOString().substring(0, 10);
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
  const since = getPeriodStart(period);

  const entries = parseAllUsage(since);
  const totalCost = entries.reduce((sum, e) => sum + e.cost, 0);

  // Plan base cost (Max 20x = $200/month)
  const [planCostSetting] = await db.select().from(settings).where(eq(settings.key, 'plan_base_cost')).limit(1);
  const planBaseCost = planCostSetting ? parseFloat(planCostSetting.value) : 200;

  // Overage limit (how much extra beyond plan the user is willing to spend)
  const [overageLimitSetting] = await db.select().from(settings).where(eq(settings.key, 'overage_limit')).limit(1);
  const overageLimit = overageLimitSetting ? parseFloat(overageLimitSetting.value) : 2000;

  // Today vs yesterday, this month vs last month
  const now = new Date();
  const todayStr = now.toISOString().substring(0, 10);
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().substring(0, 10);

  const thisMonthStr = todayStr.substring(0, 7); // "2026-04"
  const lastMonthDate = new Date(now);
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonthStr = lastMonthDate.toISOString().substring(0, 7); // "2026-03"

  // Parse all data (no filter) for comparison
  const allEntries = parseAllUsage(lastMonthDate.toISOString().substring(0, 10));

  const todayCost = allEntries.filter(e => e.date === todayStr).reduce((s, e) => s + e.cost, 0);
  const yesterdayCost = allEntries.filter(e => e.date === yesterdayStr).reduce((s, e) => s + e.cost, 0);
  const thisMonthCost = allEntries.filter(e => e.date.startsWith(thisMonthStr)).reduce((s, e) => s + e.cost, 0);
  const lastMonthCost = allEntries.filter(e => e.date.startsWith(lastMonthStr)).reduce((s, e) => s + e.cost, 0);

  // Model breakdown uses calendar month (same as monthlyCost) for consistency
  const thisMonthEntries = allEntries.filter(e => e.date.startsWith(thisMonthStr));
  const modelBreakdown = aggregateByModel(thisMonthEntries).filter(m => m.model && !m.model.startsWith('<')).map((m) => ({
    model: m.model,
    cost: Math.round(m.cost * 100) / 100,
    percentage: thisMonthCost > 0 ? Math.round((m.cost / thisMonthCost) * 100) : 0,
  }));

  const todayChange = yesterdayCost > 0 ? Math.round(((todayCost - yesterdayCost) / yesterdayCost) * 100) : 0;
  const monthChange = lastMonthCost > 0 ? Math.round(((thisMonthCost - lastMonthCost) / lastMonthCost) * 100) : 0;

  // Total tokens
  const totalInputTokens = entries.reduce((s, e) => s + e.inputTokens + e.cacheCreateTokens + e.cacheReadTokens, 0);
  const totalOutputTokens = entries.reduce((s, e) => s + e.outputTokens, 0);

  return NextResponse.json({
    data: {
      totalCost: Math.round(totalCost * 100) / 100,
      todayCost: Math.round(todayCost * 100) / 100,
      monthlyCost: Math.round(thisMonthCost * 100) / 100,
      yesterdayCost: Math.round(yesterdayCost * 100) / 100,
      lastMonthCost: Math.round(lastMonthCost * 100) / 100,
      todayChange,
      monthChange,
      totalInputTokens,
      totalOutputTokens,
      planBaseCost,
      overageLimit,
      overage: Math.round(Math.max(0, thisMonthCost - planBaseCost) * 100) / 100,
      overageRemaining: Math.round((overageLimit - Math.max(0, thisMonthCost - planBaseCost)) * 100) / 100,
      percentage: overageLimit > 0 ? Math.round((Math.max(0, thisMonthCost - planBaseCost) / overageLimit) * 100) : 0,
      modelBreakdown,
      keyBreakdown: [],
    },
  });
}
