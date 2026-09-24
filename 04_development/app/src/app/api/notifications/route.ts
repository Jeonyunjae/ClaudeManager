import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { notifications } from '@/lib/schema';
import { getAuthenticatedUserId } from '@/lib/auth';
import { desc, eq, sql } from 'drizzle-orm';
import { logError } from '@/lib/error-logger';

export async function GET(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_TOKEN_EXPIRED', message: 'Authentication required.' } },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const whereClause = unreadOnly ? eq(notifications.isRead, false) : undefined;

    const results = await db.select()
      .from(notifications)
      .where(whereClause)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset)
      ;

    const [totalResult] = await db.select({ count: sql<number>`count(*)` })
      .from(notifications)
      .limit(1);

    const [unreadResult] = await db.select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(eq(notifications.isRead, false))
      .limit(1);

    // DF-005: unread=true로 부르면 total도 안 읽은 건수로 센다
    const unreadCount = unreadResult?.count ?? 0;
    const total = unreadOnly ? unreadCount : (totalResult?.count ?? 0);

    return NextResponse.json({
      data: results,
      pagination: {
        page,
        limit,
        total,
        hasMore: offset + limit < total,
      },
      unreadCount,
    });
  } catch (error) {
    logError(error, { requestPath: '/api/notifications' });
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: 'Server error.' } },
      { status: 500 }
    );
  }
}
