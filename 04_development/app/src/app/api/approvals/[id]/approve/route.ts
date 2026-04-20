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
    const body = await request.json().catch(() => ({}));
    const { comment } = body;

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
      status: 'approved',
      resolution: comment || null,
      resolvedAt,
    }).where(eq(approvals.id, id));

    await db.insert(approvalHistory).values({
      approvalId: id,
      action: 'approved',
      comment: comment || null,
      actorType: 'user',
      actorId: String(userId),
    });

    await db.insert(auditLogs).values({
      actorType: 'user',
      actorId: String(userId),
      action: 'approve',
      resource: 'approval',
      resourceId: id,
      detail: JSON.stringify({ comment }),
    });

    // --- GAP-3 FIX: Broadcast approval resolution ---
    broadcastApprovalResolved(id, 'approved');

    return NextResponse.json({ data: { id, status: 'approved', resolvedAt } });
  } catch (error) {
    logError(error, { requestPath: '/api/approvals/[id]/approve' });
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: 'Server error.' } },
      { status: 500 }
    );
  }
}
