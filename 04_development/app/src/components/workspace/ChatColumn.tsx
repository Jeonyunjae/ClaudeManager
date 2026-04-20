'use client';

import React from 'react';
import { MessageSquare } from 'lucide-react';
import { MessageList } from '@/components/chat/MessageList';
import { ChatInput } from '@/components/chat/ChatInput';

export function ChatColumn() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--primary-50)]">
        <div className="w-7 h-7 rounded-full bg-[var(--primary-100)] flex items-center justify-center">
          <span className="text-[10px] font-bold text-[var(--primary-600)]">M</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[var(--primary-500)]" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Chat</h3>
          </div>
          <p className="text-[10px] text-[var(--status-complete-text)]">Main online</p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <MessageList />
        <ChatInput />
      </div>
    </div>
  );
}
