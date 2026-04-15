'use client';

import React, { useEffect, useState } from 'react';
import { useAgentDetailStore } from '@/stores/agentDetailStore';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatRelativeTime } from '@/lib/utils';

export function AgentLogTab() {
  const { selectedAgent, logs, fetchLogs } = useAgentDetailStore();
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (selectedAgent) {
      fetchLogs(selectedAgent.id);
    }
  }, [selectedAgent, fetchLogs]);

  const filteredLogs = search
    ? logs.filter((log) =>
        log.message?.toLowerCase().includes(search.toLowerCase()) ||
        log.eventType.toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  const eventBadgeVariant = (eventType: string) => {
    if (eventType === 'error') return 'error' as const;
    if (eventType === 'complete' || eventType === 'task_complete') return 'complete' as const;
    if (eventType === 'token_usage') return 'pending' as const;
    return 'active' as const;
  };

  return (
    <div className="space-y-3">
      <Input
        placeholder="Search logs..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="text-sm"
      />

      {filteredLogs.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-sm text-[var(--text-tertiary)]">
          로그가 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="p-2 rounded-[var(--radius-sm)] border border-[var(--primary-50)] text-xs"
            >
              <div className="flex items-center justify-between mb-1">
                <Badge variant={eventBadgeVariant(log.eventType)}>{log.eventType}</Badge>
                <span className="text-[10px] text-[var(--text-tertiary)]">
                  {formatRelativeTime(log.createdAt)}
                </span>
              </div>
              <p className="text-[var(--text-primary)]">{log.message}</p>
              {(log.inputTokens || log.outputTokens) && (
                <p className="text-[var(--text-tertiary)] mt-1">
                  Tokens: {log.inputTokens || 0} in / {log.outputTokens || 0} out
                  {log.cost != null && ` | $${log.cost.toFixed(4)}`}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
