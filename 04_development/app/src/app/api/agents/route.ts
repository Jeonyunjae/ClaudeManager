import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import db from '@/lib/db';
import { agents, parts, auditLogs } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { broadcastAgentCreated } from '@/lib/ws-bridge';
import { logError } from '@/lib/error-logger';
import fs from 'fs';
import path from 'path';

/**
 * POST /api/agents
 * Create a new Sub or Instance agent.
 */
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
    const { name, role, partId, parentId, skill, modelName } = body as {
      name?: string;
      role?: string;
      partId?: string;
      parentId?: string;
      skill?: string;
      modelName?: string;
    };

    // Validate required fields
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_REQUIRED', message: 'name is required.' } },
        { status: 400 }
      );
    }

    if (!role || (role !== 'sub' && role !== 'instance')) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_INVALID_FORMAT', message: 'role must be "sub" or "instance".' } },
        { status: 400 }
      );
    }

    if (!partId || typeof partId !== 'string') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_REQUIRED', message: 'partId is required.' } },
        { status: 400 }
      );
    }

    // Verify part exists
    const [part] = await db.select().from(parts).where(eq(parts.id, partId)).limit(1);
    if (!part) {
      return NextResponse.json(
        { error: { code: 'PART_NOT_FOUND', message: 'Part not found.' } },
        { status: 404 }
      );
    }

    // Create agent record
    const agentId = uuidv4();
    const now = new Date().toISOString();

    const newAgent = {
      id: agentId,
      name,
      role,
      partId,
      parentId: parentId || null,
      modelName: modelName || 'sonnet',
      status: 'idle',
      statusMessage: skill ? 'Skill assigned' : null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(agents).values(newAgent);

    // Save skill file if provided
    if (skill) {
      const baseDir = process.env.CLAUDEMANAGER_HOME || process.cwd();
      const skillDir = path.join(baseDir, '.orchestrator', partId, 'sub-contexts');
      fs.mkdirSync(skillDir, { recursive: true });
      const skillPath = path.join(skillDir, `${agentId}.md`);
      fs.writeFileSync(skillPath, skill, 'utf-8');
    }

    // Audit log
    await db.insert(auditLogs).values({
      actorType: 'user',
      actorId: String(userId),
      action: 'create_agent',
      resource: 'agent',
      resourceId: agentId,
      detail: JSON.stringify({ name, role, partId, parentId, hasSkill: !!skill }),
    });

    // Broadcast
    broadcastAgentCreated({ id: agentId, name, role, partId });

    // Fetch the inserted record to return
    const [created] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    logError(error, { requestPath: '/api/agents' });
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: 'Server error.' } },
      { status: 500 }
    );
  }
}
