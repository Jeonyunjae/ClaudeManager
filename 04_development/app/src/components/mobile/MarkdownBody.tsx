'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

/**
 * 모바일 마크다운 본문 (BUG-030, FEAT-003). 데스크톱과 같은 `.chat-markdown` 스타일을 쓴다 —
 * 코드 블록은 가로 스크롤, 표는 스크롤 상자로 감싸 화면 밖으로 넘치지 않게 한다.
 * 대화 말풍선과 문서 보기 화면이 함께 쓴다.
 */
export function MarkdownBody({
  content,
  className,
  children,
}: {
  content: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn('chat-markdown min-w-0 text-sm text-[var(--text-primary)] [overflow-wrap:anywhere]', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ node: _node, ...props }) => (
            <div className="overflow-x-auto">
              <table {...props} />
            </div>
          ),
        }}
      >
        {content || ' '}
      </ReactMarkdown>
      {children}
    </div>
  );
}
