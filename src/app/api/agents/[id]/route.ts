import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { agents } from '@/lib/schema';
import { getAuthenticatedUserId } from '@/lib/auth';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_TOKEN_EXPIRED', message: '인증이 필요합니다.' } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const [agent] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);

    if (!agent) {
      return NextResponse.json(
        { error: { code: 'AGENT_NOT_FOUND', message: '에이전트를 찾을 수 없습니다.' } },
        { status: 404 }
      );
    }

    const uptimeSeconds = agent.startedAt
      ? Math.floor((Date.now() - new Date(agent.startedAt).getTime()) / 1000)
      : 0;

    return NextResponse.json({
      data: { ...agent, uptimeSeconds },
    });
  } catch (error) {
    console.error('Agent detail error:', error);
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: '서버 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}
