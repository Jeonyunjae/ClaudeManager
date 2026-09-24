import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { agents, settings } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { INBOX_ACK_SETTINGS_KEY } from '@/lib/inbox';

/** POST /api/inbox/{agentId}/ack — 답변 대기 "확인함" (DES-002, FR-006) */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_TOKEN_EXPIRED', message: '인증이 필요합니다.' } },
      { status: 401 }
    );
  }

  const { agentId } = await params;

  try {
    const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
    if (!agent) {
      return NextResponse.json(
        { error: { code: 'AGENT_NOT_FOUND', message: '에이전트를 찾을 수 없습니다.' } },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    const [existing] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, INBOX_ACK_SETTINGS_KEY))
      .limit(1);

    let ack: Record<string, string> = {};
    if (existing) {
      try {
        ack = JSON.parse(existing.value) as Record<string, string>;
      } catch {
        ack = {};
      }
    }
    ack[agentId] = now;
    const value = JSON.stringify(ack);

    if (existing) {
      await db
        .update(settings)
        .set({ value, updatedAt: now })
        .where(eq(settings.key, INBOX_ACK_SETTINGS_KEY));
    } else {
      await db.insert(settings).values({ key: INBOX_ACK_SETTINGS_KEY, value, updatedAt: now });
    }

    return NextResponse.json({ data: { agentId, ackAt: now } });
  } catch (error) {
    console.error('Inbox ack error:', error);
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: '서버 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}
