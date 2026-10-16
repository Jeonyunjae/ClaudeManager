/**
 * 문서 참조 → 실제 경로 찾기 단위 테스트 — FEAT-004
 */
import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { resolveDocRef } from '@/lib/notes-resolve';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'resolve-'));
const mk = (rel: string) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), '#'); };
mk('ProjA/docs/reports/plan.md');
mk('ProjA/docs/00-approvals.md');
mk('ProjB/docs/00-approvals.md');
mk('ProjB/story.md');
mk('ProjB/node_modules/pkg/story.md');
mk('ProjB/.git/story.md');

afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('resolveDocRef', () => {
  it('루트 기준으로 바로 있으면 그것 하나', () => {
    expect(resolveDocRef(root, 'ProjA/docs/reports/plan.md')).toEqual(['ProjA/docs/reports/plan.md']);
    expect(resolveDocRef(root, './ProjB/story.md')).toEqual(['ProjB/story.md']);
  });

  it('루트에 없으면 경로 끝이 같은 파일을 찾는다 (Main이 프로젝트 기준 경로를 쓴 경우)', () => {
    expect(resolveDocRef(root, 'docs/reports/plan.md')).toEqual(['ProjA/docs/reports/plan.md']);
  });

  it('이름만 쓰면 같은 이름 전부 — 짧은 경로 순', () => {
    expect(resolveDocRef(root, '00-approvals.md')).toEqual(['ProjA/docs/00-approvals.md', 'ProjB/docs/00-approvals.md']);
  });

  it('숨김 폴더·node_modules 안은 찾지 않는다', () => {
    expect(resolveDocRef(root, 'story.md')).toEqual(['ProjB/story.md']);
  });

  it('절대 경로: 루트 안이면 상대 경로로, 밖이면 없음', () => {
    expect(resolveDocRef(root, path.join(root, 'ProjB/story.md'))).toEqual(['ProjB/story.md']);
    expect(resolveDocRef(root, '/etc/passwd.md')).toEqual([]);
  });

  it('루트 밖으로 나가는 상대 경로는 없음', () => {
    expect(resolveDocRef(path.join(root, 'ProjA'), '../ProjB/story.md')).toEqual([]);
  });

  it('없는 문서는 빈 배열', () => {
    expect(resolveDocRef(root, 'nothing.md')).toEqual([]);
  });
});
