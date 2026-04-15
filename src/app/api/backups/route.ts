import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { backups } from '@/lib/schema';
import { desc, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  const history = db.select()
    .from(backups)
    .orderBy(desc(backups.createdAt))
    .limit(20)
    .all();

  const latestBackup = history[0] || null;

  const totalSizeResult = db.select({
    total: sql<number>`COALESCE(SUM(size_bytes), 0)`,
  })
    .from(backups)
    .get();

  // Next scheduled: assume daily backup at 03:00
  const now = new Date();
  const next = new Date(now);
  next.setHours(3, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);

  return NextResponse.json({
    data: {
      latestBackup,
      nextScheduled: next.toISOString(),
      totalSize: totalSizeResult?.total ?? 0,
      history: history.map((b) => ({
        id: b.id,
        type: b.type,
        status: b.status,
        sizeBytes: b.sizeBytes,
        createdAt: b.createdAt,
      })),
    },
  });
}
