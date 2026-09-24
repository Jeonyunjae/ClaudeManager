'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAgentStore } from '@/stores/agentStore';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useViewMode } from '@/hooks/useViewMode';

export default function MobileStatusPage() {
  const router = useRouter();
  const { setViewMode } = useViewMode();
  const { tree, fetchTree } = useAgentStore();

  const handleDesktopView = (): void => {
    // EVT-M04-2: ForcedDesktop으로 전환 — 같은 세션 동안 자동으로 모바일로 되돌아가지 않는다 (FR-002).
    setViewMode('desktop');
    router.push('/dashboard');
  };

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="px-4 py-3 border-b border-[var(--primary-50)] bg-[var(--bg-surface)]">
        <h1 className="text-lg font-semibold">상태</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {tree.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-[var(--text-tertiary)]">
            등록된 에이전트가 없습니다.
          </div>
        ) : (
          tree.map((agent) => (
            <div
              key={agent.id}
              className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--primary-50)] shadow-[var(--shadow-sm)] p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'w-2.5 h-2.5 rounded-full',
                    agent.status === 'active' ? 'bg-[var(--status-active)]' :
                    agent.status === 'error' ? 'bg-[var(--status-error)]' :
                    agent.status === 'pending' ? 'bg-[var(--status-pending)]' :
                    'bg-[var(--status-idle)]'
                  )} />
                  <span className="font-medium text-sm">{agent.name}</span>
                </div>
                <Badge variant={agent.status === 'active' ? 'active' : agent.status === 'error' ? 'error' : 'idle'}>
                  {agent.status}
                </Badge>
              </div>
              {agent.statusMessage && (
                <p className="text-xs text-[var(--text-secondary)] mb-2">{agent.statusMessage}</p>
              )}
              {agent.children.length > 0 && (
                <div className="space-y-1 mt-2 pl-3 border-l-2 border-[var(--primary-100)]">
                  {agent.children.map((child) => (
                    <div key={child.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          'w-1.5 h-1.5 rounded-full',
                          child.status === 'active' ? 'bg-[var(--status-active)]' :
                          child.status === 'error' ? 'bg-[var(--status-error)]' : 'bg-[var(--status-idle)]'
                        )} />
                        <span>{child.name}</span>
                      </div>
                      <span className="text-[var(--text-tertiary)]">{child.role}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}

        <div className="text-center pt-4">
          <button
            type="button"
            onClick={handleDesktopView}
            className="text-xs text-[var(--text-link)] bg-transparent border-none cursor-pointer"
          >
            데스크톱 화면으로 보기
          </button>
        </div>
      </div>
    </div>
  );
}
