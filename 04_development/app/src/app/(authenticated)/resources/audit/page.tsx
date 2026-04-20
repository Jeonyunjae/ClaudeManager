'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

interface AuditLog {
  id: number;
  actor: string;
  event: string;
  eventStyle: { background: string; color: string };
  target: string;
  detail: string;
  createdAt: string;
}

const MOCK_AUDIT: AuditLog[] = [
  { id: 1, actor: 'Main', event: 'Dispatch', eventStyle: { background: 'var(--status-active-bg)', color: 'var(--status-active-text)' }, target: 'UI Builder', detail: 'Card layout task started', createdAt: '04/16 14:32' },
  { id: 2, actor: 'QA Part', event: 'Approval Request', eventStyle: { background: 'var(--status-pending-bg)', color: 'var(--status-pending-text)' }, target: 'Main', detail: '30 integration tests approval requested', createdAt: '04/16 14:15' },
  { id: 3, actor: 'System', event: 'Start', eventStyle: { background: 'var(--status-complete-bg)', color: 'var(--status-complete-text)' }, target: 'All', detail: 'Session started \u2014 8 agents restored', createdAt: '04/16 09:00' },
  { id: 4, actor: 'System', event: 'Backup', eventStyle: { background: 'var(--bg-content-card)', color: 'var(--text-secondary)' }, target: 'DB', detail: 'Auto backup completed \u2014 23.8 MB', createdAt: '04/15 23:00' },
];

function mapApiAudit(raw: Record<string, unknown>): AuditLog {
  const action = (raw.action as string) || '';
  let eventStyle = { background: 'var(--bg-content-card)', color: 'var(--text-secondary)' };
  if (action.toLowerCase().includes('create') || action.toLowerCase().includes('start')) {
    eventStyle = { background: 'var(--status-complete-bg)', color: 'var(--status-complete-text)' };
  } else if (action.toLowerCase().includes('dispatch')) {
    eventStyle = { background: 'var(--status-active-bg)', color: 'var(--status-active-text)' };
  } else if (action.toLowerCase().includes('approval') || action.toLowerCase().includes('update')) {
    eventStyle = { background: 'var(--status-pending-bg)', color: 'var(--status-pending-text)' };
  } else if (action.toLowerCase().includes('delete')) {
    eventStyle = { background: 'var(--status-error-bg)', color: 'var(--status-error-text)' };
  }
  return {
    id: raw.id as number,
    actor: (raw.actorId as string) || (raw.actorType as string) || '-',
    event: action,
    eventStyle,
    target: (raw.resource as string) || '-',
    detail: (raw.detail as string) || '-',
    createdAt: (raw.createdAt as string) || '',
  };
}

export default function AuditLogsPage() {
  const [data, setData] = useState<AuditLog[]>([]);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    apiClient.get<Record<string, unknown>[]>('/api/audit')
      .then(res => {
        if (res.data && res.data.length > 0) {
          setData(res.data.map(mapApiAudit));
        }
      })
      .catch(() => {});
  }, []);

  const filtered = data.filter(row => {
    if (filter !== 'All' && row.event.toLowerCase() !== filter.toLowerCase()) return false;
    if (search && !row.detail.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ background: 'var(--bg-content-card)', borderRadius: 20, margin: '16px 20px', padding: '20px 12px', minHeight: 'calc(100vh - 56px - 68px)' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Audit Log</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {['All', 'Create', 'Update', 'Delete'].map(f => (
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
              {['Time', 'Actor', 'Event', 'Target', 'Detail'].map(h => (
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
                <td style={{ padding: 10, fontSize: 12, borderBottom: '1px solid var(--bg-surface)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{row.createdAt}</td>
                <td style={{ padding: 10, fontSize: 12, borderBottom: '1px solid var(--bg-surface)' }}>{row.actor}</td>
                <td style={{ padding: 10, fontSize: 12, borderBottom: '1px solid var(--bg-surface)' }}>
                  <span style={{
                    fontSize: 9, fontWeight: 500, padding: '2px 8px',
                    borderRadius: 10, display: 'inline-block',
                    ...row.eventStyle,
                  }}>{row.event}</span>
                </td>
                <td style={{ padding: 10, fontSize: 12, borderBottom: '1px solid var(--bg-surface)' }}>{row.target}</td>
                <td style={{ padding: 10, fontSize: 11, borderBottom: '1px solid var(--bg-surface)', color: 'var(--text-secondary)' }}>{row.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 11, color: 'var(--text-tertiary)' }}>
          <span>1-{filtered.length} / 156</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {[1, 2, 3].map(n => (
              <button key={n} style={{
                width: 28, height: 28, borderRadius: 6,
                border: n === 1 ? '1px solid #7C5CFC' : '1px solid var(--border-light)',
                background: n === 1 ? '#7C5CFC' : 'var(--bg-card)',
                fontSize: 11, cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: n === 1 ? 'white' : 'var(--text-secondary)',
              }}>{n}</button>
            ))}
            <button style={{
              width: 28, height: 28, borderRadius: 6,
              border: '1px solid var(--border-light)', background: 'var(--bg-card)',
              fontSize: 11, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)',
            }}>...</button>
            <button style={{
              width: 28, height: 28, borderRadius: 6,
              border: '1px solid var(--border-light)', background: 'var(--bg-card)',
              fontSize: 11, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)',
            }}>8</button>
            <button style={{
              width: 28, height: 28, borderRadius: 6,
              border: '1px solid var(--border-light)', background: 'var(--bg-card)',
              fontSize: 11, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
