import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { chatMessages } from '@/lib/schema';
import { getAuthenticatedUserId } from '@/lib/auth';
import { desc, count } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_TOKEN_EXPIRED', message: '인증이 필요합니다.' } },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const messages = await db
      .select()
      .from(chatMessages)
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalResult] = await db.select({ count: count() }).from(chatMessages);
    const total = totalResult.count;

    return NextResponse.json({
      data: messages,
      pagination: {
        page,
        limit,
        total,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Chat messages error:', error);
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: '서버 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}
