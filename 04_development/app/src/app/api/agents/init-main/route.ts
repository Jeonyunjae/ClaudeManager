import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import db from '@/lib/db';
import { agents } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/agents/init-main
 * Auto-creates the Main agent if it doesn't exist yet.
 * Returns the existing or newly created Main agent.
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
    // Check if a Main agent already exists
    const [existing] = await db
      .select()
      .from(agents)
      .where(eq(agents.role, 'main'))
      .limit(1);

    if (existing) {
      return NextResponse.json({
        data: { agent: existing, created: false },
      });
    }

    // Create the Main agent
    const now = new Date().toISOString();
    const newAgent = {
      id: uuidv4(),
      name: 'Main',
      role: 'main',
      status: 'idle',
      modelName: 'opus',
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(agents).values(newAgent);

    const [created] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, newAgent.id))
      .limit(1);

    return NextResponse.json({
      data: { agent: created, created: true },
    });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: 'Failed to initialize Main agent.' } },
      { status: 500 }
    );
  }
}
