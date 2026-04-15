'use client';

import React, { useEffect, useRef } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { UserMessage } from './UserMessage';
import { MainMessage } from './MainMessage';
import { TypingIndicator } from './TypingIndicator';

export function MessageList() {
  const { messages, isTyping, isLoading, loadMessages, loadMore, hasMore } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (isInitialLoad.current && messages.length > 0) {
      bottomRef.current?.scrollIntoView();
      isInitialLoad.current = false;
    } else if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container || isLoading || !hasMore) return;
    if (container.scrollTop < 50) {
      loadMore();
    }
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-[var(--space-4)] bg-[var(--bg-chat)]"
    >
      {isLoading && (
        <div className="text-center py-4">
          <span className="text-sm text-[var(--text-tertiary)]">메시지 로딩 중...</span>
        </div>
      )}

      {messages.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--primary-100)] flex items-center justify-center mb-4">
            <span className="text-2xl font-bold text-[var(--primary-500)]">M</span>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            비서실장에게 메시지를 보내보세요.
          </p>
        </div>
      )}

      {messages.map((msg) =>
        msg.sender === 'user' ? (
          <UserMessage key={msg.id} message={msg} />
        ) : (
          <MainMessage key={msg.id} message={msg} />
        )
      )}

      {isTyping && <TypingIndicator />}

      <div ref={bottomRef} />
    </div>
  );
}
