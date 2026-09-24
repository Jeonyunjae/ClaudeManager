import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { chatMessages, agents, settings } from '@/lib/schema';
import { desc, eq } from 'drizzle-orm';
import { computeInbox, INBOX_ACK_SETTINGS_KEY, type InboxMessage } from '@/lib/inbox';

/** GET /api/inbox — 답변 대기 대화 목록 (DES-002, FR-006) */
export async function GET(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_TOKEN_EXPIRED', message: '인증이 필요합니다.' } },
      { status: 401 }
    );
  }

  try {
    const allMessages = await db.select().from(chatMessages).orderBy(desc(chatMessages.createdAt));
    const allAgents = await db.select().from(agents);
    const [ackRow] = await db.select().from(settings).where(eq(settings.key, INBOX_ACK_SETTINGS_KEY)).limit(1);

    let ack: Record<string, string> = {};
    if (ackRow) {
      try {
        ack = JSON.parse(ackRow.value) as Record<string, string>;
      } catch {
        ack = {};
      }
    }

    const messages: InboxMessage[] = allMessages.map((row) => {
      let agentId: string | null = null;
      let queued = false;
      let cancelled = false;
      try {
        const meta = row.metadata ? JSON.parse(row.metadata) : {};
        agentId = typeof meta.agentId === 'string' ? meta.agentId : null;
        queued = meta.queued === true;
        cancelled = meta.cancelled === true;
      } catch {
        agentId = null;
      }
      return {
        id: row.id,
        sender: row.sender,
        content: row.content,
        createdAt: row.createdAt,
        agentId,
        queued,
        cancelled,
      };
    });

    const items = computeInbox({
      messages,
      agents: allAgents.map((a) => ({ id: a.id, name: a.name, role: a.role, status: a.status })),
      ack,
    });

    return NextResponse.json({ data: items, meta: { count: items.length } });
  } catch (error) {
    console.error('Inbox GET error:', error);
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: '서버 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}
