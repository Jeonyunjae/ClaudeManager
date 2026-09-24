import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { notifications } from '@/lib/schema';
import { getAuthenticatedUserId } from '@/lib/auth';
import { and, eq, inArray } from 'drizzle-orm';
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

      // 실제로 바뀐 행이 있을 때만 방송한다 (불필요한 재방송 방지)
      if (updatedRows.length > 0) {
        await wsBroadcast('notification:read', { ids: 'all' });
      }
      return NextResponse.json({ data: { updated: updatedRows.length } });
    }

    // ids 지정 분기도 isRead=false 조건을 걸어 이미 읽은 알림은 재계산에서 제외한다
    // (BUG-016 — 위쪽 '전체' 분기에는 있었으나 이 분기엔 누락돼, 같은 id로 반복
    // 호출해도 매번 updated가 실제 변경 건수처럼 보고됐다).
    const updatedRows = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(inArray(notifications.id, ids), eq(notifications.isRead, false)))
      .returning({ id: notifications.id });

    // 실제로 바뀐 행이 있을 때만 방송한다 (BUG-016 — 이미 읽은 id로 재호출해도
    // updated=0인데 매번 재방송되던 문제)
    if (updatedRows.length > 0) {
      await wsBroadcast('notification:read', { ids: updatedRows.map((row) => row.id) });
    }
    return NextResponse.json({ data: { updated: updatedRows.length } });
  } catch (error) {
    console.error('Mark read error:', error);
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: '서버 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}
