import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { notifications } from '@/lib/schema';
import { getAuthenticatedUserId } from '@/lib/auth';
import { desc, eq, sql } from 'drizzle-orm';

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

    const results = db.select()
      .from(notifications)
      .where(whereClause)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    const totalResult = db.select({ count: sql<number>`count(*)` })
      .from(notifications)
      .get();

    const unreadResult = db.select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(eq(notifications.isRead, false))
      .get();

    const total = totalResult?.count ?? 0;

    return NextResponse.json({
      data: results,
      pagination: {
        page,
        limit,
        total,
        hasMore: offset + limit < total,
      },
      unreadCount: unreadResult?.count ?? 0,
    });
  } catch (error) {
    console.error('Notifications error:', error);
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: 'Server error.' } },
      { status: 500 }
    );
  }
}
