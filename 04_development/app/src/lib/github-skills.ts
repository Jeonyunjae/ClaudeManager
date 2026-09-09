/**
 * GitHub Skills — 스킬 계정의 저장소 목록을 읽는다.
 *
 * 저장소 하나 = 스킬 하나. 앱은 clone 하지 않고 GitHub API로 조회만 한다
 * (디스크에 아무것도 만들지 않는다). clone·commit·push는 Main이 담당한다.
 *
 * 화면에 필요한 값은 GitHub이 이미 다 갖고 있다:
 *   저장소 이름 → 스킬명 / description → 설명 / topics → 카테고리
 *   최신 tag  → 버전 / updated_at → 수정일 / html_url → 링크
 */

import { db } from './db';
import { settings, apiKeys } from './schema';
import { eq, and } from 'drizzle-orm';
import { decrypt } from './crypto';

const GITHUB_API = 'https://api.github.com';

export type SkillRepo = {
  name: string;
  description: string | null;
  topics: string[];
  version: string | null;
  htmlUrl: string;
  isPrivate: boolean;
  defaultBranch: string;
  updatedAt: string | null;
  pushedAt: string | null;
};

/* ------------------------------------------------------------------ */
/*  설정 읽기                                                          */
/* ------------------------------------------------------------------ */

/** Settings에 저장된 스킬 계정 주소 (예: https://github.com/Jeonyunjae-Skills) */
export async function getSkillsAccountUrl(): Promise<string | null> {
  try {
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'skills_account_url'))
      .limit(1);
    const v = row?.value?.trim();
    return v || null;
  } catch {
    return null;
  }
}

/** 계정 URL에서 소유자명만 뽑는다. https://github.com/Foo → Foo */
export function parseOwner(accountUrl: string | null): string | null {
  if (!accountUrl) return null;
  const m = accountUrl.trim().match(/github\.com\/([^/\s]+)/i);
  return m ? m[1].replace(/\.git$/, '') : null;
}

/** api_keys에 저장된 GitHub 토큰을 복호화해 반환. 없으면 null (public만 조회). */
export async function getGithubToken(): Promise<string | null> {
  try {
    const [row] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.provider, 'github'), eq(apiKeys.status, 'active')))
      .limit(1);
    if (!row) return null;
    return decrypt(row.keyEncrypted, row.keyIv, row.keyTag);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  GitHub 조회                                                        */
/* ------------------------------------------------------------------ */

function headers(token: string | null): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'yj-manager',
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

type GhRepo = {
  name: string;
  description: string | null;
  topics?: string[];
  html_url: string;
  private: boolean;
  default_branch: string;
  updated_at: string | null;
  pushed_at: string | null;
  archived?: boolean;
  fork?: boolean;
};

export class GithubError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * 계정의 저장소 목록.
 * 조직/사용자 어느 쪽인지 모르므로 /orgs 를 먼저 시도하고 실패하면 /users 로 넘어간다.
 * 토큰이 있으면 /user/repos 로 private까지 본다.
 */
export async function listSkillRepos(
  owner: string,
  token: string | null
): Promise<SkillRepo[]> {
  const collected: GhRepo[] = [];

  const fetchPaged = async (url: string): Promise<GhRepo[] | null> => {
    const out: GhRepo[] = [];
    for (let page = 1; page <= 5; page += 1) {
      const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}per_page=100&page=${page}`, {
        headers: headers(token),
        cache: 'no-store',
      });
      if (res.status === 404) return null;
      if (res.status === 403 || res.status === 429) {
        const remaining = res.headers.get('x-ratelimit-remaining');
        if (remaining === '0') {
          const reset = res.headers.get('x-ratelimit-reset');
          const when = reset
            ? new Date(Number(reset) * 1000).toLocaleTimeString('ko-KR')
            : '잠시 후';
          throw new GithubError(
            token
              ? `GitHub 호출 한도를 초과했습니다. ${when} 이후 다시 시도하세요.`
              : `GitHub 호출 한도(비인증 시간당 60회)를 초과했습니다. Settings에 토큰을 등록하면 한도가 크게 늘어납니다. (재시도 가능 시각: ${when})`,
            res.status
          );
        }
      }
      if (!res.ok) {
        const body = await res.text();
        throw new GithubError(
          `GitHub 조회 실패 (${res.status}): ${body.slice(0, 160)}`,
          res.status
        );
      }
      const batch = (await res.json()) as GhRepo[];
      out.push(...batch);
      if (batch.length < 100) break;
    }
    return out;
  };

  // 1) 토큰 주인이 곧 그 계정이면 /user/repos 를 쓴다.
  //    /users/{name}/repos 는 남의 계정으로 취급해 public만 돌려주므로,
  //    개인 계정의 private 스킬 저장소가 통째로 누락된다.
  let repos: GhRepo[] | null = null;
  if (token) {
    try {
      const me = await fetch(`${GITHUB_API}/user`, { headers: headers(token), cache: 'no-store' });
      if (me.ok) {
        const login = ((await me.json()) as { login?: string }).login;
        if (login && login.toLowerCase() === owner.toLowerCase()) {
          repos = await fetchPaged(
            `${GITHUB_API}/user/repos?affiliation=owner&visibility=all&sort=updated`
          );
        }
      }
    } catch {
      /* 확인 실패 시 아래 경로로 넘어간다 */
    }
  }

  // 2) 조직 → 3) 사용자(public) 순으로 시도
  if (repos === null) {
    repos = await fetchPaged(`${GITHUB_API}/orgs/${owner}/repos?type=all&sort=updated`);
  }
  if (repos === null) {
    repos = await fetchPaged(`${GITHUB_API}/users/${owner}/repos?type=all&sort=updated`);
  }
  if (repos === null) {
    throw new GithubError(
      `계정 "${owner}"을(를) 찾을 수 없습니다. 주소를 확인하거나, private이라면 토큰을 등록하세요.`,
      404
    );
  }
  collected.push(...repos);

  // 포크·아카이브는 스킬로 보지 않는다
  const usable = collected.filter((r) => !r.fork && !r.archived);

  // 버전(릴리즈/태그)은 저장소마다 API를 1~2번 더 쓴다.
  // 비인증 한도는 시간당 60회라 저장소가 조금만 많아도 곧바로 소진된다.
  // 토큰이 있을 때(5000회)만 조회하고, 없으면 버전은 비워 둔다.
  const withVersion = Boolean(token);

  return Promise.all(
    usable.map(async (r) => ({
      name: r.name,
      description: r.description,
      topics: r.topics ?? [],
      version: withVersion ? await latestVersion(owner, r.name, token) : null,
      htmlUrl: r.html_url,
      isPrivate: r.private,
      defaultBranch: r.default_branch || 'main',
      updatedAt: r.updated_at,
      pushedAt: r.pushed_at,
    }))
  );
}

/** 최신 릴리즈 → 없으면 최신 태그 → 없으면 null */
async function latestVersion(
  owner: string,
  repo: string,
  token: string | null
): Promise<string | null> {
  try {
    const rel = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/releases/latest`, {
      headers: headers(token),
      cache: 'no-store',
    });
    if (rel.ok) {
      const j = (await rel.json()) as { tag_name?: string };
      if (j.tag_name) return j.tag_name;
    }
    const tags = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/tags?per_page=1`, {
      headers: headers(token),
      cache: 'no-store',
    });
    if (tags.ok) {
      const j = (await tags.json()) as { name?: string }[];
      if (j[0]?.name) return j[0].name;
    }
  } catch {
    /* 버전은 없어도 목록은 보여준다 */
  }
  return null;
}

/**
 * 저장소 루트의 SKILL.md 내용. 상세 팝업을 열 때만 호출한다.
 * 없으면 null — 화면은 GitHub 링크만 보여준다.
 */
export async function fetchSkillDoc(
  owner: string,
  repo: string,
  token: string | null
): Promise<string | null> {
  try {
    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/SKILL.md`, {
      headers: { ...headers(token), Accept: 'application/vnd.github.raw' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}
