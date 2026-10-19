/**
 * 굵은 글씨(CJK) 렌더 단위 테스트 — BUG-035
 * 대표 캡처(2026-09-28)의 실제 문장: 닫는 ** 앞이 ")"이고 뒤가 한글이라 ** 가 그대로 보였다.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { baseRemarkPlugins } from '@/lib/markdown-plugins';
import { remarkDocRefs } from '@/lib/doc-refs';

const render = (md: string, plugins: unknown[]) =>
  renderToStaticMarkup(React.createElement(ReactMarkdown, { remarkPlugins: plugins as never }, md));

const SENTENCE = '대표님 결재는 **로그라인·시놉시스(②), 캐릭터 바이블(③), 대본(④), 스토리보드(⑤), 완성 영상(⑩)**에서 받는 것을 제안합니다.';

describe('baseRemarkPlugins', () => {
  it('기존(remark-gfm만)은 굵게가 안 된다 — 결함 재현', () => {
    const html = render(SENTENCE, [remarkGfm]);
    expect(html).not.toContain('<strong>');
    expect(html).toContain('**');
  });

  it('CJK 보완 후 굵게 표시되고 ** 가 남지 않는다', () => {
    const html = render(SENTENCE, baseRemarkPlugins);
    expect(html).toContain('<strong>로그라인·시놉시스(②), 캐릭터 바이블(③), 대본(④), 스토리보드(⑤), 완성 영상(⑩)</strong>에서');
    expect(html).not.toContain('**');
  });

  it('흔한 형태들: 따옴표·괄호 뒤 조사, 영문 혼합', () => {
    expect(render('**"승인"**을 눌러 주세요', baseRemarkPlugins)).toContain('<strong>&quot;승인&quot;</strong>을');
    expect(render('**API(키)**는 필요', baseRemarkPlugins)).toContain('<strong>API(키)</strong>는');
  });

  it('표·체크박스(GFM)와 문서 참조 링크는 그대로 동작', () => {
    const html = render('| a |\n|---|\n| **굵게(1)**다 |\n\n- [x] 완료\n\n보고서 docs/a.md 참고', [...baseRemarkPlugins, remarkDocRefs]);
    expect(html).toContain('<table>');
    expect(html).toContain('<strong>굵게(1)</strong>다');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('href="#cmdoc=docs%2Fa.md"');
  });
});
