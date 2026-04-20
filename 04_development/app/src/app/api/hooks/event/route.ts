import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import db from '@/lib/db';
import { agentLogs, notifications, chatMessages, agents } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import {
  broadcastAgentStatus,
  broadcastChatMessage,
  broadcastNotification,
  broadcastLogNew,
} from '@/lib/ws-bridge';
import { logError } from '@/lib/error-logger';
import { writeNoteFile } from '@/lib/note-writer';

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

    // --- GAP-3 FIX: Broadcast log entry via WebSocket ---
    broadcastLogNew(agentId, { eventType: event, message: data?.message, data });

    // Update agent status based on event
    switch (event) {
      case 'task_start':
        await db.update(agents).set({
          status: 'active',
          statusMessage: data?.message || 'Working...',
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }).where(eq(agents.id, agentId));

        // Broadcast status change
        broadcastAgentStatus(agentId, 'active', data?.message || 'Working...');
        break;

      case 'task_complete':
        await db.update(agents).set({
          status: 'idle',
          statusMessage: data?.message || 'Completed',
          updatedAt: new Date().toISOString(),
        }).where(eq(agents.id, agentId));

        broadcastAgentStatus(agentId, 'idle', data?.message || 'Completed');
        break;

      case 'error':
        await db.update(agents).set({
          status: 'error',
          statusMessage: data?.message || 'Error occurred',
          updatedAt: new Date().toISOString(),
        }).where(eq(agents.id, agentId));

        broadcastAgentStatus(agentId, 'error', data?.message || 'Error occurred');

        // Create error notification
        await db.insert(notifications).values({
          type: 'error',
          title: 'Agent Error',
          message: data?.message || `Agent ${agentId} encountered an error.`,
          sourceAgentId: agentId,
        });

        broadcastNotification({
          type: 'error',
          title: 'Agent Error',
          message: data?.message || `Agent ${agentId} encountered an error.`,
        });
        break;

      case 'decision': {
        const msgId = uuidv4();
        const content = data?.message || 'A decision is required.';
        const messageType = data?.requiresApproval ? 'approval_request' : 'text';

        await db.insert(chatMessages).values({
          id: msgId,
          sender: 'main',
          content,
          messageType,
          metadata: data ? JSON.stringify(data) : null,
        });

        // Broadcast chat message
        broadcastChatMessage({
          id: msgId,
          sender: 'main',
          content,
          messageType,
          metadata: data,
        });
        break;
      }

      case 'tool_use':
        // Update agent status to show active tool usage
        await db.update(agents).set({
          status: 'active',
          statusMessage: `Using tool: ${data?.tool || 'unknown'}`,
          updatedAt: new Date().toISOString(),
        }).where(eq(agents.id, agentId));

        broadcastAgentStatus(agentId, 'active', `Using tool: ${data?.tool || 'unknown'}`);
        break;
    }

    // GAP-10: Write event to note file for dual storage
    try {
      writeNoteFile(agentId, event, data);
    } catch {
      // Non-critical — DB is the primary store
    }

    return NextResponse.json({ data: { received: true } });
  } catch (error) {
    logError(error, { requestPath: '/api/hooks/event' });
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: 'Server error.' } },
      { status: 500 }
    );
  }
}
