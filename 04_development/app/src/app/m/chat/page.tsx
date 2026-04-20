'use client';

import React from 'react';
import { MessageList } from '@/components/chat/MessageList';
import { ChatInput } from '@/components/chat/ChatInput';
import { useApprovalStore } from '@/stores/approvalStore';

export default function MobileChatPage() {
  const { pendingList } = useApprovalStore();

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--primary-50)] bg-[var(--bg-surface)]">
        <div className="w-8 h-8 rounded-full bg-[var(--primary-100)] flex items-center justify-center">
          <span className="text-xs font-bold text-[var(--primary-600)]">M</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--text-primary)]">비서실장</p>
          <p className="text-[10px] text-[var(--status-complete-text)]">온라인</p>
        </div>
      </div>

      {/* Approval banner */}
      {pendingList.length > 0 && (
        <div className="px-4 py-2 bg-[var(--status-pending-bg)] border-b border-[var(--status-pending)]">
          <p className="text-xs font-medium text-[var(--status-pending-text)]">
            승인 대기 {pendingList.length}건
          </p>
        </div>
      )}

      <MessageList />
      <ChatInput />
    </div>
  );
}
