import fs from 'fs';
import path from 'path';
import { HIDDEN_NOTE_DIRS } from '@/lib/notes-root';

/** 이름 검색 한도 — 큰 프로젝트 폴더에서도 응답이 늦어지지 않게 */
const MAX_DEPTH = 8;
const MAX_ENTRIES = 30000;
const MAX_MATCHES = 20;

/**
 * 대화 속 문서 참조(`docs/a.md`, `a.md`, 절대 경로)를 노트 루트 기준 상대 경로 후보로 바꾼다 (FEAT-004).
 *
 * 1. 절대 경로: 루트 안이면 그 상대 경로, 밖이면 없음
 * 2. 루트 기준으로 바로 있으면 그것 하나
 * 3. 없으면 루트 아래에서 경로 끝이 같은 파일을 찾는다 — Main(전체 프로젝트 폴더)이 `docs/a.md`라고 쓴 경우
 *    `ProjectX/docs/a.md`를 찾는다. 이름만 쓴 경우(`a.md`)도 같은 방식
 */
export function resolveDocRef(root: string, ref: string): string[] {
  const rootAbs = path.resolve(root);
  let rel = ref.trim().replace(/^\.\//, '');

  if (path.isAbsolute(rel) || rel.startsWith('~')) {
    if (rel.startsWith('~')) rel = path.join(process.env.HOME || '', rel.slice(1));
    const abs = path.resolve(rel);
    if (!abs.startsWith(rootAbs + path.sep)) return [];
    rel = path.relative(rootAbs, abs);
  }

  const normalized = path.normalize(rel);
  if (normalized.startsWith('..')) return [];

  const direct = path.join(rootAbs, normalized);
  if (isFile(direct)) return [normalized.split(path.sep).join('/')];

  const suffix = '/' + normalized.split(path.sep).join('/');
  return searchBySuffix(rootAbs, suffix);
}

function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function searchBySuffix(rootAbs: string, suffix: string): string[] {
  const matches: string[] = [];
  let seen = 0;
  const stack: { dir: string; depth: number }[] = [{ dir: rootAbs, depth: 0 }];
  const baseName = suffix.slice(suffix.lastIndexOf('/') + 1).toLowerCase();

  while (stack.length > 0 && matches.length < MAX_MATCHES && seen < MAX_ENTRIES) {
    const { dir, depth } = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      seen++;
      if (entry.name.startsWith('.') || HIDDEN_NOTE_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (depth < MAX_DEPTH) stack.push({ dir: full, depth: depth + 1 });
      } else if (entry.isFile() && entry.name.toLowerCase() === baseName) {
        const relPath = path.relative(rootAbs, full).split(path.sep).join('/');
        if (('/' + relPath).toLowerCase().endsWith(suffix.toLowerCase())) matches.push(relPath);
      }
    }
  }
  return matches.sort((a, b) => a.length - b.length || a.localeCompare(b));
}
