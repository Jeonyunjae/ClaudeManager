import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { agents, auditLogs, costRecords } from '@/lib/schema';
import { getAuthenticatedUserId } from '@/lib/auth';
import { eq, sql } from 'drizzle-orm';
import { logError } from '@/lib/error-logger';
import {
  startSub,
  stopSub,
  restartSub,
  startInstance,
  stopInstance,
  stopPart,
  startPart,
  killSession,
  buildSessionName,
  sendKeys,
} from '@/lib/orchestrator';
import { broadcastAgentStatus, broadcastAgentRemoved } from '@/lib/ws-bridge';
import type { AgentRole } from '@/lib/orchestrator';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_TOKEN_EXPIRED', message: 'Authentication required.' } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const [agent] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);

    if (!agent) {
      return NextResponse.json(
        { error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found.' } },
        { status: 404 }
      );
    }

    const uptimeSeconds = agent.startedAt
      ? Math.floor((Date.now() - new Date(agent.startedAt).getTime()) / 1000)
      : 0;

    // Aggregate cost data from cost_records
    const [costAgg] = await db.select({
      totalCost: sql<number>`COALESCE(SUM(${costRecords.cost}), 0)`,
      totalInputTokens: sql<number>`COALESCE(SUM(${costRecords.inputTokens}), 0)`,
      totalOutputTokens: sql<number>`COALESCE(SUM(${costRecords.outputTokens}), 0)`,
      interactionCount: sql<number>`COUNT(*)`,
    }).from(costRecords).where(eq(costRecords.agentId, id)).limit(1);

    return NextResponse.json({
      data: {
        ...agent,
        uptimeSeconds,
        totalCost: costAgg?.totalCost || 0,
        totalInputTokens: costAgg?.totalInputTokens || 0,
        totalOutputTokens: costAgg?.totalOutputTokens || 0,
        interactionCount: costAgg?.interactionCount || 0,
      },
    });
  } catch (error) {
    logError(error, { requestPath: '/api/agents/[id]' });
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: 'Server error.' } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/agents/[id]
 * Update agent fields (e.g. notesPath)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_TOKEN_EXPIRED', message: 'Authentication required.' } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const [agent] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
    if (!agent) {
      return NextResponse.json(
        { error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found.' } },
        { status: 404 }
      );
    }

    const updateData: Record<string, string> = { updatedAt: new Date().toISOString() };

    if (typeof body.notesPath === 'string') {
      updateData.notesPath = body.notesPath;
    }
    if (typeof body.name === 'string') {
      updateData.name = body.name;
    }
    if (typeof body.modelName === 'string') {
      updateData.modelName = body.modelName;
    }

    await db.update(agents).set(updateData).where(eq(agents.id, id));

    const [updated] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);

    return NextResponse.json({ data: updated });
  } catch (error) {
    logError(error, { requestPath: '/api/agents/[id]/put' });
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: 'Server error.' } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/agents/[id]
 * Actions: start, stop, restart, send-keys
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_TOKEN_EXPIRED', message: 'Authentication required.' } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { action, command } = body as { action: string; command?: string };

    const [agent] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
    if (!agent) {
      return NextResponse.json(
        { error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found.' } },
        { status: 404 }
      );
    }

    const role = agent.role as AgentRole;

    switch (action) {
      case 'stop': {
        // Kill tmux session
        if (agent.tmuxSession) {
          killSession(agent.tmuxSession);
        }

        await db.update(agents).set({
          status: 'stopped',
          statusMessage: 'Stopped by user',
          stoppedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }).where(eq(agents.id, id));

        broadcastAgentStatus(id, 'stopped', 'Stopped by user');
        break;
      }

      case 'start': {
        let result;
        if (role === 'part') {
          result = startPart(agent.partId || id, agent.name, id);
        } else if (role === 'sub') {
          result = startSub(agent.partId || '', id, agent.name, id);
        } else if (role === 'instance') {
          result = startInstance(id);
        } else {
          return NextResponse.json(
            { error: { code: 'VALIDATION_INVALID_FORMAT', message: 'Cannot start Main agent this way' } },
            { status: 400 }
          );
        }

        const tmuxSession = result?.sessionName || null;
        await db.update(agents).set({
          status: 'active',
          statusMessage: 'Started',
          tmuxSession,
          startedAt: new Date().toISOString(),
          stoppedAt: null,
          updatedAt: new Date().toISOString(),
        }).where(eq(agents.id, id));

        broadcastAgentStatus(id, 'active', 'Started');
        break;
      }

      case 'restart': {
        // Kill existing session
        if (agent.tmuxSession) {
          killSession(agent.tmuxSession);
        }

        let result;
        if (role === 'sub') {
          result = restartSub(agent.partId || '', id, agent.name, id);
        } else if (role === 'instance') {
          stopInstance(id);
          result = startInstance(id);
        } else if (role === 'part') {
          stopPart(id);
          result = startPart(agent.partId || id, agent.name, id);
        } else {
          return NextResponse.json(
            { error: { code: 'VALIDATION_INVALID_FORMAT', message: 'Cannot restart Main agent this way' } },
            { status: 400 }
          );
        }

        const tmuxSession = result?.sessionName || null;
        await db.update(agents).set({
          status: 'active',
          statusMessage: 'Restarted',
          tmuxSession,
          startedAt: new Date().toISOString(),
          stoppedAt: null,
          updatedAt: new Date().toISOString(),
        }).where(eq(agents.id, id));

        broadcastAgentStatus(id, 'active', 'Restarted');
        break;
      }

      case 'send-keys': {
        if (!command) {
          return NextResponse.json(
            { error: { code: 'VALIDATION_REQUIRED', message: 'command is required for send-keys' } },
            { status: 400 }
          );
        }
        const sessionName = agent.tmuxSession || buildSessionName(role, id);
        const result = sendKeys(sessionName, command);
        if (!result.success) {
          return NextResponse.json(
            { error: { code: 'SYSTEM_ERROR', message: result.error || 'Failed to send keys' } },
            { status: 500 }
          );
        }
        break;
      }

      default:
        return NextResponse.json(
          { error: { code: 'VALIDATION_INVALID_FORMAT', message: `Unknown action: ${action}` } },
          { status: 400 }
        );
    }

    // Audit log
    await db.insert(auditLogs).values({
      actorType: 'user',
      actorId: String(userId),
      action: `agent_${action}`,
      resource: 'agent',
      resourceId: id,
      detail: JSON.stringify({ action, command }),
    });

    return NextResponse.json({ data: { id, action, success: true } });
  } catch (error) {
    logError(error, { requestPath: '/api/agents/[id]/action' });
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: 'Server error.' } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agents/[id]
 * Remove an agent and kill its tmux session.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_TOKEN_EXPIRED', message: 'Authentication required.' } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const [agent] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);

    if (!agent) {
      return NextResponse.json(
        { error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found.' } },
        { status: 404 }
      );
    }

    // Kill tmux session
    if (agent.tmuxSession) {
      killSession(agent.tmuxSession);
    }

    // Remove from DB
    await db.delete(agents).where(eq(agents.id, id));

    // Audit log
    await db.insert(auditLogs).values({
      actorType: 'user',
      actorId: String(userId),
      action: 'delete_agent',
      resource: 'agent',
      resourceId: id,
      detail: JSON.stringify({ name: agent.name, role: agent.role }),
    });

    // Broadcast removal
    broadcastAgentRemoved(id);

    return NextResponse.json({ data: { id, deleted: true } });
  } catch (error) {
    logError(error, { requestPath: '/api/agents/[id]/delete' });
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: 'Server error.' } },
      { status: 500 }
    );
  }
}
