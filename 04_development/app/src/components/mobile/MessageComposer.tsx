'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { decideEnterAction } from '@/lib/composer-keys';

type MessageComposerProps = {
  sending: boolean;
  /** 성공 시 true, 실패 시 false를 돌려준다 — DF-009: 실패하면 입력 내용을 복원한다 */
  onSend: (content: string) => Promise<boolean>;
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

  // value가 어떤 경로로든(타이핑, 전송 시 비움, 실패 시 복원) 바뀌면 높이를 다시 맞춘다 —
  // DOM에 반영된 뒤(커밋 후) 실행되어야 scrollHeight가 정확하다.
  useEffect(() => {
    if (textareaRef.current) autoResize(textareaRef.current);
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>): void {
    setValue(e.target.value);
  }

  async function handleSubmit(): Promise<void> {
    if (!canSend) return;
    const content = value;
    setValue(''); // EVT-M02-2: 입력창 비움 (전송 시도와 동시에 즉시)

    const ok = await onSend(content);

    // DF-009: 전송 실패 시 입력 내용 복원. 그 사이 사용자가 새로 입력을 시작했으면(값이 비어 있지
    // 않으면) 그 입력을 덮어쓰지 않는다.
    if (!ok) {
      setValue((latest) => (latest === '' ? content : latest));
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key !== 'Enter' || e.shiftKey) return;

    // BUG-010: IME(한글 등) 조합 중 Enter, 터치 기기의 Enter는 전송하지 않는다.
    const isCoarsePointer =
      typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const action = decideEnterAction({
      isComposing: e.nativeEvent.isComposing,
      keyCode: e.keyCode,
      isCoarsePointer,
    });

    if (action === 'send') {
      e.preventDefault();
      handleSubmit();
    }
    // action === 'default': 조합 확정(IME) 또는 줄바꿈(터치 기기)에 기본 동작을 맡긴다.
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
