'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

interface ErrorLog {
  id: number;
  agentName: string;
  message: string;
  status?: string;
  createdAt: string;
}

const MOCK_ERRORS: ErrorLog[] = [
  { id: 1, agentName: 'Tester', message: 'E2E test failed \u2014 timeout 30s exceeded', status: 'unresolved', createdAt: '04/16 14:02' },
  { id: 2, agentName: 'API Developer', message: 'DB connection pool exhausted \u2014 max_connections exceeded', status: 'resolved', createdAt: '04/15 22:10' },
  { id: 3, agentName: 'Main', message: 'WebSocket disconnected \u2014 auto reconnect success', status: 'resolved', createdAt: '04/14 08:30' },
];

export default function ErrorLogsPage() {
  const [data, setData] = useState<ErrorLog[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    apiClient.get<ErrorLog[]>('/api/logs/errors')
      .then(res => { if (res.data && res.data.length > 0) setData(res.data); })
      .catch(() => {});
  }, []);

  const filtered = data.filter(e => {
    if (search && !e.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ background: 'var(--bg-content-card)', borderRadius: 20, margin: '16px 20px', padding: '20px 12px', minHeight: 'calc(100vh - 56px - 68px)' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Error Log</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search errors..." style={{
              padding: '5px 10px', borderRadius: 6,
              border: '1px solid var(--border-light)', fontSize: 11,
              outline: 'none', width: 140, fontFamily: 'inherit',
            }} />
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Time', 'Agent', 'Error', 'Status'].map(h => (
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
                <td style={{ padding: 10, fontSize: 12, borderBottom: '1px solid var(--bg-surface)' }}>{row.agentName}</td>
                <td style={{ padding: 10, fontSize: 12, borderBottom: '1px solid var(--bg-surface)' }}>{row.message}</td>
                <td style={{ padding: 10, fontSize: 12, borderBottom: '1px solid var(--bg-surface)' }}>
                  <span style={{
                    fontSize: 9, fontWeight: 500, padding: '2px 8px',
                    borderRadius: 10, display: 'inline-block',
                    ...(row.status === 'unresolved'
                      ? { background: 'var(--status-error-bg)', color: 'var(--status-error-text)' }
                      : { background: 'var(--status-active-bg)', color: 'var(--status-active-text)' }),
                  }}>{row.status === 'unresolved' ? 'Unresolved' : 'Resolved'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 11, color: 'var(--text-tertiary)' }}>
          <span>1-{filtered.length} / {filtered.length}</span>
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
