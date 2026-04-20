import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { skills, parts, auditLogs } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { logError } from '@/lib/error-logger';
import {
  executeSkill,
  skillExists,
  writeVersionLock,
  writeInputJson,
} from '@/lib/skill-engine';
import {
  broadcastPartCreated,
  broadcastNotification,
} from '@/lib/ws-bridge';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  const { name } = await params;
  const body = await request.json();
  const { input } = body;

  const [skill] = await db.select().from(skills).where(eq(skills.name, name)).limit(1);
  if (!skill) {
    return NextResponse.json(
      { error: { code: 'SKILL_NOT_FOUND', message: 'Skill not found' } },
      { status: 404 }
    );
  }

  // Validate input against schema
  if (skill.schemaJson) {
    const schema = JSON.parse(skill.schemaJson);
    for (const field of schema.fields || []) {
      if (field.required && (!input || input[field.key] === undefined || input[field.key] === '')) {
        return NextResponse.json(
          { error: { code: 'SKILL_SCHEMA_INVALID', message: `Required field missing: ${field.label}` } },
          { status: 400 }
        );
      }
    }
  }

  try {
    // --- GAP-2 FIX: Actually execute the bash skill ---
    let partId = uuidv4();
    let partDir: string | undefined;
    const partName = input?.name || `${skill.displayName}-${Date.now()}`;

    if (skillExists(name)) {
      // Run the bash skill in execute mode
      const result = await executeSkill(name, input || {});
      if (!result.success) {
        return NextResponse.json(
          { error: { code: 'SKILL_EXECUTION_FAILED', message: result.error || 'Skill execution failed' } },
          { status: 500 }
        );
      }

      // Extract partId and partDir from skill output if available
      if (result.data?.partId) {
        partId = result.data.partId as string;
      }
      if (result.data?.partDir) {
        partDir = result.data.partDir as string;
      }
    }

    // Save Part to DB
    await db.insert(parts).values({
      id: partId,
      name: partName,
      description: input?.description || null,
      skillName: skill.name,
      skillVersion: skill.version,
      sensitivityLevel: input?.sensitivityLevel || 'normal',
      color: input?.color || null,
      status: 'active',
      inputJson: JSON.stringify(input || {}),
      orchestratorPath: partDir || null,
    });

    // Write version lock and input.json to part directory
    if (partDir) {
      writeVersionLock(partDir, name, skill.version);
      writeInputJson(partDir, input || {});
    }

    // Audit log
    await db.insert(auditLogs).values({
      actorType: 'user',
      actorId: String(userId),
      action: 'execute_skill',
      resource: 'skill',
      resourceId: skill.name,
      detail: JSON.stringify({ partId, input }),
    });

    // Broadcast via WebSocket
    await Promise.all([
      broadcastPartCreated({ id: partId, name: partName, color: input?.color }),
      broadcastNotification({
        type: 'info',
        title: 'Part Created',
        message: `${partName} department has been created successfully.`,
      }),
    ]);

    return NextResponse.json({
      data: {
        partId,
        status: 'created',
        orchestratorDir: partDir,
      },
    }, { status: 201 });
  } catch (error) {
    logError(error, { requestPath: '/api/skills/[name]/execute' });
    return NextResponse.json(
      { error: { code: 'SKILL_EXECUTION_FAILED', message: 'Failed to execute skill' } },
      { status: 500 }
    );
  }
}
