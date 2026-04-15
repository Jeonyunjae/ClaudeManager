import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { apiKeys, auditLogs } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { encrypt, maskApiKey } from '@/lib/crypto';

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

  const { id } = await params;
  const keyId = parseInt(id, 10);
  const body = await request.json();

  const existing = db.select().from(apiKeys).where(eq(apiKeys.id, keyId)).get();
  if (!existing) {
    return NextResponse.json(
      { error: { code: 'APIKEY_NOT_FOUND', message: 'API key not found' } },
      { status: 404 }
    );
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (body.key) {
    const { encrypted, iv, tag } = encrypt(body.key);
    updates.keyEncrypted = encrypted;
    updates.keyIv = iv;
    updates.keyTag = tag;
    updates.keyMasked = maskApiKey(body.key);
  }

  if (body.expiresAt !== undefined) {
    updates.expiresAt = body.expiresAt;
  }

  db.update(apiKeys).set(updates).where(eq(apiKeys.id, keyId)).run();

  db.insert(auditLogs).values({
    actorType: 'user',
    actorId: String(userId),
    action: 'update_apikey',
    resource: 'apikey',
    resourceId: id,
  }).run();

  return NextResponse.json({ data: { id: keyId, updated: true } });
}

export async function DELETE(
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

  const { id } = await params;
  const keyId = parseInt(id, 10);

  const existing = db.select().from(apiKeys).where(eq(apiKeys.id, keyId)).get();
  if (!existing) {
    return NextResponse.json(
      { error: { code: 'APIKEY_NOT_FOUND', message: 'API key not found' } },
      { status: 404 }
    );
  }

  db.delete(apiKeys).where(eq(apiKeys.id, keyId)).run();

  db.insert(auditLogs).values({
    actorType: 'user',
    actorId: String(userId),
    action: 'delete_apikey',
    resource: 'apikey',
    resourceId: id,
  }).run();

  return NextResponse.json({ data: { deleted: true } });
}
