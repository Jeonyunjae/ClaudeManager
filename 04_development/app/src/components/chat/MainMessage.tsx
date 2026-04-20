'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage } from '@/types/chat';
import { formatRelativeTime } from '@/lib/utils';

type MainMessageProps = {
  message: ChatMessage;
};

export function MainMessage({ message }: MainMessageProps) {
  return (
    <div className="flex justify-start mb-3">
      <div className="flex gap-2 max-w-[80%]">
        {/* Avatar */}
        <div className="shrink-0 w-8 h-8 rounded-full bg-[var(--primary-100)] flex items-center justify-center">
          <span className="text-xs font-bold text-[var(--primary-600)]">M</span>
        </div>
        <div>
          <p className="text-[10px] text-[var(--text-tertiary)] mb-0.5">비서실장</p>
          <div className="bg-white border border-[var(--primary-50)] px-4 py-2.5 rounded-[var(--radius-2xl)] rounded-bl-[var(--radius-sm)] shadow-[var(--shadow-sm)]">
            <div className="text-sm prose prose-sm max-w-none text-[var(--text-primary)]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          </div>
          <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
            {formatRelativeTime(message.createdAt)}
          </p>
        </div>
      </div>
    </div>
  );
}
