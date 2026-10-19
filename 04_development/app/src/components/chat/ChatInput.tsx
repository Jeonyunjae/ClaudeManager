'use client';

import React, { useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChatStore } from '@/stores/chatStore';
import { useEnterToSend } from '@/hooks/useEnterToSend';

export function ChatInput() {
  const { input, setInput, sendMessage } = useChatStore();
  // BUG-033: 한글 조합 중 Enter → 조합이 끝나는 순간 1회 전송 (브라우저별 순서 차이 흡수)
  const enter = useEnterToSend((text) => sendMessage(text));
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  return (
    <div className="flex items-end gap-2 p-[var(--space-4)] border-t border-[var(--primary-50)] bg-[var(--bg-surface)]">
      <textarea
        ref={(el) => {
          textareaRef.current = el;
          enter.setElement(el);
        }}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={enter.onKeyDown}
        onCompositionStart={enter.onCompositionStart}
        onCompositionEnd={enter.onCompositionEnd}
        placeholder="Main에게 메시지 입력..."
        rows={1}
        className="flex-1 resize-none rounded-[var(--radius-2xl)] border border-[var(--primary-200)] bg-[var(--bg-chat)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--primary-500)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-200)] transition-colors"
      />
      <Button
        onClick={() => sendMessage()}
        disabled={!input.trim()}
        size="icon"
        className="rounded-full h-10 w-10 shrink-0"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
