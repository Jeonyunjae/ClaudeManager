'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useInboxStore } from '@/stores/inboxStore';
import { useAgentStore } from '@/stores/agentStore';
import { useWsConnectionStatus } from '@/hooks/useMobileRealtime';
import { InboxSection } from '@/components/mobile/InboxSection';
import { AgentList } from '@/components/mobile/AgentList';
import { InstallBanner } from '@/components/mobile/InstallBanner';

/** SCR-M01 대화 목록 `/m/chat` — DES-006, FR-001·FR-003(배너)·FR-004·FR-006 */
export default function MobileChatListPage() {
  const router = useRouter();
  const connected = useWsConnectionStatus();

  const { items, loading: inboxLoading, error: inboxError, fetchInbox, ack } = useInboxStore();
  const { tree, isLoading: treeLoading, fetchTree } = useAgentStore();

  const waitingAgentIds = new Set(items.map((i) => i.agentId));

  function openAgent(agentId: string): void {
    router.push(`/m/chat/${agentId}`);
  }

  function retry(): void {
    fetchInbox();
    fetchTree();
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--primary-50)] bg-[var(--bg-surface)]">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">ClaudeManager</h1>
        <span className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
          <span
            className={`w-2 h-2 rounded-full ${connected ? 'bg-[var(--status-active)]' : 'bg-[var(--status-error)]'}`}
          />
          {connected ? '연결' : '끊김'}
        </span>
      </header>

      <InstallBanner />

      <div className="flex-1 overflow-y-auto">
        <InboxSection
          items={items}
          loading={inboxLoading}
          error={inboxError}
          onRetry={retry}
          onAck={ack}
          onOpen={openAgent}
        />
        <AgentList tree={tree} waitingAgentIds={waitingAgentIds} loading={treeLoading} onOpen={openAgent} />
      </div>
    </div>
  );
}
