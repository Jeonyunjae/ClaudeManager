import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { systemHealth } from '@/lib/schema';
import { gte, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || '1h';

  const now = new Date();
  let since: Date;
  switch (period) {
    case '24h':
      since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '1h':
    default:
      since = new Date(now.getTime() - 60 * 60 * 1000);
      break;
  }

  const rows = await db.select()
    .from(systemHealth)
    .where(gte(systemHealth.createdAt, since.toISOString()))
    .orderBy(desc(systemHealth.createdAt));

  const data = rows.map((row) => ({
      timestamp: row.createdAt,
      cpu: row.cpuPercent,
      memory: row.memoryPercent,
      disk: row.diskPercent,
      networkUp: row.networkUpMbps,
      networkDown: row.networkDownMbps,
      activeAgents: row.activeAgents,
    }));

  return NextResponse.json({ data });
}
