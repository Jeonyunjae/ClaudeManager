import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { agents, skills } from '@/lib/schema';
import { isNotNull, asc } from 'drizzle-orm';
import { getSkillsAccountUrl, parseOwner, getGithubToken } from '@/lib/github-skills';

/**
 * 어떤 프로젝트가 어떤 스킬로 만들어졌는지 역참조.
 * 프로젝트 폴더의 .yj/skills.lock.json 이 정본이다.
 */
export async function buildUsage(): Promise<
  Record<string, { name: string; version?: string }[]>
> {
  const usage: Record<string, { name: string; version?: string }[]> = {};
  try {
    const rows = await db
      .select({ name: agents.name, projectRoot: agents.projectRoot })
      .from(agents)
      .where(isNotNull(agents.projectRoot));

    for (const row of rows) {
      if (!row.projectRoot) continue;
      const lockPath = path.join(row.projectRoot, '.yj', 'skills.lock.json');
      if (!fs.existsSync(lockPath)) continue;
      try {
        const lock = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
        const id = lock?.skill?.name;
        if (id) (usage[id] ||= []).push({ name: row.name, version: lock?.skill?.version });
      } catch {
        /* 깨진 lock 파일은 무시 */
      }
    }
  } catch {
    /* DB 조회 실패해도 목록은 보여준다 */
  }
  return usage;
}

export async function GET(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  const rows = await db.select().from(skills).orderBy(asc(skills.name));
  const usage = await buildUsage();

  const data = rows.map((s) => {
    let topics: string[] = [];
    try {
      topics = s.topics ? JSON.parse(s.topics) : [];
    } catch {
      topics = [];
    }
    const usedBy = (usage[s.name] || []).map((u) => ({
      ...u,
      stale: Boolean(u.version && s.version && u.version !== s.version),
    }));
    return { ...s, topics, usedBy };
  });

  const categories = Array.from(
    new Set(data.flatMap((s) => s.topics))
  ).sort();

  const accountUrl = await getSkillsAccountUrl();

  return NextResponse.json({
    data,
    meta: {
      accountUrl,
      owner: parseOwner(accountUrl),
      configured: Boolean(parseOwner(accountUrl)),
      authenticated: Boolean(await getGithubToken()),
      categories,
      total: rows.length,
      lastSyncedAt: rows.reduce<string | null>(
        (acc, r) => (r.syncedAt && (!acc || r.syncedAt > acc) ? r.syncedAt : acc),
        null
      ),
    },
  });
}
