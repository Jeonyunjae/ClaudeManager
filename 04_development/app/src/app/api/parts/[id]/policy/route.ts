import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { partPolicies, parts, auditLogs } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  const { id: partId } = await params;

  const [part] = await db.select().from(parts).where(eq(parts.id, partId)).limit(1);
  if (!part) {
    return NextResponse.json(
      { error: { code: 'PART_NOT_FOUND', message: 'Part not found' } },
      { status: 404 }
    );
  }

  const [policy] = await db.select().from(partPolicies).where(eq(partPolicies.partId, partId)).limit(1);

  return NextResponse.json({
    data: policy
      ? {
          retryCount: policy.retryCount,
          retryStrategy: policy.retryStrategy,
          retryIntervalBase: policy.retryIntervalBase,
          approvalStages: policy.approvalStages ? JSON.parse(policy.approvalStages) : [],
          defaultModel: policy.defaultModel,
          sensitivityLevel: part.sensitivityLevel,
        }
      : {
          retryCount: 3,
          retryStrategy: 'exponential',
          retryIntervalBase: 10,
          approvalStages: [],
          defaultModel: null,
          sensitivityLevel: part.sensitivityLevel,
        },
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  const { id: partId } = await params;
  const body = await request.json();

  const [part] = await db.select().from(parts).where(eq(parts.id, partId)).limit(1);
  if (!part) {
    return NextResponse.json(
      { error: { code: 'PART_NOT_FOUND', message: 'Part not found' } },
      { status: 404 }
    );
  }

  const [existing] = await db.select().from(partPolicies).where(eq(partPolicies.partId, partId)).limit(1);

  const values = {
    retryCount: body.retryCount ?? existing?.retryCount ?? 3,
    retryStrategy: body.retryStrategy ?? existing?.retryStrategy ?? 'exponential',
    retryIntervalBase: body.retryIntervalBase ?? existing?.retryIntervalBase ?? 10,
    approvalStages: body.approvalStages ? JSON.stringify(body.approvalStages) : existing?.approvalStages ?? '[]',
    defaultModel: body.defaultModel ?? existing?.defaultModel ?? null,
    updatedAt: new Date().toISOString(),
  };

  if (existing) {
    await db.update(partPolicies)
      .set(values)
      .where(eq(partPolicies.partId, partId))
      ;
  } else {
    await db.insert(partPolicies).values({
      partId,
      ...values,
    });
  }

  if (body.sensitivityLevel) {
    await db.update(parts)
      .set({ sensitivityLevel: body.sensitivityLevel, updatedAt: new Date().toISOString() })
      .where(eq(parts.id, partId))
      ;
  }

  await db.insert(auditLogs).values({
    actorType: 'user',
    actorId: String(userId),
    action: 'update_policy',
    resource: 'part_policy',
    resourceId: partId,
    detail: JSON.stringify(body),
  });

  return NextResponse.json({ data: { updated: true } });
}
