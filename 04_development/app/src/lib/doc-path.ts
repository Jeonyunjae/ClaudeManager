/**
 * 모바일 문서 화면 경로 도우미 (FEAT-003). 경로는 노트 API와 같은 상대 경로(`docs/deploy`)다.
 */

/** 상위 폴더 경로. 최상위면 '' */
export function parentPath(p: string): string {
  const parts = p.split('/').filter(Boolean);
  parts.pop();
  return parts.join('/');
}

/** 경로 표시줄 — 최상위(`rootLabel`)부터 현재 폴더까지 누를 수 있는 조각 */
export function breadcrumbs(p: string, rootLabel: string): { name: string; path: string }[] {
  const parts = p.split('/').filter(Boolean);
  return [
    { name: rootLabel, path: '' },
    ...parts.map((name, i) => ({ name, path: parts.slice(0, i + 1).join('/') })),
  ];
}

/** 파일 이름에서 확장자(.md·.txt)를 뗀 제목 */
export function docTitle(file: string): string {
  const name = file.split('/').pop() || file;
  return name.replace(/\.(md|txt)$/i, '');
}

/** 노트 탭 루트 종류별 최상위 이름 */
export function rootLabelOf(source: string | undefined): string {
  if (source === 'projects') return '전체 프로젝트';
  if (source === 'custom') return '노트';
  return '작업 폴더';
}
