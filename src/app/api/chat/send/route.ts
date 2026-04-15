import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import db from '@/lib/db';
import { chatMessages, auditLogs } from '@/lib/schema';
import { getAuthenticatedUserId } from '@/lib/auth';

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
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_REQUIRED', message: '메시지 내용을 입력해주세요.' } },
        { status: 400 }
      );
    }

    const id = uuidv4();
    const createdAt = new Date().toISOString();

    await db.insert(chatMessages).values({
      id,
      sender: 'user',
      content: content.trim(),
      messageType: 'text',
      createdAt,
    });

    // Audit log
    await db.insert(auditLogs).values({
      actorType: 'user',
      actorId: String(userId),
      action: 'command',
      resource: 'chat',
      resourceId: id,
      detail: JSON.stringify({ content: content.trim() }),
    });

    return NextResponse.json({ data: { id, createdAt } }, { status: 201 });
  } catch (error) {
    console.error('Chat send error:', error);
    return NextResponse.json(
      { error: { code: 'CHAT_SEND_FAILED', message: '메시지 전송에 실패했습니다.' } },
      { status: 500 }
    );
  }
}
