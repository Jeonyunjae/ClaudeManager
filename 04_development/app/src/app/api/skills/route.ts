import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { skills } from '@/lib/schema';

export async function GET(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  const skillsList = await db.select().from(skills);

  const data = skillsList.map((skill) => ({
    name: skill.name,
    displayName: skill.displayName,
    description: skill.description,
    version: skill.version,
    parentSkill: skill.parentSkill,
    filePath: skill.filePath,
    createdAt: skill.createdAt,
  }));

  return NextResponse.json({ data });
}
