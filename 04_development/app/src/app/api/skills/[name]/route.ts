import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { skills, auditLogs } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import {
  getSkillsAccountUrl,
  parseOwner,
  getGithubToken,
  fetchSkillDoc,
} from '@/lib/github-skills';
import { buildUsage } from '../route';

const SAFE_NAME = /^[A-Za-z0-9._-]+$/;

async function usersOf(skillName: string): Promise<string[]> {
  const usage = await buildUsage();
  return (usage[skillName] || []).map((u) => u.name);
}

function unauthorized() {
  return NextResponse.json(
    { error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
    { status: 401 }
  );
}

/**
 * 상세 — DB 메타 + GitHub의 SKILL.md 본문.
 * 본문은 팝업을 열 때만 GitHub에서 읽는다 (clone 없음, 저장도 안 함).
 * 없거나 못 읽으면 null이고 화면은 저장소 링크만 보여준다.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  if (!getAuthenticatedUserId(request)) return unauthorized();

  const { name } = await params;
  if (!SAFE_NAME.test(name)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: '잘못된 스킬 이름입니다.' } },
      { status: 400 }
    );
  }

  const [row] = await db.select().from(skills).where(eq(skills.name, name)).limit(1);
  if (!row) {
    return NextResponse.json(
      { error: { code: 'SKILL_NOT_FOUND', message: '스킬을 찾을 수 없습니다.' } },
      { status: 404 }
    );
  }

  const owner = parseOwner(await getSkillsAccountUrl());
  const doc = owner ? await fetchSkillDoc(owner, name, await getGithubToken()) : null;

  let topics: string[] = [];
  try {
    topics = row.topics ? JSON.parse(row.topics) : [];
  } catch {
    topics = [];
  }

  return NextResponse.json({
    data: { ...row, topics, body: doc, usedBy: await usersOf(name) },
  });
}

/** 비활성/활성 토글 — 사용자만 정하는 값이라 동기화가 덮어쓰지 않는다. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) return unauthorized();

  const { name } = await params;
  const body = await request.json();
  const status = body?.status;

  if (status !== 'active' && status !== 'archived') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: "status는 'active' 또는 'archived' 여야 합니다." } },
      { status: 400 }
    );
  }

  const [row] = await db.select().from(skills).where(eq(skills.name, name)).limit(1);
  if (!row) {
    return NextResponse.json(
      { error: { code: 'SKILL_NOT_FOUND', message: '스킬을 찾을 수 없습니다.' } },
      { status: 404 }
    );
  }

  await db
    .update(skills)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(skills.name, name));

  await db.insert(auditLogs).values({
    actorType: 'user',
    actorId: String(userId),
    action: status === 'archived' ? 'archive_skill' : 'activate_skill',
    resource: 'skill',
    resourceId: name,
    detail: JSON.stringify({ name, status }),
  });

  return NextResponse.json({ data: { name, status } });
}

/**
 * 목록에서 제거 — DB 행만 지운다.
 *
 * GitHub 저장소는 건드리지 않는다. 앱은 저장소를 읽기만 하므로,
 * 저장소가 남아 있으면 다음 동기화 때 목록에 다시 나타난다.
 * 저장소 자체를 없애려면 GitHub에서 삭제하거나 Main에게 요청해야 한다.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) return unauthorized();

  const { name } = await params;
  if (!SAFE_NAME.test(name)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: '잘못된 스킬 이름입니다.' } },
      { status: 400 }
    );
  }

  const users = await usersOf(name);
  if (users.length > 0) {
    return NextResponse.json(
      {
        error: {
          code: 'SKILL_IN_USE',
          message: `사용 중인 프로젝트가 있습니다: ${users.join(', ')}`,
          details: { usedBy: users },
        },
      },
      { status: 409 }
    );
  }

  await db.delete(skills).where(eq(skills.name, name));

  await db.insert(auditLogs).values({
    actorType: 'user',
    actorId: String(userId),
    action: 'delete_skill',
    resource: 'skill',
    resourceId: name,
    detail: JSON.stringify({ name }),
  });

  return NextResponse.json({
    data: {
      deleted: true,
      note: '목록에서 제거했습니다. GitHub 저장소는 그대로이며, 다시 동기화하면 목록에 나타납니다.',
    },
  });
}
