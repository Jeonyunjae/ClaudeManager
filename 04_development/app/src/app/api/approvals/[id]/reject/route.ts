import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { approvals, approvalHistory, auditLogs } from '@/lib/schema';
import { getAuthenticatedUserId } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import { logError } from '@/lib/error-logger';
import { broadcastApprovalResolved } from '@/lib/ws-bridge';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_TOKEN_EXPIRED', message: 'Authentication required.' } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { comment } = body;

    if (!comment?.trim()) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_REQUIRED', message: 'Rejection reason is required.' } },
        { status: 400 }
      );
    }

    const [approval] = await db.select().from(approvals).where(eq(approvals.id, id)).limit(1);
    if (!approval) {
      return NextResponse.json(
        { error: { code: 'APPROVAL_NOT_FOUND', message: 'Approval request not found.' } },
        { status: 404 }
      );
    }
    if (approval.status !== 'pending') {
      return NextResponse.json(
        { error: { code: 'APPROVAL_ALREADY_RESOLVED', message: 'Already resolved.' } },
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

    // --- GAP-3 FIX: Broadcast approval resolution ---
    broadcastApprovalResolved(id, 'rejected');

    return NextResponse.json({ data: { id, status: 'rejected', resolvedAt } });
  } catch (error) {
    logError(error, { requestPath: '/api/approvals/[id]/reject' });
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: 'Server error.' } },
      { status: 500 }
    );
  }
}
