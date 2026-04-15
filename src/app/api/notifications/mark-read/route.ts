import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { notifications } from '@/lib/schema';
import { getAuthenticatedUserId } from '@/lib/auth';
import { eq, inArray } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_TOKEN_EXPIRED', message: '인증이 필요합니다.' } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { ids } = body;

    if (!ids || ids.length === 0) {
      // Mark all as read
      await db.update(notifications).set({ isRead: true }).where(eq(notifications.isRead, false));
      return NextResponse.json({ data: { updated: -1 } });
    }

    await db.update(notifications).set({ isRead: true }).where(inArray(notifications.id, ids));
    return NextResponse.json({ data: { updated: ids.length } });
  } catch (error) {
    console.error('Mark read error:', error);
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: '서버 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}
