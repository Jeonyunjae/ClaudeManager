'use client';

import React, { useEffect } from 'react';
import { useAgentDetailStore } from '@/stores/agentDetailStore';
import { Badge } from '@/components/ui/badge';
import { formatRelativeTime } from '@/lib/utils';

export function AgentConversationTab() {
  const { selectedAgent, conversations, fetchConversations } = useAgentDetailStore();

  useEffect(() => {
    if (selectedAgent) {
      fetchConversations(selectedAgent.id);
    }
  }, [selectedAgent, fetchConversations]);

  if (conversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-[var(--text-tertiary)]">
        대화 이력이 없습니다.
      </div>
    );
  }

  const typeBadgeVariant = (type: string) => {
    switch (type) {
      case 'instruction': return 'active' as const;
      case 'report': return 'complete' as const;
      case 'approval': return 'pending' as const;
      default: return 'idle' as const;
    }
  };

  return (
    <div className="space-y-3">
      {conversations.map((conv) => (
        <div
          key={conv.id}
          className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--primary-50)]"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                {conv.fromAgent} &rarr; {conv.toAgent}
              </span>
              <Badge variant={typeBadgeVariant(conv.type)}>{conv.type}</Badge>
            </div>
            <span className="text-[10px] text-[var(--text-tertiary)]">
              {formatRelativeTime(conv.timestamp)}
            </span>
          </div>
          <p className="text-sm text-[var(--text-primary)]">{conv.content}</p>
        </div>
      ))}
    </div>
  );
}
