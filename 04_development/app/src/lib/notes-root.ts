/**
 * 노트 탭이 보여 줄 폴더 결정 (FEAT-002, D-26).
 *
 * - custom   : 대표가 지정한 노트 경로(옵시디언 볼트 등). 지금과 같다.
 * - project  : 지정이 없으면 그 에이전트의 작업 폴더 — Sub가 쓴 문서를 바로 본다.
 * - projects : Main은 작업 폴더가 없어서 전체 프로젝트 폴더(`PROJECT_ROOT`)를 본다.
 * - none     : 보여 줄 폴더가 없다 → 노트 탭은 경로 설정 화면을 띄운다.
 *
 * 자동으로 연결한 폴더(project·projects)는 에이전트 원본 문서라 읽기 전용이다.
 */
export type NotesRootSource = 'custom' | 'project' | 'projects' | 'none';

export type NotesRoot = {
  path: string | null;
  source: NotesRootSource;
  readOnly: boolean;
};

export type NotesRootAgent = {
  role: string;
  notesPath: string | null;
  projectRoot: string | null;
};

export function resolveNotesRoot(
  agent: NotesRootAgent,
  projectsRoot: string | undefined = process.env.PROJECT_ROOT
): NotesRoot {
  if (agent.notesPath) return { path: agent.notesPath, source: 'custom', readOnly: false };
  if (agent.projectRoot) return { path: agent.projectRoot, source: 'project', readOnly: true };
  if (agent.role === 'main' && projectsRoot) return { path: projectsRoot, source: 'projects', readOnly: true };
  return { path: null, source: 'none', readOnly: true };
}

/** 목록에서 숨기는 폴더 — 점(.)으로 시작하는 폴더는 원래 숨긴다. 의존성 폴더는 문서가 아니라 수만 개라 뺀다 */
export const HIDDEN_NOTE_DIRS = new Set(['node_modules']);
