'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { AgentTreeNode } from '@/types/agent';
import { useAgentStore } from '@/stores/agentStore';
import { useApprovalStore } from '@/stores/approvalStore';
import { usePartStore } from '@/stores/partStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAgentDetailStore } from '@/stores/agentDetailStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  StatusDot,
  MainAgentCard,
  PartCard,
  AgentCard as AgentCardShared,
  TaskCard,
  ColumnHeader,
  ColumnEmpty,
} from './cards';

/* ── Helpers ── */
function collectByRole(nodes: AgentTreeNode[]): {
  main: AgentTreeNode | null;
  parts: AgentTreeNode[];
  subs: AgentTreeNode[];
  instances: AgentTreeNode[];
} {
  let main: AgentTreeNode | null = null;
  const parts: AgentTreeNode[] = [];
  const subs: AgentTreeNode[] = [];
  const instances: AgentTreeNode[] = [];

  function walk(node: AgentTreeNode) {
    switch (node.role) {
      case 'main': main = node; break;
      case 'part': parts.push(node); break;
      case 'sub': subs.push(node); break;
      case 'instance': instances.push(node); break;
    }
    node.children.forEach(walk);
  }
  nodes.forEach(walk);
  return { main, parts, subs, instances };
}

function getSubsForPart(tree: AgentTreeNode[], partId: string): AgentTreeNode[] {
  const result: AgentTreeNode[] = [];
  function walk(node: AgentTreeNode) {
    if (node.id === partId) {
      node.children.forEach((child) => {
        if (child.role === 'sub') result.push(child);
      });
    }
    node.children.forEach(walk);
  }
  tree.forEach(walk);
  return result;
}

function getInstancesForSub(tree: AgentTreeNode[], subId: string): AgentTreeNode[] {
  const result: AgentTreeNode[] = [];
  function walk(node: AgentTreeNode) {
    if (node.id === subId) {
      node.children.forEach((child) => {
        if (child.role === 'instance') result.push(child);
      });
    }
    node.children.forEach(walk);
  }
  tree.forEach(walk);
  return result;
}

function getAllInstances(tree: AgentTreeNode[]): AgentTreeNode[] {
  const result: AgentTreeNode[] = [];
  function walk(node: AgentTreeNode) {
    if (node.role === 'instance') result.push(node);
    node.children.forEach(walk);
  }
  tree.forEach(walk);
  return result;
}

function getInstancesForPart(tree: AgentTreeNode[], partId: string): AgentTreeNode[] {
  const result: AgentTreeNode[] = [];
  function walk(node: AgentTreeNode) {
    if (node.partId === partId && node.role === 'instance') result.push(node);
    node.children.forEach(walk);
  }
  tree.forEach(walk);
  return result;
}

function countStatusInTree(nodes: AgentTreeNode[], status: string): number {
  let count = 0;
  function walk(node: AgentTreeNode) {
    if (node.status === status) count++;
    node.children.forEach(walk);
  }
  nodes.forEach(walk);
  return count;
}

const PART_COLORS = ['#6366F1', '#E8606D', '#34D399', '#F59E0B', '#818CF8'];


/* ── Donut Chart ── */
function DonutChart({ active, pending, complete, error }: { active: number; pending: number; complete: number; error: number }) {
  const total = active + pending + complete + error;
  if (total === 0) return null;

  const circumference = 2 * Math.PI * 40; // r=40
  const completeLen = (complete / total) * circumference;
  const activeLen = (active / total) * circumference;
  const pendingLen = (pending / total) * circumference;

  return (
    <div className="flex items-center justify-center gap-6 py-2">
      <svg className="w-[120px] h-[120px]" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="var(--bg-content-card, #F3F4F6)" strokeWidth="12" />
        {complete > 0 && (
          <circle cx="50" cy="50" r="40" fill="none" stroke="var(--status-complete, #10B981)" strokeWidth="12"
            strokeDasharray={`${completeLen} ${circumference - completeLen}`} strokeDashoffset="0"
            transform="rotate(-90 50 50)" />
        )}
        {active > 0 && (
          <circle cx="50" cy="50" r="40" fill="none" stroke="var(--status-active, #3B82F6)" strokeWidth="12"
            strokeDasharray={`${activeLen} ${circumference - activeLen}`} strokeDashoffset={`${-completeLen}`}
            transform="rotate(-90 50 50)" />
        )}
        {pending > 0 && (
          <circle cx="50" cy="50" r="40" fill="none" stroke="var(--status-pending, #F59E0B)" strokeWidth="12"
            strokeDasharray={`${pendingLen} ${circumference - pendingLen}`} strokeDashoffset={`${-(completeLen + activeLen)}`}
            transform="rotate(-90 50 50)" />
        )}
        <text x="50" y="47" textAnchor="middle" className="text-xl font-bold" fill="var(--text-primary,#10141A)" fontSize="20" fontWeight="700">{total}</text>
        <text x="50" y="58" textAnchor="middle" fill="var(--text-tertiary, #9CA3AF)" fontSize="9">AGENTS</text>
      </svg>
      <div className="flex flex-col gap-2">
        <LegendItem color="var(--status-complete, #10B981)" label="Completed" value={complete} />
        <LegendItem color="var(--status-active, #3B82F6)" label="In Progress" value={active} />
        <LegendItem color="var(--status-pending, #F59E0B)" label="Pending" value={pending} />
        <LegendItem color="var(--status-error, #EF4444)" label="Error" value={error} />
      </div>
    </div>
  );
}

function LegendItem({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
      {label}
      <span className="font-semibold ml-auto">{value}</span>
    </div>
  );
}

/* ── Activity Log Row ── */
function LogEventBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    complete: 'bg-[var(--status-complete-bg,#D1FAE5)] text-[var(--status-complete-text,#065F46)]',
    active: 'bg-[var(--status-active-bg,#DBEAFE)] text-[var(--status-active-text,#1E40AF)]',
    error: 'bg-[var(--status-error-bg,#FEE2E2)] text-[var(--status-error-text,#991B1B)]',
    approval: 'bg-[var(--status-approval-bg,#FEF3C7)] text-[var(--status-approval-text,#92400E)]',
  };
  const labels: Record<string, string> = {
    complete: 'Complete',
    active: 'Working',
    error: 'Error',
    approval: 'Approval',
    dispatch: 'Dispatch',
  };
  return (
    <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-[10px] inline-block', styles[type] || styles.active)}>
      {labels[type] || type}
    </span>
  );
}

/* ════════════════════════════════════════════════
   WorkspaceLayout — Prototype-matched 4-column
   ════════════════════════════════════════════════ */
export function WorkspaceLayout() {
  const { tree } = useAgentStore();
  const { pendingList } = useApprovalStore();
  const { parts: partList } = usePartStore();
  const { notifications } = useNotificationStore();
  const { openAgent } = useAgentDetailStore();
  const { setSelectedAgentId } = useWorkspaceStore();
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [recentActivity, setRecentActivity] = useState<{ time: string; agent: string; event: string; detail: string }[]>([]);

  const fetchRecentActivity = useCallback(async () => {
    try {
      const res = await apiClient.getPaginated<{ actorType: string; actorId: string | null; action: string; resource: string; detail: string | null; createdAt: string }>('/api/audit?page=1&limit=5');
      if (res.data && res.data.length > 0) {
        setRecentActivity(res.data.map(r => ({
          time: new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          agent: r.actorType + (r.actorId ? ` #${r.actorId}` : ''),
          event: r.action.replace(/_/g, ' '),
          detail: r.detail ? (r.detail.length > 60 ? r.detail.slice(0, 60) + '...' : r.detail) : r.resource,
        })));
      }
    } catch {
      // keep empty
    }
  }, []);

  useEffect(() => {
    fetchRecentActivity();
  }, [fetchRecentActivity]);

  const { main, parts, subs, instances } = collectByRole(tree);

  // Build mock task list from approval + agents
  const pendingTasks = pendingList.map((a) => ({
    id: a.id,
    name: a.title,
    meta: `${a.sourceAgentId || 'Main'} - ${new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    status: 'pending' as const,
    hasApproval: true,
  }));

  const activeTasks = subs
    .filter((s) => s.status === 'active')
    .map((s) => ({
      id: s.id,
      name: s.statusMessage || s.name,
      meta: `${s.name} - In progress`,
      status: 'active' as const,
      hasApproval: false,
    }));

  const completedTasks = subs
    .filter((s) => s.status === 'idle')
    .map((s) => ({
      id: s.id,
      name: s.statusMessage || s.name,
      meta: 'Completed',
      status: 'complete' as const,
      hasApproval: false,
    }));

  const totalTasks = pendingTasks.length + activeTasks.length + completedTasks.length;

  // Filter subs by selected part's partId (Part is a group, not an agent)
  const filteredSubs = selectedPartId
    ? subs.filter((s) => s.partId === selectedPartId)
    : subs;
  const filteredInstances = selectedSubId
    ? getInstancesForSub(tree, selectedSubId)
    : [];

  // Get color for selected part
  const getPartColor = (partId: string, index: number) => {
    const part = partList.find((p) => p.id === partId);
    return part?.color || PART_COLORS[index % PART_COLORS.length];
  };

  const displayLogs = recentActivity.length > 0
    ? recentActivity
    : [
        { time: '--:--', agent: '--', event: '--', detail: 'No recent activity' },
      ];

  // Task status counts
  const statusCounts = {
    active: countStatusInTree(tree, 'active'),
    pending: countStatusInTree(tree, 'pending'),
    complete: countStatusInTree(tree, 'idle') + countStatusInTree(tree, 'stopped'),
    error: countStatusInTree(tree, 'error'),
  };

  return (
    <div style={{
      background: 'var(--bg-content-card, #F3F5F7)',
      borderRadius: 20,
      margin: '16px 20px',
      padding: '20px 12px',
      minHeight: 'calc(100vh - 56px - 68px)',
      boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
    }}>

      {/* ── 4-Column Flow ── */}
      <div style={{ display: 'flex', gap: 0, padding: '8px 12px 24px', position: 'relative', minHeight: 460 }}>

        {/* Column 1: Main (Task List) */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8, padding: '0 10px', position: 'relative', zIndex: 2, borderRight: '1px dashed var(--border-column, #D1D5DB)' }}>
          <ColumnHeader title="Main" count={totalTasks} />

          {/* Main Agent Card (dark) */}
          {main && (
            <MainAgentCard
              status={main.status}
              statusMessage={main.statusMessage}
              pendingCount={pendingTasks.length}
              onClick={() => setSelectedAgentId(main!.id)}
              onDoubleClick={() => openAgent(main!.id)}
            />
          )}

          {/* Task Cards: Pending */}
          {pendingTasks.map((task) => (
            <TaskCard
              key={task.id}
              name={task.name}
              meta={task.meta}
              status={task.status}
              hasApproval={task.hasApproval}
            />
          ))}

          {/* Task Cards: Active */}
          {activeTasks.map((task) => (
            <TaskCard
              key={task.id}
              name={task.name}
              meta={task.meta}
              status={task.status}
            />
          ))}

          {/* Completed toggle */}
          {completedTasks.length > 0 && (
            <>
              <button
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 4px', marginTop: 4, fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary, #9CA3AF)', cursor: 'pointer', border: 'none', background: 'none', transition: 'color 0.15s' }}
                onClick={() => setShowCompleted(!showCompleted)}
              >
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ transition: 'transform 0.2s', transform: showCompleted ? 'rotate(90deg)' : 'none' }}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                Completed <span style={{ fontWeight: 400 }}>({completedTasks.length})</span>
              </button>
              {showCompleted && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {completedTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      name={task.name}
                      meta={task.meta}
                      status={task.status}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Empty state if no tasks */}
          {totalTasks === 0 && !main && (
            <ColumnEmpty text="No tasks yet.<br/>Start a conversation with Main." />
          )}
        </div>

        {/* Column 2: Part (skill group, not agent) */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8, padding: '0 10px', position: 'relative', zIndex: 2, borderRight: '1px dashed var(--border-column, #D1D5DB)' }}>
          <ColumnHeader title="Part" count={partList.length} showAdd onAdd={() => alert('Main과 대화를 통해 Part를 등록합니다.')} />

          {partList.length > 0 ? (
            partList.map((part, i) => {
              const color = part.color || PART_COLORS[i % PART_COLORS.length];
              const subsInPart = subs.filter((s) => s.partId === part.id);
              const activeCount = subsInPart.filter((s) => s.status === 'active').length;
              const pendingCount = subsInPart.filter((s) => s.status === 'pending').length;

              return (
                <PartCard
                  key={part.id}
                  name={part.name}
                  description={part.description}
                  skillName={part.skillName}
                  status={part.status}
                  color={color}
                  projectCount={subsInPart.length}
                  activeCount={activeCount}
                  pendingCount={pendingCount}
                  isSelected={selectedPartId === part.id}
                  onClick={() => {
                    setSelectedPartId(selectedPartId === part.id ? null : part.id);
                    setSelectedSubId(null);
                  }}
                  onDoubleClick={() => openAgent(part.id)}
                />
              );
            })
          ) : (
            <ColumnEmpty text="No parts registered.<br/>Chat with Main to create one." />
          )}
        </div>

        {/* Column 3: Sub */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8, padding: '0 10px', position: 'relative', zIndex: 2, borderRight: '1px dashed var(--border-column, #D1D5DB)' }}>
          <ColumnHeader
            title="Sub"
            count={selectedPartId ? filteredSubs.length : subs.length}
            showAdd
          />

          {(selectedPartId ? filteredSubs : subs).length > 0 ? (
            (selectedPartId ? filteredSubs : subs).map((sub) => {
              const partColor = selectedPartId
                ? getPartColor(selectedPartId, parts.findIndex((p) => p.id === selectedPartId))
                : PART_COLORS[0];
              return (
                <AgentCardShared
                  key={sub.id}
                  name={sub.name}
                  subtitle={sub.statusMessage || sub.role}
                  status={sub.status}
                  color={partColor}
                  isSelected={selectedSubId === sub.id}
                  activeCount={sub.children.filter((c) => c.status === 'active').length}
                  pendingCount={sub.children.filter((c) => c.status === 'pending').length}
                  completeCount={sub.children.filter((c) => c.status === 'idle' || c.status === 'stopped').length}
                  onClick={() => {
                    setSelectedSubId(selectedSubId === sub.id ? null : sub.id);
                    setSelectedAgentId(sub.id);
                  }}
                  onDoubleClick={() => openAgent(sub.id)}
                />
              );
            })
          ) : (
            <ColumnEmpty text={selectedPartId ? "No sub-projects.<br/>Select a different Part." : "Select a Part<br/>to view sub-projects."} />
          )}
        </div>

        {/* Column 4: Instance */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8, padding: '0 10px', position: 'relative', zIndex: 2 }}>
          <ColumnHeader
            title="Instance"
            count={filteredInstances.length}
          />

          {filteredInstances.length > 0 ? (
            filteredInstances.map((inst) => {
              const partColor = selectedPartId
                ? getPartColor(selectedPartId, parts.findIndex((p) => p.id === selectedPartId))
                : PART_COLORS[0];
              return (
                <AgentCardShared
                  key={inst.id}
                  name={inst.name}
                  subtitle={inst.statusMessage || inst.role}
                  status={inst.status}
                  color={partColor}
                  isInstance
                  modelName="claude-sonnet"
                  onClick={() => setSelectedAgentId(inst.id)}
                  onDoubleClick={() => openAgent(inst.id)}
                />
              );
            })
          ) : (
            <ColumnEmpty text="Select a Sub<br/>to view instances." />
          )}
        </div>
      </div>

      {/* ── Section Divider ── */}
      <div style={{ height: 1, background: 'var(--border-light, #E5E7EB)', margin: '0 12px' }} />

      {/* ── Bottom Section: Activity Log + Donut Chart ── */}
      <div style={{ display: 'flex', gap: 24, padding: '24px 12px' }}>
        {/* Activity Log */}
        <div style={{ flex: 1.5, background: 'var(--bg-card, #FFFFFF)', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            Recent Activity
            <span style={{ fontSize: 10, color: 'var(--text-tertiary, #9CA3AF)', background: 'var(--bg-content-card, #F3F4F6)', padding: '2px 8px', borderRadius: 10 }}>Last 24h</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Time', 'Agent', 'Event', 'Detail'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary, #9CA3AF)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '8px 12px', borderBottom: '1px solid var(--border-light, #E5E7EB)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayLogs.map((log, i) => (
                <tr key={i}>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-tertiary, #9CA3AF)', borderBottom: '1px solid var(--bg-surface, #F9FAFB)' }}>{log.time}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-primary, #10141A)', borderBottom: '1px solid var(--bg-surface, #F9FAFB)' }}>{log.agent}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-surface, #F9FAFB)' }}>
                    <LogEventBadge type={log.event} />
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-primary, #10141A)', borderBottom: '1px solid var(--bg-surface, #F9FAFB)' }}>{log.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Agent Status Donut */}
        <div style={{ flex: 1, background: 'var(--bg-card, #FFFFFF)', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Agent Status</div>
          <DonutChart
            active={statusCounts.active}
            pending={statusCounts.pending}
            complete={statusCounts.complete}
            error={statusCounts.error}
          />
        </div>
      </div>
    </div>
  );
}
