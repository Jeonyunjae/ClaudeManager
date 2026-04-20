import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { apiKeys, auditLogs } from '@/lib/schema';
import { encrypt, maskApiKey } from '@/lib/crypto';

export async function GET(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  const keys = await db.select().from(apiKeys);

  const data = keys.map((key) => ({
    id: key.id,
    provider: key.provider,
    keyMasked: key.keyMasked,
    status: key.status,
    expiresAt: key.expiresAt,
    monthlyUsage: key.monthlyUsage,
    createdAt: key.createdAt,
  }));

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  const body = await request.json();
  const { provider, key, expiresAt } = body;

  if (!provider || !key) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_REQUIRED', message: 'provider and key are required' } },
      { status: 400 }
    );
  }

  const { encrypted, iv, tag } = encrypt(key);
  const masked = maskApiKey(key);

  const [result] = await db.insert(apiKeys).values({
    provider,
    keyEncrypted: encrypted,
    keyIv: iv,
    keyTag: tag,
    keyMasked: masked,
    status: 'active',
    expiresAt: expiresAt || null,
  }).returning({ id: apiKeys.id });

  const id = result.id;

  await db.insert(auditLogs).values({
    actorType: 'user',
    actorId: String(userId),
    action: 'register_apikey',
    resource: 'apikey',
    resourceId: String(id),
    detail: JSON.stringify({ provider }),
  });

  return NextResponse.json({
    data: { id, provider, keyMasked: masked, status: 'active' },
  }, { status: 201 });
}
