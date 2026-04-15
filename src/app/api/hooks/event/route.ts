import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import db from '@/lib/db';
import { agentLogs, notifications, chatMessages, agents } from '@/lib/schema';
import { eq } from 'drizzle-orm';

// Hooks secret for internal validation
const HOOKS_SECRET = process.env.HOOKS_SECRET || 'claudemanager-hooks-secret';

export async function POST(request: NextRequest) {
  try {
    // Validate hooks secret
    const authHeader = request.headers.get('x-hooks-secret');
    if (authHeader !== HOOKS_SECRET) {
      return NextResponse.json(
        { error: { code: 'AUTH_INVALID', message: 'Invalid hooks secret.' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { event, agentId, data } = body;

    if (!event || !agentId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_REQUIRED', message: 'event and agentId are required.' } },
        { status: 400 }
      );
    }

    // Save to agent_logs
    await db.insert(agentLogs).values({
      agentId,
      eventType: event,
      message: data?.message || null,
      detail: data ? JSON.stringify(data) : null,
      inputTokens: data?.inputTokens || null,
      outputTokens: data?.outputTokens || null,
      cost: data?.cost || null,
    });

    // Update agent status based on event
    switch (event) {
      case 'task_start':
        await db.update(agents).set({
          status: 'active',
          statusMessage: data?.message || 'Working...',
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }).where(eq(agents.id, agentId));
        break;

      case 'task_complete':
        await db.update(agents).set({
          status: 'idle',
          statusMessage: data?.message || 'Completed',
          updatedAt: new Date().toISOString(),
        }).where(eq(agents.id, agentId));
        break;

      case 'error':
        await db.update(agents).set({
          status: 'error',
          statusMessage: data?.message || 'Error occurred',
          updatedAt: new Date().toISOString(),
        }).where(eq(agents.id, agentId));

        // Create error notification
        await db.insert(notifications).values({
          type: 'error',
          title: '에이전트 오류',
          message: data?.message || `에이전트 ${agentId}에서 오류가 발생했습니다.`,
          sourceAgentId: agentId,
        });
        break;

      case 'decision':
        // Create chat message from Main about decision request
        await db.insert(chatMessages).values({
          id: uuidv4(),
          sender: 'main',
          content: data?.message || '의사결정이 필요합니다.',
          messageType: data?.requiresApproval ? 'approval_request' : 'text',
          metadata: data ? JSON.stringify(data) : null,
        });
        break;
    }

    return NextResponse.json({ data: { received: true } });
  } catch (error) {
    console.error('Hooks event error:', error);
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: '서버 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}
