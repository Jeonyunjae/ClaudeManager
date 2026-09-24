import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { notifications } from '@/lib/schema';
import { getAuthenticatedUserId } from '@/lib/auth';
import { eq, inArray } from 'drizzle-orm';
import { wsBroadcast } from '@/lib/ws-bridge';

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
      // Mark all as read — updated는 실제로 바뀐 행 수 (DF-005)
      const updatedRows = await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.isRead, false))
        .returning({ id: notifications.id });

      await wsBroadcast('notification:read', { ids: 'all' });
      return NextResponse.json({ data: { updated: updatedRows.length } });
    }

    const updatedRows = await db
      .update(notifications)
      .set({ isRead: true })
      .where(inArray(notifications.id, ids))
      .returning({ id: notifications.id });

    await wsBroadcast('notification:read', { ids: updatedRows.map((row) => row.id) });
    return NextResponse.json({ data: { updated: updatedRows.length } });
  } catch (error) {
    console.error('Mark read error:', error);
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: '서버 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}
