'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

interface ApprovalRecord {
  id: string;
  title: string;
  status: string;
  urgency: string;
  sourceAgentName: string | null;
  createdAt: string;
  resolvedAt: string | null;
  cost?: number;
}

const MOCK_DATA: ApprovalRecord[] = [
  { id: '1', title: 'Run 30 integration test scenarios', status: 'pending', urgency: 'high', sourceAgentName: 'QA Part', createdAt: '2026-04-16T14:15:00Z', resolvedAt: null, cost: 2.40 },
  { id: '2', title: 'Create 2 additional frontend Sub agents', status: 'approved', urgency: 'normal', sourceAgentName: 'Dev Part', createdAt: '2026-04-15T16:30:00Z', resolvedAt: '2026-04-15T16:45:00Z', cost: 4.80 },
  { id: '3', title: 'External API research (100 calls)', status: 'modified', urgency: 'normal', sourceAgentName: 'Design Part', createdAt: '2026-04-14T11:20:00Z', resolvedAt: '2026-04-14T11:40:00Z', cost: 1.20 },
  { id: '4', title: 'Full DB schema redesign', status: 'rejected', urgency: 'low', sourceAgentName: 'Dev Part', createdAt: '2026-04-13T09:45:00Z', resolvedAt: '2026-04-13T10:00:00Z' },
];

function statusBadgeStyle(status: string): React.CSSProperties {
  switch (status) {
    case 'approved': return { background: 'var(--status-complete-bg)', color: 'var(--status-complete-text)' };
    case 'rejected': return { background: 'var(--status-error-bg)', color: 'var(--status-error-text)' };
    case 'modified': return { background: 'var(--status-pending-bg)', color: 'var(--status-pending-text)' };
    case 'pending': return { background: 'var(--status-pending-bg)', color: 'var(--status-pending-text)' };
    default: return { background: 'var(--bg-content-card)', color: 'var(--text-secondary)' };
  }
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${m}/${day} ${h}:${min}`;
}

export default function ApprovalsHistoryPage() {
  const [data, setData] = useState<ApprovalRecord[]>([]);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    apiClient.get<ApprovalRecord[]>('/api/approvals')
      .then(res => { if (res.data && res.data.length > 0) setData(res.data); })
      .catch(() => {});
  }, []);

  const filtered = data.filter(row => {
    if (filter !== 'All' && row.status !== filter.toLowerCase()) return false;
    if (search && !row.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ background: 'var(--bg-content-card)', borderRadius: 20, margin: '16px 20px', padding: '20px 12px', minHeight: 'calc(100vh - 56px - 68px)' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Approval History</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {['All', 'Approved', 'Rejected', 'Modified'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '4px 10px', borderRadius: 6, border: 'none',
                fontSize: 10, fontWeight: 500, cursor: 'pointer',
                background: filter === f ? '#7C5CFC' : 'var(--bg-content-card)',
                color: filter === f ? 'white' : 'var(--text-secondary)',
              }}>{f}</button>
            ))}
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{
              padding: '5px 10px', borderRadius: 6,
              border: '1px solid var(--border-light)', fontSize: 11,
              outline: 'none', width: 140, fontFamily: 'inherit',
            }} />
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Time', 'Requester', 'Description', 'Result', 'Cost'].map(h => (
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
            {filtered.map(row => (
              <tr key={row.id}>
                <td style={{ padding: 10, fontSize: 12, borderBottom: '1px solid var(--bg-surface)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{formatShortDate(row.createdAt)}</td>
                <td style={{ padding: 10, fontSize: 12, borderBottom: '1px solid var(--bg-surface)' }}>{row.sourceAgentName || '-'}</td>
                <td style={{ padding: 10, fontSize: 12, borderBottom: '1px solid var(--bg-surface)' }}>{row.title}</td>
                <td style={{ padding: 10, fontSize: 12, borderBottom: '1px solid var(--bg-surface)' }}>
                  <span style={{
                    fontSize: 9, fontWeight: 500, padding: '2px 8px',
                    borderRadius: 10, display: 'inline-block',
                    ...statusBadgeStyle(row.status),
                  }}>{row.status.charAt(0).toUpperCase() + row.status.slice(1)}</span>
                </td>
                <td style={{ padding: 10, fontSize: 11, borderBottom: '1px solid var(--bg-surface)' }}>{row.cost ? `$${row.cost.toFixed(2)}` : '\u2014'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 11, color: 'var(--text-tertiary)' }}>
          <span>1-{filtered.length} / {data.length}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button style={{
              width: 28, height: 28, borderRadius: 6,
              border: '1px solid #7C5CFC', background: '#7C5CFC',
              fontSize: 11, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'white',
            }}>1</button>
          </div>
        </div>
      </div>
    </div>
  );
}
