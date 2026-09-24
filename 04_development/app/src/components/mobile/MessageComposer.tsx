'use client';

import React, { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type MessageComposerProps = {
  sending: boolean;
  onSend: (content: string) => void;
};

const MIN_ROWS = 1;
const MAX_ROWS = 6;

/** SCR-M02 입력창 — DES-006 §MessageComposer (1~6줄 자동 높이, trim 1자 이상) */
export function MessageComposer({ sending, onSend }: MessageComposerProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = value.trim().length >= 1 && !sending;

  function autoResize(el: HTMLTextAreaElement): void {
    el.style.height = 'auto';
    const lineHeight = 20; // px, text-sm 기준
    const maxHeight = lineHeight * MAX_ROWS;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>): void {
    setValue(e.target.value);
    autoResize(e.target);
  }

  function handleSubmit(): void {
    if (!canSend) return;
    const content = value;
    setValue(''); // EVT-M02-2: 입력창 비움 (전송 성공/실패와 무관하게 즉시)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    onSend(content);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div
      className="sticky bottom-0 flex items-end gap-2 px-3 py-2 border-t border-[var(--primary-50)] bg-[var(--bg-surface)]"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
    >
      <textarea
        ref={textareaRef}
        rows={MIN_ROWS}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="메시지 입력…"
        aria-label="메시지 입력"
        className="flex-1 resize-none rounded-[var(--radius-lg)] border border-[var(--primary-100)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-300)]"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSend}
        aria-label={sending ? '전송 중' : '전송'}
        className={cn(
          'min-w-[44px] min-h-[44px] px-4 rounded-[var(--radius-lg)] text-sm font-medium transition-colors',
          canSend
            ? 'bg-[var(--primary-500)] text-white hover:bg-[var(--primary-600)]'
            : 'bg-[var(--primary-100)] text-[var(--text-tertiary)] cursor-not-allowed'
        )}
      >
        {sending ? (
          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          '전송'
        )}
      </button>
    </div>
  );
}
