/**
 * Skill Sync — GitHub 스킬 계정 → DB 캐시 동기화.
 *
 * 저장소 하나 = 스킬 하나. 앱은 clone 하지 않고 GitHub API로 목록만 읽는다.
 * 진실은 GitHub이고 DB는 파생 뷰이므로, 값이 다르면 GitHub으로 덮어쓴다
 * (DR001 §5 "data = 진실 소스, DB = 파생 뷰" 와 같은 원칙).
 *
 * status(활성/비활성)만 사용자가 화면에서 정하는 값이라 동기화가 건드리지 않는다.
 */

import { db } from './db';
import { skills } from './schema';
import { eq, notInArray } from 'drizzle-orm';
import {
  getSkillsAccountUrl,
  parseOwner,
  getGithubToken,
  listSkillRepos,
  GithubError,
} from './github-skills';

export type SyncResult = {
  ok: boolean;
  accountUrl: string | null;
  owner: string | null;
  authenticated: boolean;
  inserted: number;
  updated: number;
  removed: number;
  total: number;
  message?: string;
};

export async function syncSkills(): Promise<SyncResult> {
  const accountUrl = await getSkillsAccountUrl();
  const owner = parseOwner(accountUrl);
  const token = await getGithubToken();

  const base: SyncResult = {
    ok: false,
    accountUrl,
    owner,
    authenticated: Boolean(token),
    inserted: 0,
    updated: 0,
    removed: 0,
    total: 0,
  };

  if (!owner) {
    return {
      ...base,
      message: 'Settings에서 스킬 계정 주소를 먼저 등록하세요. (예: https://github.com/Jeonyunjae-Skills)',
    };
  }

  let repos;
  try {
    repos = await listSkillRepos(owner, token);
  } catch (e) {
    const msg =
      e instanceof GithubError
        ? e.message
        : e instanceof Error
          ? e.message
          : 'GitHub 조회에 실패했습니다.';
    return { ...base, message: msg };
  }

  const now = new Date().toISOString();
  const existing = await db.select().from(skills);
  const known = new Set(existing.map((r) => r.name));

  let inserted = 0;
  let updated = 0;

  for (const r of repos) {
    const row = {
      name: r.name,
      displayName: r.name,
      description: r.description,
      version: r.version,
      category: r.topics[0] ?? null,
      topics: JSON.stringify(r.topics),
      isPrivate: r.isPrivate,
      defaultBranch: r.defaultBranch,
      filePath: `${owner}/${r.name}`,
      repoUrl: r.htmlUrl,
      repoPushedAt: r.pushedAt,
      syncedAt: now,
      updatedAt: r.updatedAt ?? now,
    };

    if (known.has(r.name)) {
      await db.update(skills).set(row).where(eq(skills.name, r.name));
      updated += 1;
    } else {
      await db.insert(skills).values(row);
      inserted += 1;
    }
  }

  // GitHub에서 사라진 스킬은 DB에서도 제거한다 (GitHub이 진실이므로).
  const names = repos.map((r) => r.name);
  let removed = 0;
  const stale = existing.filter((r) => !names.includes(r.name));
  if (stale.length > 0) {
    if (names.length > 0) {
      await db.delete(skills).where(notInArray(skills.name, names));
    } else {
      for (const s of stale) {
        await db.delete(skills).where(eq(skills.name, s.name));
      }
    }
    removed = stale.length;
  }

  return {
    ...base,
    ok: true,
    inserted,
    updated,
    removed,
    total: repos.length,
  };
}
