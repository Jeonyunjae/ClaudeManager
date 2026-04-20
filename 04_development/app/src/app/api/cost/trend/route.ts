import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { parseAllUsage, aggregateByDate } from '@/lib/cli-usage-parser';

function getPeriodStart(period: string): string {
  const now = new Date();
  switch (period) {
    case 'day': now.setDate(now.getDate() - 1); break;
    case 'week': now.setDate(now.getDate() - 7); break;
    case 'month': default: now.setMonth(now.getMonth() - 1); break;
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
  const data = aggregateByDate(entries).map(d => ({
    date: d.date,
    cost: Math.round(d.cost * 100) / 100,
  }));

  return NextResponse.json({ data });
}
