'use client';

import React from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { baseRemarkPlugins } from '@/lib/markdown-plugins';
import { cn } from '@/lib/utils';
import { docRefFromHref, isExternalHref, isWholeDocRef, remarkDocRefs } from '@/lib/doc-refs';

/**
 * 모바일 마크다운 본문 (BUG-030, FEAT-003, FEAT-004). 데스크톱과 같은 `.chat-markdown` 스타일을 쓴다 —
 * 코드 블록은 가로 스크롤, 표는 스크롤 상자로 감싸 화면 밖으로 넘치지 않게 한다.
 *
 * `docHref`를 주면 본문 속 문서 경로(`docs/a.md`)와 문서로 가는 상대 링크가 문서 화면 링크가 된다.
 * 웹 주소는 새 창으로 연다 — 앱 화면을 잃지 않게.
 */
export function MarkdownBody({
  content,
  className,
  docHref,
  children,
}: {
  content: string;
  className?: string;
  docHref?: (ref: string) => string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn('chat-markdown min-w-0 text-sm text-[var(--text-primary)] [overflow-wrap:anywhere]', className)}>
      <ReactMarkdown
        remarkPlugins={docHref ? [...baseRemarkPlugins, remarkDocRefs] : baseRemarkPlugins}
        components={{
          table: ({ node: _node, ...props }) => (
            <div className="overflow-x-auto">
              <table {...props} />
            </div>
          ),
          a: ({ node: _node, href, children: linkChildren, ...props }) => {
            const ref = docRefFromHref(href) ?? (href && !isExternalHref(href) && isWholeDocRef(href) ? href : null);
            if (ref && docHref) {
              return (
                <Link href={docHref(ref)} className="text-[var(--primary-600)] underline decoration-dotted underline-offset-2">
                  {linkChildren}
                </Link>
              );
            }
            return (
              <a href={href} {...props} {...(isExternalHref(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                {linkChildren}
              </a>
            );
          },
        }}
      >
        {content || ' '}
      </ReactMarkdown>
      {children}
    </div>
  );
}
