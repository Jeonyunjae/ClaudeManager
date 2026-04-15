import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { approvals, agents, projects } from '@/lib/schema';
import { getAuthenticatedUserId } from '@/lib/auth';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_TOKEN_EXPIRED', message: '인증이 필요합니다.' } },
      { status: 401 }
    );
  }

  try {
    const pendingApprovals = await db
      .select({
        id: approvals.id,
        title: approvals.title,
        content: approvals.content,
        urgency: approvals.urgency,
        status: approvals.status,
        sourceAgentId: approvals.sourceAgentId,
        projectId: approvals.projectId,
        createdAt: approvals.createdAt,
      })
      .from(approvals)
      .where(eq(approvals.status, 'pending'))
      .orderBy(approvals.createdAt);

    return NextResponse.json({ data: pendingApprovals });
  } catch (error) {
    console.error('Pending approvals error:', error);
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: '서버 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}
