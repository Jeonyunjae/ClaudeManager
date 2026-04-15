import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { skills, parts, auditLogs } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

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

  const skill = db.select().from(skills).where(eq(skills.name, name)).get();
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

  // Create a new Part from the skill execution
  const partId = uuidv4();
  const partName = input?.name || `${skill.displayName}-${Date.now()}`;

  try {
    db.insert(parts).values({
      id: partId,
      name: partName,
      description: input?.description || null,
      skillName: skill.name,
      skillVersion: skill.version,
      sensitivityLevel: input?.sensitivityLevel || 'normal',
      color: input?.color || null,
      status: 'active',
      inputJson: JSON.stringify(input || {}),
    }).run();

    db.insert(auditLogs).values({
      actorType: 'user',
      actorId: String(userId),
      action: 'execute_skill',
      resource: 'skill',
      resourceId: skill.name,
      detail: JSON.stringify({ partId, input }),
    }).run();

    return NextResponse.json({ data: { partId, status: 'created' } }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'SKILL_EXECUTION_FAILED', message: 'Failed to execute skill' } },
      { status: 500 }
    );
  }
}
