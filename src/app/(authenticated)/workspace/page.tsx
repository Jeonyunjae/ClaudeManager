'use client';

import React, { Suspense, lazy } from 'react';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { useOfficeStore } from '@/stores/officeStore';
import { useAgentStore } from '@/stores/agentStore';
import { useAgentDetailStore } from '@/stores/agentDetailStore';
import { PartTabs } from '@/components/layout/PartTabs';
import { MessageList } from '@/components/chat/MessageList';
import { ChatInput } from '@/components/chat/ChatInput';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Placeholder for 3D canvas (lazy loaded separately when 3D is ready)
function OfficeCanvasPlaceholder() {
  const { tree } = useAgentStore();

  return (
    <div className="flex-1 relative bg-[var(--bg-3d-scene)] flex items-center justify-center overflow-hidden">
      {/* Stylized placeholder representing the 3D workspace */}
      <div className="text-center p-8">
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-[var(--primary-100)] flex items-center justify-center">
          <span className="text-4xl font-bold text-[var(--primary-500)]">3D</span>
        </div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
          워크스페이스
        </h2>
        <p className="text-sm text-[var(--text-secondary)] max-w-md">
          {tree.length === 0
            ? 'AI 동료들과 함께할 공간입니다. Skill을 실행하여 첫 부서를 만들어보세요.'
            : `${tree.length}명의 에이전트가 이 공간에서 함께 일하고 있습니다.`}
        </p>

        {/* Agent status cards */}
        {tree.length > 0 && (
          <div className="mt-8 grid grid-cols-2 gap-3 max-w-md mx-auto">
            {tree.map((agent) => (
              <button
                key={agent.id}
                onClick={() => useAgentDetailStore.getState().openAgent(agent.id)}
                className="p-3 bg-white rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] border border-[var(--primary-50)] text-left hover:shadow-[var(--shadow-md)] transition-shadow"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    'w-2 h-2 rounded-full',
                    agent.status === 'active' ? 'bg-[var(--status-active)]' :
                    agent.status === 'error' ? 'bg-[var(--status-error)]' :
                    agent.status === 'pending' ? 'bg-[var(--status-pending)]' :
                    'bg-[var(--status-idle)]'
                  )} />
                  <span className="text-xs font-medium text-[var(--text-primary)]">{agent.name}</span>
                </div>
                {agent.statusMessage && (
                  <p className="text-[10px] text-[var(--text-tertiary)] truncate">{agent.statusMessage}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatPanel() {
  return (
    <div className="flex flex-col h-full border-l border-[var(--primary-50)] bg-[var(--bg-surface)]">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--primary-50)]">
        <div className="w-8 h-8 rounded-full bg-[var(--primary-100)] flex items-center justify-center">
          <span className="text-xs font-bold text-[var(--primary-600)]">M</span>
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">비서실장</p>
          <p className="text-[10px] text-[var(--status-complete-text)]">온라인</p>
        </div>
      </div>
      <MessageList />
      <ChatInput />
    </div>
  );
}

export default function WorkspacePage() {
  const isDesktop = useIsDesktop();
  const { isChatOpen, viewMode, toggleChat } = useOfficeStore();

  return (
    <div className="flex flex-col h-[calc(100vh-96px)]">
      <PartTabs />

      <div className="flex-1 flex overflow-hidden">
        {isDesktop ? (
          <>
            <OfficeCanvasPlaceholder />
            {isChatOpen && (
              <div className="w-[400px] min-w-[320px]">
                <ChatPanel />
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col">
            <ChatPanel />
          </div>
        )}
      </div>

      {/* Floating chat toggle button (desktop only) */}
      {isDesktop && (
        <button
          onClick={toggleChat}
          className="fixed bottom-16 right-6 z-40 w-12 h-12 rounded-full bg-[var(--primary-500)] text-white shadow-[var(--shadow-lg)] flex items-center justify-center hover:bg-[var(--primary-600)] transition-colors"
        >
          <span className="text-lg font-bold">M</span>
        </button>
      )}
    </div>
  );
}
