'use client';

import React, { useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAgentStore } from '@/stores/agentStore';
import { useCostStore } from '@/stores/costStore';
import { useApprovalStore } from '@/stores/approvalStore';
import { formatCurrency } from '@/lib/utils';

export default function DashboardPage() {
  const { tree, agents } = useAgentStore();
  const { summary, fetchAll } = useCostStore();
  const { pendingList } = useApprovalStore();

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const activeCount = Array.from(agents.values()).filter((a) => a.status === 'active').length;
  const errorCount = Array.from(agents.values()).filter((a) => a.status === 'error').length;

  return (
    <div className="p-[var(--space-6)] space-y-6">
      <h1 className="text-[var(--text-h1)] font-bold">대시보드</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--text-secondary)] font-normal">활성 에이전트</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeCount}<span className="text-sm text-[var(--text-tertiary)] font-normal ml-1">/ {agents.size}</span></p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--text-secondary)] font-normal">승인 대기</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[var(--status-pending-text)]">{pendingList.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--text-secondary)] font-normal">이번 달 비용</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary ? formatCurrency(summary.totalCost) : '--'}</p>
            {summary && (
              <div className="mt-2 w-full bg-[var(--primary-50)] rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-[var(--primary-500)] transition-all"
                  style={{ width: `${Math.min(100, summary.percentage)}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--text-secondary)] font-normal">오류</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${errorCount > 0 ? 'text-[var(--status-error-text)]' : 'text-[var(--status-complete-text)]'}`}>
              {errorCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Agent Tree */}
      <Card>
        <CardHeader>
          <CardTitle>에이전트 트리</CardTitle>
        </CardHeader>
        <CardContent>
          {tree.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">등록된 에이전트가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {tree.map((agent) => (
                <div key={agent.id} className="border border-[var(--primary-50)] rounded-[var(--radius-md)] p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{agent.name}</span>
                      <Badge variant={agent.status === 'active' ? 'active' : agent.status === 'error' ? 'error' : 'idle'}>
                        {agent.status}
                      </Badge>
                    </div>
                    <span className="text-xs text-[var(--text-tertiary)]">{agent.role}</span>
                  </div>
                  {agent.statusMessage && (
                    <p className="text-xs text-[var(--text-secondary)] mt-1">{agent.statusMessage}</p>
                  )}
                  {agent.children.length > 0 && (
                    <div className="ml-4 mt-2 space-y-1">
                      {agent.children.map((child) => (
                        <div key={child.id} className="flex items-center gap-2 text-xs">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            child.status === 'active' ? 'bg-[var(--status-active)]' :
                            child.status === 'error' ? 'bg-[var(--status-error)]' : 'bg-[var(--status-idle)]'
                          }`} />
                          <span>{child.name}</span>
                          <span className="text-[var(--text-tertiary)]">({child.role})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Approvals */}
      {pendingList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>승인 대기 목록</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingList.map((approval) => (
                <div key={approval.id} className="border-l-4 border-l-[var(--status-pending)] border border-[var(--primary-50)] rounded-[var(--radius-md)] p-3">
                  <p className="font-medium text-sm">{approval.title}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{approval.content}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
