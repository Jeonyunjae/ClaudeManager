/**
 * 대화 속 문서 참조 감지 단위 테스트 — FEAT-004 (D-29)
 * 실제 운영 답변에서 뽑은 형태(docs/reports/…md, `00-approvals.md`, URL)를 기준으로 한다.
 */
import { describe, it, expect } from 'vitest';
import {
  findDocRefs, isWholeDocRef, docRefHref, docRefFromHref, isExternalHref, remarkDocRefs,
} from '@/lib/doc-refs';

type N = { type: string; value?: string; url?: string; children?: N[] };
const run = (tree: N) => { remarkDocRefs()(tree as never); return tree; };
const p = (...children: N[]): N => ({ type: 'root', children: [{ type: 'paragraph', children }] });

describe('findDocRefs', () => {
  it('문장 속 상대 경로', () => {
    expect(findDocRefs('보고서는 docs/reports/2026-10-16-trial-plan.md 에 있습니다').map((r) => r.ref))
      .toEqual(['docs/reports/2026-10-16-trial-plan.md']);
  });

  it('여러 개·한글 파일명·이름만', () => {
    expect(findDocRefs('story.md 와 docs/기획/안내.md, 00-approvals.md').map((r) => r.ref))
      .toEqual(['story.md', 'docs/기획/안내.md', '00-approvals.md']);
  });

  it('절대 경로·./ 상대 경로', () => {
    expect(findDocRefs('/home/u/p/docs/a.md 그리고 ./b.txt').map((r) => r.ref)).toEqual(['/home/u/p/docs/a.md', './b.txt']);
  });

  it('URL 안의 .md나 코드 파일은 잡지 않는다', () => {
    expect(findDocRefs('https://github.com/x/y/blob/main/README.md 참고')).toEqual([]);
    expect(findDocRefs('src/lib/litellm.ts 수정')).toEqual([]);
    expect(findDocRefs('a.mdx, a.md5')).toEqual([]);
  });
});

describe('isWholeDocRef', () => {
  it('인라인 코드 전체가 문서 경로일 때만', () => {
    expect(isWholeDocRef('docs/a.md')).toBe(true);
    expect(isWholeDocRef('00-approvals.md')).toBe(true);
    expect(isWholeDocRef('npm run docs/a.md --x')).toBe(false);
    expect(isWholeDocRef('next.config.ts')).toBe(false);
  });
});

describe('href 도우미', () => {
  it('왕복 인코딩 (한글·공백)', () => {
    expect(docRefFromHref(docRefHref('docs/기획 안.md'))).toBe('docs/기획 안.md');
  });
  it('문서 링크가 아니면 null', () => {
    expect(docRefFromHref('https://a.com')).toBeNull();
    expect(docRefFromHref(undefined)).toBeNull();
  });
  it('외부 링크 판정', () => {
    expect(isExternalHref('https://a.com')).toBe(true);
    expect(isExternalHref('http://a.com')).toBe(true);
    expect(isExternalHref('#cmdoc=a.md')).toBe(false);
    expect(isExternalHref('./a.md')).toBe(false);
  });
});

describe('remarkDocRefs', () => {
  it('텍스트 속 경로를 링크 노드로 쪼갠다', () => {
    const tree = run(p({ type: 'text', value: '자세한 건 docs/a.md 를 보세요' }));
    const kids = tree.children![0].children!;
    expect(kids.map((k) => k.type)).toEqual(['text', 'link', 'text']);
    expect(kids[1].url).toBe(docRefHref('docs/a.md'));
    expect(kids[1].children![0].value).toBe('docs/a.md');
  });

  it('인라인 코드 `docs/a.md`는 코드 모양을 유지한 채 링크로 감싼다', () => {
    const tree = run(p({ type: 'inlineCode', value: 'docs/a.md' }));
    const link = tree.children![0].children![0];
    expect(link.type).toBe('link');
    expect(link.children![0]).toEqual({ type: 'inlineCode', value: 'docs/a.md' });
  });

  it('이미 링크인 것과 코드 블록은 건드리지 않는다', () => {
    const tree = run({
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'link', url: 'https://x', children: [{ type: 'text', value: 'docs/a.md' }] }] },
        { type: 'code', value: 'cat docs/a.md' },
      ],
    });
    expect(tree.children![0].children![0].url).toBe('https://x');
    expect(tree.children![0].children![0].children![0]).toEqual({ type: 'text', value: 'docs/a.md' });
    expect(tree.children![1]).toEqual({ type: 'code', value: 'cat docs/a.md' });
  });

  it('굵게·목록 안쪽까지 들어가서 바꾼다', () => {
    const tree = run({ type: 'root', children: [{ type: 'list', children: [{ type: 'listItem', children: [{ type: 'paragraph', children: [{ type: 'strong', children: [{ type: 'text', value: 'plan.md' }] }] }] }] }] });
    const strong = tree.children![0].children![0].children![0].children![0];
    expect(strong.children![0].type).toBe('link');
  });
});
