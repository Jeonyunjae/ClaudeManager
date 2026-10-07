/**
 * 모바일 문서 화면 경로 도우미 단위 테스트 — FEAT-003
 */
import { describe, it, expect } from 'vitest';
import { parentPath, breadcrumbs, docTitle, rootLabelOf } from '@/lib/doc-path';

describe('parentPath', () => {
  it.each([
    ['docs/deploy/a.md', 'docs/deploy'],
    ['docs/deploy', 'docs'],
    ['docs', ''],
    ['', ''],
  ])('%s → "%s"', (input, expected) => {
    expect(parentPath(input)).toBe(expected);
  });
});

describe('breadcrumbs', () => {
  it('최상위는 루트 이름 하나', () => {
    expect(breadcrumbs('', '작업 폴더')).toEqual([{ name: '작업 폴더', path: '' }]);
  });

  it('하위 폴더는 단계별로 누적 경로', () => {
    expect(breadcrumbs('docs/deploy', '작업 폴더')).toEqual([
      { name: '작업 폴더', path: '' },
      { name: 'docs', path: 'docs' },
      { name: 'deploy', path: 'docs/deploy' },
    ]);
  });
});

describe('docTitle', () => {
  it('확장자를 뗀 파일 이름', () => {
    expect(docTitle('docs/00-approvals.md')).toBe('00-approvals');
    expect(docTitle('memo.TXT')).toBe('memo');
    expect(docTitle('README')).toBe('README');
  });
});

describe('rootLabelOf', () => {
  it('루트 종류별 이름', () => {
    expect(rootLabelOf('projects')).toBe('전체 프로젝트');
    expect(rootLabelOf('project')).toBe('작업 폴더');
    expect(rootLabelOf('custom')).toBe('노트');
    expect(rootLabelOf(undefined)).toBe('작업 폴더');
  });
});
