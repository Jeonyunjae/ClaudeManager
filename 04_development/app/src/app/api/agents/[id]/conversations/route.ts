import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { chatMessages } from '@/lib/schema';
import { desc } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  const { id: agentId } = await params;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  // Get all messages for this agent, newest first for pagination
  const allMessages = await db.select()
    .from(chatMessages)
    .orderBy(desc(chatMessages.createdAt));

  // Filter by agentId in metadata
  const filtered = allMessages.filter((msg) => {
    try {
      const meta = msg.metadata ? JSON.parse(msg.metadata) : null;
      return meta?.agentId === agentId;
    } catch {
      return false;
    }
  });

  const total = filtered.length;
  const offset = (page - 1) * limit;
  const paged = filtered.slice(offset, offset + limit);

  // Reverse so oldest first within the page (for display order)
  paged.reverse();

  const data = paged.map((msg) => {
    // metadata에는 agentId 외에 도구 사용 목록·대기/취소 표시가 들어 있다.
    // 새로고침해도 "무엇을 실행했는지"가 남아야 하므로 함께 내려준다.
    let meta: { tools?: unknown; queued?: boolean; cancelled?: boolean } = {};
    try {
      meta = msg.metadata ? JSON.parse(msg.metadata) : {};
    } catch {
      meta = {};
    }
    return {
      id: msg.id,
      timestamp: msg.createdAt,
      fromAgent: msg.sender === 'user' ? 'user' : msg.sender,
      toAgent: msg.sender === 'user' ? agentId : 'user',
      content: msg.content,
      type: msg.sender === 'user' ? 'instruction' : 'report',
      metadata: {
        tools: Array.isArray(meta.tools) ? meta.tools : undefined,
        queued: meta.queued === true,
        cancelled: meta.cancelled === true,
      },
    };
  });

  return NextResponse.json({
    data,
    pagination: {
      page,
      limit,
      total,
      hasMore: offset + limit < total,
    },
  });
}
