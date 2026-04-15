import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { approvals, approvalHistory, auditLogs } from '@/lib/schema';
import { getAuthenticatedUserId } from '@/lib/auth';
import { eq } from 'drizzle-orm';

export async function POST(
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
    const body = await request.json();
    const { comment } = body;

    if (!comment?.trim()) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_REQUIRED', message: '반려 사유를 입력해주세요.' } },
        { status: 400 }
      );
    }

    const [approval] = await db.select().from(approvals).where(eq(approvals.id, id)).limit(1);
    if (!approval) {
      return NextResponse.json(
        { error: { code: 'APPROVAL_NOT_FOUND', message: '승인 요청을 찾을 수 없습니다.' } },
        { status: 404 }
      );
    }
    if (approval.status !== 'pending') {
      return NextResponse.json(
        { error: { code: 'APPROVAL_ALREADY_RESOLVED', message: '이미 처리된 승인 요청입니다.' } },
        { status: 400 }
      );
    }

    const resolvedAt = new Date().toISOString();

    await db.update(approvals).set({
      status: 'rejected',
      resolution: comment,
      resolvedAt,
    }).where(eq(approvals.id, id));

    await db.insert(approvalHistory).values({
      approvalId: id,
      action: 'rejected',
      comment,
      actorType: 'user',
      actorId: String(userId),
    });

    await db.insert(auditLogs).values({
      actorType: 'user',
      actorId: String(userId),
      action: 'reject',
      resource: 'approval',
      resourceId: id,
      detail: JSON.stringify({ comment }),
    });

    return NextResponse.json({ data: { id, status: 'rejected', resolvedAt } });
  } catch (error) {
    console.error('Reject error:', error);
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: '서버 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}
