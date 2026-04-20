import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import db from '@/lib/db';
import { chatMessages, auditLogs } from '@/lib/schema';
import { getAuthenticatedUserId } from '@/lib/auth';
import { logError } from '@/lib/error-logger';
import { broadcastChatMessage } from '@/lib/ws-bridge';

export async function POST(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_TOKEN_EXPIRED', message: 'Authentication required.' } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_REQUIRED', message: 'Message content is required.' } },
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

    // --- GAP-3 FIX: Broadcast chat message via WebSocket ---
    broadcastChatMessage({
      id,
      sender: 'user',
      content: content.trim(),
      messageType: 'text',
    });

    return NextResponse.json({ data: { id, createdAt } }, { status: 201 });
  } catch (error) {
    logError(error, { requestPath: '/api/chat/send' });
    return NextResponse.json(
      { error: { code: 'CHAT_SEND_FAILED', message: 'Failed to send message.' } },
      { status: 500 }
    );
  }
}
