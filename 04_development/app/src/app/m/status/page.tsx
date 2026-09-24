'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAgentStore } from '@/stores/agentStore';
import { useAuthStore } from '@/stores/authStore';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useViewMode } from '@/hooks/useViewMode';
import { agentRoleLabel, agentStatusLabel } from '@/lib/mobile-format';
import type { AgentTreeNode } from '@/types/agent';

function statusDotClass(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-[var(--status-active)]';
    case 'error':
      return 'bg-[var(--status-error)]';
    case 'pending':
    case 'retrying':
      return 'bg-[var(--status-pending)]';
    default:
      return 'bg-[var(--status-idle)]';
  }
}

function statusBadgeVariant(status: string): 'active' | 'error' | 'pending' | 'idle' {
  if (status === 'active') return 'active';
  if (status === 'error') return 'error';
  if (status === 'pending' || status === 'retrying') return 'pending';
  return 'idle';
}

/** SCR-M04 상태 `/m/status` — DES-006, FR-014·FR-015·FR-002 */
export default function MobileStatusPage() {
  const router = useRouter();
  const { setViewMode } = useViewMode();
  const { tree, fetchTree } = useAgentStore();
  const { logout } = useAuthStore();

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  // EVT-M04-2: ForcedDesktop 전환 — 같은 세션 동안 자동으로 모바일로 되돌아가지 않는다 (FR-002).
  function handleDesktopView(): void {
    setViewMode('desktop');
    router.push('/dashboard');
  }

  // EVT-M04-3: 토큰 삭제(푸시 구독은 유지) 후 로그인 화면으로.
  function handleLogout(): void {
    logout();
    router.push('/login');
  }

  // EVT-M04-1: role ≠ instance인 카드·하위 행만 탭 가능
  function handleOpen(node: AgentTreeNode | { id: string; role: string }): void {
    if (node.role === 'instance') return;
    router.push(`/m/chat/${node.id}`);
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 py-3 border-b border-[var(--primary-50)] bg-[var(--bg-surface)]">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">상태</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {tree.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-[var(--text-tertiary)]">
            등록된 에이전트가 없습니다
          </div>
        ) : (
          tree.map((agent) => (
            <div
              key={agent.id}
              className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--primary-50)] shadow-[var(--shadow-sm)] p-4"
            >
              <button
                type="button"
                onClick={() => handleOpen(agent)}
                disabled={agent.role === 'instance'}
                className="w-full text-left flex items-center justify-between mb-2 min-h-[44px]"
              >
                <div className="flex items-center gap-2">
                  <span className={cn('w-2.5 h-2.5 rounded-full', statusDotClass(agent.status))} />
                  <span className="font-medium text-sm">{agent.name}</span>
                  <span className="text-xs text-[var(--text-tertiary)]">{agentRoleLabel(agent.role)}</span>
                </div>
                <Badge variant={statusBadgeVariant(agent.status)}>{agentStatusLabel(agent.status)}</Badge>
              </button>
              {agent.statusMessage && (
                <p className="text-xs text-[var(--text-secondary)] mb-2">{agent.statusMessage}</p>
              )}
              {agent.children.length > 0 && (
                <div className="space-y-1 mt-2 pl-3 border-l-2 border-[var(--primary-100)]">
                  {agent.children.map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => handleOpen(child)}
                      disabled={child.role === 'instance'}
                      className="w-full flex items-center justify-between text-xs min-h-[44px] text-left"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={cn('w-1.5 h-1.5 rounded-full', statusDotClass(child.status))} />
                        <span>{child.name}</span>
                      </div>
                      <span className="text-[var(--text-tertiary)]">
                        {agentRoleLabel(child.role)} · {agentStatusLabel(child.status)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}

        <div className="text-center pt-4 space-y-3">
          <button
            type="button"
            onClick={handleDesktopView}
            className="min-h-[44px] text-xs text-[var(--text-link)] bg-transparent border-none cursor-pointer"
          >
            데스크톱 화면으로 보기
          </button>
          <div>
            <button
              type="button"
              onClick={handleLogout}
              className="min-h-[44px] text-xs text-[var(--status-error-text)] bg-transparent border-none cursor-pointer"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
