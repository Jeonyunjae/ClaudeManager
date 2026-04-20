import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { parts, agents, projects, auditLogs } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { logError } from '@/lib/error-logger';
import { createPartFolderStructure } from '@/lib/orchestrator';
import { broadcastPartCreated } from '@/lib/ws-bridge';

export async function GET(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  const partsList = await db.select().from(parts);

  const data = await Promise.all(partsList.map(async (part) => {
    const [agentCountRow] = await db.select({ count: sql<number>`count(*)` })
      .from(agents)
      .where(eq(agents.partId, part.id))
      .limit(1);
    const agentCount = agentCountRow?.count ?? 0;

    const [projectCountRow] = await db.select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(eq(projects.partId, part.id))
      .limit(1);
    const projectCount = projectCountRow?.count ?? 0;

    return {
      id: part.id,
      name: part.name,
      description: part.description,
      skillName: part.skillName,
      skillVersion: part.skillVersion,
      sensitivityLevel: part.sensitivityLevel,
      color: part.color,
      status: part.status,
      agentCount,
      projectCount,
      createdAt: part.createdAt,
    };
  }));

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  const body = await request.json();
  const { skillName, inputJson } = body;

  if (!skillName) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_REQUIRED', message: 'skillName is required' } },
      { status: 400 }
    );
  }

  const id = uuidv4();
  const parsed = typeof inputJson === 'string' ? JSON.parse(inputJson) : inputJson || {};
  const name = parsed.name || `Part-${skillName}`;

  try {
    // --- GAP-1 FIX: Create .orchestrator/ folder structure ---
    const partDir = createPartFolderStructure(id, name);

    // Save Part to DB
    await db.insert(parts).values({
      id,
      name,
      description: parsed.description || null,
      skillName,
      skillVersion: parsed.version || '1.0.0',
      sensitivityLevel: parsed.sensitivityLevel || 'normal',
      color: parsed.color || null,
      status: 'active',
      inputJson: JSON.stringify(parsed),
      orchestratorPath: partDir,
    });

    // Audit log
    await db.insert(auditLogs).values({
      actorType: 'user',
      actorId: String(userId),
      action: 'create_part',
      resource: 'part',
      resourceId: id,
      detail: JSON.stringify({ skillName, name }),
    });

    // Broadcast via WebSocket
    await broadcastPartCreated({ id, name, color: parsed.color });

    return NextResponse.json({
      data: { id, name, status: 'active' },
    }, { status: 201 });
  } catch (error) {
    logError(error, { requestPath: '/api/parts' });
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: 'Failed to create part' } },
      { status: 500 }
    );
  }
}
