import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { projects } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectIds } = body;

    if (!Array.isArray(projectIds)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_INVALID_FORMAT', message: 'projectIds must be an array' } },
        { status: 400 }
      );
    }

    // Update each project's updatedAt to reflect order (used as secondary sort)
    const now = new Date();
    for (let i = 0; i < projectIds.length; i++) {
      const updatedAt = new Date(now.getTime() - i * 1000).toISOString();
      await db.update(projects)
        .set({ updatedAt })
        .where(eq(projects.id, projectIds[i]))
        ;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: 'Failed to reorder projects' } },
      { status: 500 }
    );
  }
}
