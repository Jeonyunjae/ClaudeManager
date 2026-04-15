import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { skills } from '@/lib/schema';
import { eq } from 'drizzle-orm';

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

  const skill = db.select().from(skills).where(eq(skills.name, name)).get();
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
