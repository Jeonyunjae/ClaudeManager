import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { projects } from '@/lib/schema';
import { eq } from 'drizzle-orm';

const VALID_PRIORITIES = ['urgent', 'high', 'normal', 'low'];

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { priority } = body;

    if (!priority || !VALID_PRIORITIES.includes(priority)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_INVALID_FORMAT', message: 'Priority must be urgent, high, normal, or low' } },
        { status: 400 }
      );
    }

    const [existing] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }

    await db.update(projects)
      .set({ priority, updatedAt: new Date().toISOString() })
      .where(eq(projects.id, id))
      ;

    return NextResponse.json({ id, priority });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: 'Failed to update priority' } },
      { status: 500 }
    );
  }
}
