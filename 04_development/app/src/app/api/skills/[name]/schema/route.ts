import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { skills } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { getSkillSchema, skillExists } from '@/lib/skill-engine';

export async function GET(
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

  // First check DB for cached schema
  const [skill] = await db.select().from(skills).where(eq(skills.name, name)).limit(1);

  // --- GAP-2 FIX: Try to get schema from actual bash script ---
  if (skillExists(name)) {
    try {
      const liveSchema = await getSkillSchema(name);

      // Update DB cache if schema changed
      if (skill) {
        const liveSchemaJson = JSON.stringify(liveSchema);
        if (skill.schemaJson !== liveSchemaJson) {
          await db.update(skills)
            .set({
              schemaJson: liveSchemaJson,
              version: liveSchema.version,
              displayName: liveSchema.displayName,
              description: liveSchema.description || null,
              parentSkill: liveSchema.parent || null,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(skills.name, name))
            ;
        }
      }

      return NextResponse.json({
        data: {
          name: liveSchema.name,
          version: liveSchema.version,
          schema: liveSchema,
        },
      });
    } catch (error) {
      console.warn(`Failed to get live schema for ${name}, falling back to DB:`, error);
    }
  }

  // Fallback to DB-stored schema
  if (!skill) {
    return NextResponse.json(
      { error: { code: 'SKILL_NOT_FOUND', message: 'Skill not found' } },
      { status: 404 }
    );
  }

  const schema = skill.schemaJson ? JSON.parse(skill.schemaJson) : { fields: [] };

  return NextResponse.json({
    data: {
      name: skill.name,
      version: skill.version,
      schema,
    },
  });
}
