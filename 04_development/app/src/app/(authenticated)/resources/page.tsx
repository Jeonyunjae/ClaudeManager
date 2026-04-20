'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSystemStore } from '@/stores/systemStore';
import { useCostStore } from '@/stores/costStore';
import { apiClient } from '@/lib/api';
import type { Approval, ApprovalStatus } from '@/types/approval';

type SubTab = 'health' | 'cost' | 'approval' | 'error' | 'audit';

/* ---- types ---- */
interface ErrorLogEntry {
  id: number;
  agentId: string;
  agentName: string;
  message: string;
  stackTrace: string | null;
  createdAt: string;
}

interface AuditLogEntry {
  id: number;
  actorType: string;
  actorId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  detail: string | null;
  createdAt: string;
}

const ACTION_STYLE: Record<string, { background: string; color: string }> = {
  setting_change: { background: 'var(--status-pending-bg)', color: 'var(--status-pending-text)' },
  agent_create: { background: 'var(--status-complete-bg)', color: 'var(--status-complete-text)' },
  agent_delete: { background: 'var(--status-error-bg)', color: 'var(--status-error-text)' },
  agent_start: { background: 'var(--status-complete-bg)', color: 'var(--status-complete-text)' },
  agent_stop: { background: 'var(--bg-content-card)', color: 'var(--text-secondary)' },
  approval_approve: { background: 'var(--status-complete-bg)', color: 'var(--status-complete-text)' },
  approval_reject: { background: 'var(--status-error-bg)', color: 'var(--status-error-text)' },
  approval_modify: { background: 'var(--status-pending-bg)', color: 'var(--status-pending-text)' },
  backup_create: { background: 'var(--status-active-bg)', color: 'var(--status-active-text)' },
  backup_restore: { background: 'var(--status-active-bg)', color: 'var(--status-active-text)' },
  login: { background: 'var(--status-complete-bg)', color: 'var(--status-complete-text)' },
};
const DEFAULT_ACTION_STYLE = { background: 'var(--bg-content-card)', color: 'var(--text-secondary)' };

const STATUS_STYLE: Record<ApprovalStatus, { label: string; style: { background: string; color: string } }> = {
  pending: { label: 'Pending', style: { background: 'var(--status-pending-bg)', color: 'var(--status-pending-text)' } },
  approved: { label: 'Approved', style: { background: 'var(--status-complete-bg)', color: 'var(--status-complete-text)' } },
  modified: { label: 'Modified', style: { background: 'var(--status-active-bg)', color: 'var(--status-active-text)' } },
  rejected: { label: 'Rejected', style: { background: 'var(--status-error-bg)', color: 'var(--status-error-text)' } },
};

/* ---- Gauge SVG component ---- */
function GaugeCard({ title, percent, color, details }: {
  title: string;
  percent: number;
  color: string;
  details: { label: string; value: string; warn?: boolean }[];
}) {
  const circumference = 2 * Math.PI * 50;
  const filled = (percent / 100) * circumference;
  const empty = circumference - filled;
  const isWarn = percent > 90;

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 20, textAlign: 'center' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>{title}</div>
      <svg style={{ width: 100, height: 100, margin: '0 auto', display: 'block' }} viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="50" fill="none" stroke="var(--bg-content-card)" strokeWidth="10" />
        <circle cx="60" cy="60" r="50" fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${filled} ${empty}`} strokeDashoffset={-circumference / 4}
          strokeLinecap="round" transform="rotate(-90 60 60)" />
        <text x="60" y="56" textAnchor="middle" style={{ fontSize: 22, fontWeight: 700, fill: isWarn ? '#EF4444' : 'var(--text-primary)' }}>{percent}%</text>
        <text x="60" y="70" textAnchor="middle" style={{ fontSize: 10, fill: 'var(--text-tertiary)' }}>In Use</text>
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 12, fontSize: 11, color: 'var(--text-tertiary)' }}>
        {details.map((d, i) => (
          <div key={i}>{d.label}: <span style={{ fontWeight: 600, color: d.warn ? '#EF4444' : 'var(--text-primary)' }}>{d.value}</span></div>
        ))}
      </div>
    </div>
  );
}

/* ---- Event Badge ---- */
function EventBadge({ label, style: badgeStyle }: { label: string; style: React.CSSProperties }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 500, padding: '2px 8px',
      borderRadius: 10, display: 'inline-block', ...badgeStyle,
    }}>{label}</span>
  );
}

/* ---- Pagination ---- */
function Pagination({ current, total, showing, onPageChange }: { current: number; total: number; showing: string; onPageChange: (page: number) => void }) {
  if (total <= 0) return null;

  // Show up to 3 page numbers around current
  const start = Math.max(1, current - 1);
  const end = Math.min(total, start + 2);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 11, color: 'var(--text-tertiary)' }}>
      <span>{showing}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {current > 1 && (
          <button onClick={() => onPageChange(current - 1)} style={{
            width: 28, height: 28, borderRadius: 6,
            border: '1px solid var(--border-light)', background: 'var(--bg-card)',
            fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
        )}
        {pages.map(p => (
          <button key={p} onClick={() => onPageChange(p)} style={{
            width: 28, height: 28, borderRadius: 6,
            border: current === p ? '1px solid #7C5CFC' : '1px solid var(--border-light)',
            background: current === p ? '#7C5CFC' : 'var(--bg-card)',
            fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: current === p ? 'white' : 'var(--text-secondary)',
          }}>{p}</button>
        ))}
        {current < total && (
          <button onClick={() => onPageChange(current + 1)} style={{
            width: 28, height: 28, borderRadius: 6,
            border: '1px solid var(--border-light)', background: 'var(--bg-card)',
            fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        )}
      </div>
    </div>
  );
}

/* ---- Main Page ---- */
export default function ResourcesPage() {
  const [activeTab, setActiveTab] = useState<SubTab>('health');
  const [approvalFilter, setApprovalFilter] = useState('All');
  const [auditFilter, setAuditFilter] = useState('All');
  const [searchApproval, setSearchApproval] = useState('');
  const [searchError, setSearchError] = useState('');
  const [searchAudit, setSearchAudit] = useState('');

  const { health, fetchHealth } = useSystemStore();
  const { summary, byModel, trend, fetchAll } = useCostStore();

  const [errors, setErrors] = useState<ErrorLogEntry[]>([]);
  const [errorTotal, setErrorTotal] = useState(0);
  const [errorPage, setErrorPage] = useState(1);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [approvalList, setApprovalList] = useState<Approval[]>([]);
  const [approvalTotal, setApprovalTotal] = useState(0);
  const [approvalPage, setApprovalPage] = useState(1);

  const fetchErrors = useCallback(async (page = 1, search?: string) => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (search) params.set('search', search);
      const res = await apiClient.getPaginated<ErrorLogEntry>(`/api/logs/errors?${params}`);
      setErrors(res.data || []);
      setErrorTotal(res.pagination?.total || 0);
    } catch {
      // keep empty
    }
  }, []);

  const fetchAudit = useCallback(async (page = 1, action?: string, search?: string) => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (action && action !== 'All') params.set('action', action);
      if (search) params.set('search', search);
      const res = await apiClient.getPaginated<AuditLogEntry>(`/api/audit?${params}`);
      setAuditLogs(res.data || []);
      setAuditTotal(res.pagination?.total || 0);
    } catch {
      // keep empty
    }
  }, []);

  const fetchApprovals = useCallback(async (page = 1, status?: string) => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (status && status !== 'All') params.set('status', status.toLowerCase());
      const res = await apiClient.getPaginated<Approval>(`/api/approvals?${params}`);
      setApprovalList(res.data || []);
      setApprovalTotal(res.pagination?.total || 0);
    } catch {
      // keep empty
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    fetchAll();
    fetchApprovals(1);
    fetchErrors(1);
    fetchAudit(1);
  }, [fetchHealth, fetchAll, fetchApprovals, fetchErrors, fetchAudit]);

  useEffect(() => {
    fetchApprovals(approvalPage, approvalFilter);
  }, [approvalPage, approvalFilter, fetchApprovals]);

  useEffect(() => {
    fetchErrors(errorPage, searchError || undefined);
  }, [errorPage, searchError, fetchErrors]);

  useEffect(() => {
    fetchAudit(auditPage, auditFilter !== 'All' ? auditFilter : undefined, searchAudit || undefined);
  }, [auditPage, auditFilter, searchAudit, fetchAudit]);

  const cpuPercent = health?.cpu ?? 52;
  const memPercent = health?.memory ?? 96;
  const diskPercent = health?.disk ?? 7;

  const todayCost = summary?.todayCost ?? 0;
  const monthlyCost = summary?.monthlyCost ?? 0;
  const planBaseCost = summary?.planBaseCost ?? 200;
  const overageLimit = summary?.overageLimit ?? 2000;
  const overage = summary?.overage ?? 0;
  const overageRemaining = summary?.overageRemaining ?? overageLimit;
  const todayChange = summary?.todayChange ?? 0;
  const monthChange = summary?.monthChange ?? 0;
  const totalInputTokens = summary?.totalInputTokens ?? 0;
  const totalOutputTokens = summary?.totalOutputTokens ?? 0;

  const tabs: { key: SubTab; label: string }[] = [
    { key: 'health', label: 'System Health' },
    { key: 'cost', label: 'Cost' },
    { key: 'approval', label: 'Approvals' },
    { key: 'error', label: 'Error Log' },
    { key: 'audit', label: 'Audit Log' },
  ];

  const trendData = trend.length > 0
    ? trend.slice(-7).map(t => ({ date: t.date.slice(5), cost: t.cost }))
    : [
      { date: '4/10', cost: 8.2 }, { date: '4/11', cost: 6.4 }, { date: '4/12', cost: 9.1 },
      { date: '4/13', cost: 5.8 }, { date: '4/14', cost: 7.3 }, { date: '4/15', cost: 10.5 },
      { date: '4/16', cost: 12.4 },
    ];
  const maxTrendCost = Math.max(...trendData.map(t => t.cost), 1);

  const modelData = summary?.modelBreakdown && summary.modelBreakdown.length > 0
    ? summary.modelBreakdown.map((m, i) => ({
      name: m.model,
      cost: m.cost,
      color: ['#7C5CFC', '#3B82F6', '#34D399'][i % 3],
    }))
    : [
      { name: 'Opus', cost: 36.20, color: '#7C5CFC' },
      { name: 'Sonnet', cost: 9.80, color: '#3B82F6' },
      { name: 'Haiku', cost: 2.20, color: '#34D399' },
    ];
  const totalModelCost = modelData.reduce((s, m) => s + m.cost, 0);

  /* Donut calculations */
  const donutRadius = 45;
  const donutCircumference = 2 * Math.PI * donutRadius;
  let donutOffset = -donutCircumference / 4; // start from top (-90deg equiv)
  const donutSegments = modelData.map(m => {
    const pct = totalModelCost > 0 ? m.cost / totalModelCost : 0;
    const len = pct * donutCircumference;
    const seg = { ...m, dasharray: `${len} ${donutCircumference - len}`, dashoffset: donutOffset };
    donutOffset -= len;
    return seg;
  });

  const filteredApprovals = approvalList.filter(a => {
    if (searchApproval && !a.title.toLowerCase().includes(searchApproval.toLowerCase())) return false;
    return true;
  });

  // audit logs are filtered server-side

  // errors are already filtered server-side via searchError param

  return (
    <div style={{ background: 'var(--bg-content-card)', borderRadius: 20, margin: '16px 20px', padding: '20px 12px', minHeight: 'calc(100vh - 56px - 68px)' }}>

      {/* Sub Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: 'rgba(0,0,0,0.04)', borderRadius: 10, padding: 3, width: 'fit-content' }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: '7px 16px', borderRadius: 8, border: 'none',
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
            background: activeTab === tab.key ? 'var(--bg-card)' : 'transparent',
            color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-secondary)',
            boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
            fontFamily: 'inherit', transition: 'all 0.15s',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ============ System Health ============ */}
      {activeTab === 'health' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          <GaugeCard title="CPU" percent={cpuPercent} color="#F59E0B" details={[
            { label: 'Cores', value: '4' },
            { label: 'Load', value: (cpuPercent / 25).toFixed(2) },
          ]} />
          <GaugeCard title="Memory" percent={memPercent} color="#EF4444" details={[
            { label: 'Total', value: '16 GB' },
            { label: 'Used', value: `${(16 * memPercent / 100).toFixed(1)} GB`, warn: memPercent > 90 },
          ]} />
          <GaugeCard title="Disk" percent={diskPercent} color="#34D399" details={[
            { label: 'Total', value: '500 GB' },
            { label: 'Used', value: `${Math.round(500 * diskPercent / 100)} GB` },
          ]} />
        </div>
      )}

      {/* ============ Cost ============ */}
      {activeTab === 'cost' && (
        <>
          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Today Cost</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: '#7C5CFC' }}>${todayCost.toFixed(2)}</div>
              <div style={{ fontSize: 10, marginTop: 4, display: 'flex', alignItems: 'center', gap: 3, color: todayChange >= 0 ? '#EF4444' : '#34D399' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points={todayChange >= 0 ? "23 6 13.5 15.5 8.5 10.5 1 18" : "23 18 13.5 8.5 8.5 13.5 1 6"} /></svg>
                {todayChange >= 0 ? '+' : ''}{todayChange}% vs yesterday
              </div>
            </div>
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Monthly Cost</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>${monthlyCost.toFixed(2)}</div>
              <div style={{ fontSize: 10, marginTop: 4, display: 'flex', alignItems: 'center', gap: 3, color: monthChange >= 0 ? '#EF4444' : '#34D399' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points={monthChange >= 0 ? "23 6 13.5 15.5 8.5 10.5 1 18" : "23 18 13.5 8.5 8.5 13.5 1 6"} /></svg>
                {monthChange >= 0 ? '+' : ''}{monthChange}% vs last month
              </div>
            </div>
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Overage</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: overageRemaining >= 0 ? '#34D399' : '#EF4444' }}>${overageRemaining.toFixed(2)}</div>
              <div style={{ fontSize: 10, marginTop: 4, color: 'var(--text-tertiary)' }}>
                Plan ${planBaseCost} / Limit ${overageLimit} / Used ${overage.toFixed(2)}
              </div>
            </div>
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Tokens</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{totalInputTokens + totalOutputTokens > 1_000_000 ? `${((totalInputTokens + totalOutputTokens) / 1_000_000).toFixed(1)}M` : totalInputTokens + totalOutputTokens > 1000 ? `${Math.round((totalInputTokens + totalOutputTokens) / 1000)}K` : totalInputTokens + totalOutputTokens}</div>
              <div style={{ fontSize: 10, marginTop: 4, color: 'var(--text-tertiary)' }}>Input {totalInputTokens > 1_000_000 ? `${(totalInputTokens / 1_000_000).toFixed(1)}M` : `${Math.round(totalInputTokens / 1000)}K`} / Output {totalOutputTokens > 1_000_000 ? `${(totalOutputTokens / 1_000_000).toFixed(1)}M` : `${Math.round(totalOutputTokens / 1000)}K`}</div>
            </div>
          </div>

          {/* Cost Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            {/* Model Usage Donut */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Model Usage</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '8px 0' }}>
                <svg style={{ width: 110, height: 110 }} viewBox="0 0 120 120">
                  {donutSegments.map((seg, i) => (
                    <circle key={i} cx="60" cy="60" r={donutRadius} fill="none" stroke={seg.color} strokeWidth="14"
                      strokeDasharray={seg.dasharray} strokeDashoffset={seg.dashoffset} />
                  ))}
                  <text x="60" y="57" textAnchor="middle" style={{ fontSize: 18, fontWeight: 700, fill: 'var(--text-primary)' }}>${Math.round(totalModelCost)}</text>
                  <text x="60" y="70" textAnchor="middle" style={{ fontSize: 9, fill: 'var(--text-tertiary)' }}>This Month</text>
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {modelData.map((m, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.color }} />
                      {m.name} <span style={{ fontWeight: 600, marginLeft: 'auto' }}>${m.cost.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Daily Cost Trend */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Daily Cost Trend</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100, padding: '8px 4px 0' }}>
                {trendData.map((t, i) => {
                  const barHeight = (t.cost / maxTrendCost) * 83;
                  const isLast = i === trendData.length - 1;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 600 }}>${t.cost.toFixed(1)}</div>
                      <div style={{
                        width: '100%', borderRadius: '4px 4px 0 0', height: barHeight,
                        background: isLast ? 'linear-gradient(to top, #7C5CFC, #3B82F6)' : '#7C5CFC',
                      }} />
                      <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{t.date}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ============ Approvals ============ */}
      {activeTab === 'approval' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Approval History</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {['All', 'Pending', 'Approved', 'Rejected', 'Modified'].map(f => (
                <button key={f} onClick={() => { setApprovalFilter(f); setApprovalPage(1); }} style={{
                  padding: '4px 10px', borderRadius: 6, border: 'none',
                  fontSize: 10, fontWeight: 500, cursor: 'pointer',
                  background: approvalFilter === f ? '#7C5CFC' : 'var(--bg-content-card)',
                  color: approvalFilter === f ? 'white' : 'var(--text-secondary)',
                }}>{f}</button>
              ))}
              <input value={searchApproval} onChange={e => setSearchApproval(e.target.value)} placeholder="Search..." style={{
                padding: '5px 10px', borderRadius: 6,
                border: '1px solid var(--border-light)', fontSize: 11,
                outline: 'none', width: 140, fontFamily: 'inherit',
              }} />
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Time', 'Requester', 'Title', 'Urgency', 'Status'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', fontSize: 10, fontWeight: 600,
                    color: 'var(--text-tertiary)', textTransform: 'uppercase',
                    letterSpacing: '0.04em', padding: '8px 10px',
                    borderBottom: '1px solid var(--border-light)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredApprovals.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>No approval records</td>
                </tr>
              ) : filteredApprovals.map(row => {
                const st = STATUS_STYLE[row.status] || STATUS_STYLE.pending;
                const dateStr = row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
                return (
                  <tr key={row.id}>
                    <td style={{ padding: 10, fontSize: 12, borderBottom: '1px solid var(--bg-surface)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{dateStr}</td>
                    <td style={{ padding: 10, fontSize: 12, borderBottom: '1px solid var(--bg-surface)' }}>{row.sourceAgentName || row.sourceAgentId || '—'}</td>
                    <td style={{ padding: 10, fontSize: 12, borderBottom: '1px solid var(--bg-surface)' }}>{row.title}</td>
                    <td style={{ padding: 10, fontSize: 12, borderBottom: '1px solid var(--bg-surface)' }}>
                      <EventBadge label={row.urgency} style={{ background: row.urgency === 'critical' ? 'var(--status-error-bg)' : row.urgency === 'high' ? 'var(--status-pending-bg)' : 'var(--bg-content-card)', color: row.urgency === 'critical' ? 'var(--status-error-text)' : row.urgency === 'high' ? 'var(--status-pending-text)' : 'var(--text-secondary)' }} />
                    </td>
                    <td style={{ padding: 10, fontSize: 12, borderBottom: '1px solid var(--bg-surface)' }}>
                      <EventBadge label={st.label} style={st.style} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination current={approvalPage} total={Math.ceil(approvalTotal / 10)} showing={`${(approvalPage - 1) * 10 + 1}-${Math.min(approvalPage * 10, approvalTotal)} / ${approvalTotal}`} onPageChange={setApprovalPage} />
        </div>
      )}

      {/* ============ Error Log ============ */}
      {activeTab === 'error' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Error Log</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input value={searchError} onChange={e => setSearchError(e.target.value)} placeholder="Search errors..." style={{
                padding: '5px 10px', borderRadius: 6,
                border: '1px solid var(--border-light)', fontSize: 11,
                outline: 'none', width: 140, fontFamily: 'inherit',
              }} />
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Time', 'Agent', 'Error'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', fontSize: 10, fontWeight: 600,
                    color: 'var(--text-tertiary)', textTransform: 'uppercase',
                    letterSpacing: '0.04em', padding: '8px 10px',
                    borderBottom: '1px solid var(--border-light)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {errors.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>No error records</td>
                </tr>
              ) : errors.map(row => {
                const dateStr = row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
                return (
                  <tr key={row.id}>
                    <td style={{ padding: 10, fontSize: 12, borderBottom: '1px solid var(--bg-surface)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{dateStr}</td>
                    <td style={{ padding: 10, fontSize: 12, borderBottom: '1px solid var(--bg-surface)' }}>{row.agentName}</td>
                    <td style={{ padding: 10, fontSize: 12, borderBottom: '1px solid var(--bg-surface)' }}>{row.message}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination current={errorPage} total={Math.ceil(errorTotal / 10)} showing={`${(errorPage - 1) * 10 + 1}-${Math.min(errorPage * 10, errorTotal)} / ${errorTotal}`} onPageChange={setErrorPage} />
        </div>
      )}

      {/* ============ Audit Log ============ */}
      {activeTab === 'audit' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Audit Log</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {['All', 'setting_change', 'login', 'agent_create', 'agent_delete', 'backup_create'].map(f => (
                <button key={f} onClick={() => { setAuditFilter(f); setAuditPage(1); }} style={{
                  padding: '4px 10px', borderRadius: 6, border: 'none',
                  fontSize: 10, fontWeight: 500, cursor: 'pointer',
                  background: auditFilter === f ? '#7C5CFC' : 'var(--bg-content-card)',
                  color: auditFilter === f ? 'white' : 'var(--text-secondary)',
                }}>{f === 'All' ? 'All' : f.replace(/_/g, ' ')}</button>
              ))}
              <input value={searchAudit} onChange={e => setSearchAudit(e.target.value)} placeholder="Search..." style={{
                padding: '5px 10px', borderRadius: 6,
                border: '1px solid var(--border-light)', fontSize: 11,
                outline: 'none', width: 140, fontFamily: 'inherit',
              }} />
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Time', 'Actor', 'Action', 'Resource', 'Detail'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', fontSize: 10, fontWeight: 600,
                    color: 'var(--text-tertiary)', textTransform: 'uppercase',
                    letterSpacing: '0.04em', padding: '8px 10px',
                    borderBottom: '1px solid var(--border-light)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>No audit records</td>
                </tr>
              ) : auditLogs.map(row => {
                const dateStr = row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
                const actionStyle = ACTION_STYLE[row.action] || DEFAULT_ACTION_STYLE;
                return (
                  <tr key={row.id}>
                    <td style={{ padding: 10, fontSize: 12, borderBottom: '1px solid var(--bg-surface)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{dateStr}</td>
                    <td style={{ padding: 10, fontSize: 12, borderBottom: '1px solid var(--bg-surface)' }}>{row.actorType}{row.actorId ? ` #${row.actorId}` : ''}</td>
                    <td style={{ padding: 10, fontSize: 12, borderBottom: '1px solid var(--bg-surface)' }}>
                      <EventBadge label={row.action.replace(/_/g, ' ')} style={actionStyle} />
                    </td>
                    <td style={{ padding: 10, fontSize: 12, borderBottom: '1px solid var(--bg-surface)' }}>{row.resource}{row.resourceId ? ` #${row.resourceId}` : ''}</td>
                    <td style={{ padding: 10, fontSize: 11, borderBottom: '1px solid var(--bg-surface)', color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.detail || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination current={auditPage} total={Math.ceil(auditTotal / 10)} showing={`${(auditPage - 1) * 10 + 1}-${Math.min(auditPage * 10, auditTotal)} / ${auditTotal}`} onPageChange={setAuditPage} />
        </div>
      )}
    </div>
  );
}
