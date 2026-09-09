import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { auditLogs } from '@/lib/schema';
import { syncSkills } from '@/lib/skill-sync';

/** 스킬 저장소 → DB 캐시 동기화. 화면의 [동기화] 버튼이 호출한다. */
export async function POST(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  const result = await syncSkills();

  if (result.ok) {
    await db.insert(auditLogs).values({
      actorType: 'user',
      actorId: String(userId),
      action: 'sync_skills',
      resource: 'skill',
      detail: JSON.stringify({
        inserted: result.inserted,
        updated: result.updated,
        removed: result.removed,
        owner: result.owner,
      }),
    });
  }

  return NextResponse.json({ data: result });
}
