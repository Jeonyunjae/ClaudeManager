/**
 * 노트 탭 폴더 결정 단위 테스트 — FEAT-002 (D-26)
 */
import { describe, it, expect } from 'vitest';
import { resolveNotesRoot } from '@/lib/notes-root';

const PROJECTS = '/home/u/.claudemanager/projects';

describe('resolveNotesRoot', () => {
  it('지정한 노트 경로가 있으면 그 경로를 쓰고 편집 가능', () => {
    expect(resolveNotesRoot({ role: 'sub', notesPath: '/vault', projectRoot: '/p/a' }, PROJECTS)).toEqual({
      path: '/vault', source: 'custom', readOnly: false,
    });
  });

  it('노트 경로가 없으면 Sub 작업 폴더를 읽기 전용으로', () => {
    expect(resolveNotesRoot({ role: 'sub', notesPath: null, projectRoot: '/p/a' }, PROJECTS)).toEqual({
      path: '/p/a', source: 'project', readOnly: true,
    });
  });

  it('Main은 작업 폴더가 없으면 전체 프로젝트 폴더를 읽기 전용으로', () => {
    expect(resolveNotesRoot({ role: 'main', notesPath: null, projectRoot: null }, PROJECTS)).toEqual({
      path: PROJECTS, source: 'projects', readOnly: true,
    });
  });

  it('Main이라도 지정 경로가 있으면 지정 경로가 우선', () => {
    expect(resolveNotesRoot({ role: 'main', notesPath: '/vault', projectRoot: null }, PROJECTS).source).toBe('custom');
  });

  it('작업 폴더도 없는 Sub는 none (설정 화면)', () => {
    expect(resolveNotesRoot({ role: 'sub', notesPath: null, projectRoot: null }, PROJECTS)).toEqual({
      path: null, source: 'none', readOnly: true,
    });
  });

  it('PROJECT_ROOT가 없으면 Main도 none', () => {
    expect(resolveNotesRoot({ role: 'main', notesPath: null, projectRoot: null }, undefined).source).toBe('none');
  });
});
