'use client';

import React from 'react';
import { Modal, ModalContent, ModalHeader, ModalTitle } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { useAgentDetailStore } from '@/stores/agentDetailStore';
import { cn } from '@/lib/utils';
import { AgentConversationTab } from './AgentConversationTab';
import { AgentNoteTab } from './AgentNoteTab';
import { AgentLogTab } from './AgentLogTab';
import { AgentTerminalTab } from './AgentTerminalTab';

const TABS = [
  { key: 'info' as const, label: 'Info' },
  { key: 'cli' as const, label: 'CLI' },
  { key: 'chat' as const, label: 'Chat' },
  { key: 'log' as const, label: 'Logs' },
  { key: 'note' as const, label: 'Notes' },
];

export function AgentModal() {
  const { selectedAgent, activeTab, setActiveTab, closeAgent } = useAgentDetailStore();

  if (!selectedAgent) return null;

  const statusVariant = selectedAgent.status === 'active' ? 'active'
    : selectedAgent.status === 'error' ? 'error'
    : selectedAgent.status === 'pending' ? 'pending'
    : 'idle';

  return (
    <Modal open={!!selectedAgent} onOpenChange={(open) => { if (!open) closeAgent(); }}>
      <ModalContent size="xl">
        <div className="flex flex-col h-[70vh] p-6">
          {/* Agent header */}
          <div className="flex items-center gap-3 pb-4 border-b border-[var(--primary-50)]">
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm',
              selectedAgent.status === 'active' ? 'bg-[var(--status-active)]' :
              selectedAgent.status === 'error' ? 'bg-[var(--status-error)]' :
              'bg-[var(--primary-300)]'
            )}>
              {selectedAgent.name.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">{selectedAgent.name}</h2>
                <Badge variant={statusVariant}>{selectedAgent.status}</Badge>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                {selectedAgent.role} | {selectedAgent.modelName || 'No model'} | Uptime: {selectedAgent.uptimeSeconds ? `${Math.round(selectedAgent.uptimeSeconds / 60)}m` : 'N/A'}
              </p>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 mt-3 border-b border-[var(--primary-50)]">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
                  activeTab === tab.key
                    ? 'border-[var(--primary-500)] text-[var(--primary-600)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto mt-3">
            {activeTab === 'info' && <div>Info</div>}
            {activeTab === 'cli' && <AgentTerminalTab />}
            {activeTab === 'chat' && <AgentConversationTab />}
            {activeTab === 'log' && <AgentLogTab />}
            {activeTab === 'note' && <AgentNoteTab />}
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
