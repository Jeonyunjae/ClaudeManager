import React from 'react';
import type { ChatMessage } from '@/types/chat';
import { formatRelativeTime } from '@/lib/utils';

type UserMessageProps = {
  message: ChatMessage;
};

export function UserMessage({ message }: UserMessageProps) {
  return (
    <div className="flex justify-end mb-3">
      <div className="max-w-[70%]">
        <div className="bg-[var(--primary-500)] text-white px-4 py-2.5 rounded-[var(--radius-2xl)] rounded-br-[var(--radius-sm)]">
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
        <p className="text-[10px] text-[var(--text-tertiary)] mt-1 text-right">
          {formatRelativeTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}
