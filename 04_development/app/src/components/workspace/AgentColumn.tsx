'use client';

import React from 'react';
import { Users, ChevronRight, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAgentStore } from '@/stores/agentStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { cn } from '@/lib/utils';

function AgentTreeNode({
  agent,
  depth = 0,
  onSelect,
}: {
  agent: { id: string; name: string; role: string; status: string; statusMessage?: string; children: any[] };
  depth?: number;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = React.useState(true);
  const hasChildren = agent.children && agent.children.length > 0;

  const statusColor = {
    active: 'bg-[var(--status-active)]',
    idle: 'bg-[var(--status-idle)]',
    error: 'bg-[var(--status-error)]',
    pending: 'bg-[var(--status-pending)]',
    retrying: 'bg-yellow-400',
    stopped: 'bg-gray-400',
    queued: 'bg-blue-300',
  }[agent.status] || 'bg-gray-400';

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer',
          'hover:bg-[var(--primary-50)] transition-colors',
          depth > 0 && 'ml-4'
        )}
        onClick={() => onSelect(agent.id)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="p-0.5 text-[var(--text-tertiary)]"
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        ) : (
          <span className="w-4" />
        )}

        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', statusColor)} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-[var(--text-primary)] truncate">{agent.name}</span>
            <span className="text-[10px] text-[var(--text-tertiary)]">({agent.role})</span>
          </div>
          {agent.statusMessage && (
            <p className="text-[10px] text-[var(--text-secondary)] truncate">{agent.statusMessage}</p>
          )}
        </div>
      </div>

      {hasChildren && expanded && (
        <div>
          {agent.children.map((child: any) => (
            <AgentTreeNode key={child.id} agent={child} depth={depth + 1} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AgentColumn() {
  const { tree, agents } = useAgentStore();
  const { setSelectedAgentId } = useWorkspaceStore();

  const activeCount = Array.from(agents.values()).filter((a) => a.status === 'active').length;
  const totalCount = agents.size;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--primary-50)]">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[var(--primary-500)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Agents</h3>
          <span className="text-xs text-[var(--text-tertiary)]">
            {activeCount}/{totalCount}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {tree.length === 0 ? (
          <div className="text-center py-8 text-sm text-[var(--text-tertiary)]">
            No agents registered yet.
          </div>
        ) : (
          <div className="space-y-0.5">
            {tree.map((agent) => (
              <AgentTreeNode
                key={agent.id}
                agent={agent}
                onSelect={(id) => setSelectedAgentId(id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
