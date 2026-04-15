'use client';

import React, { useEffect, useState } from 'react';
import { DataTable } from '@/components/data/DataTable';
import { FilterPanel } from '@/components/data/FilterPanel';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

interface AuditLog {
  id: number;
  actorType: string;
  actorId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  detail: string | null;
  createdAt: string;
}

export default function AuditLogsPage() {
  const [data, setData] = useState<AuditLog[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const load = (params?: Record<string, string>) => {
    const query = new URLSearchParams(params || {}).toString();
    apiClient.get<AuditLog[]>(`/api/audit${query ? `?${query}` : ''}`)
      .then((res) => setData(res.data))
      .catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const columns = [
    {
      key: 'actorType',
      header: 'Actor',
      render: (row: Record<string, unknown>) => (
        <Badge variant={(row.actorType as string) === 'user' ? 'active' : 'idle'}>{row.actorType as string}</Badge>
      ),
    },
    { key: 'action', header: 'Action' },
    { key: 'resource', header: 'Resource' },
    { key: 'resourceId', header: 'Resource ID', render: (row: Record<string, unknown>) => (row.resourceId as string) || '-' },
    {
      key: 'detail',
      header: 'Detail',
      render: (row: Record<string, unknown>) => (
        <span className="truncate max-w-xs block text-[10px]">{(row.detail as string) || '-'}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Time',
      render: (row: Record<string, unknown>) => formatDateTime(row.createdAt as string),
    },
  ];

  return (
    <div className="p-[var(--space-6)] space-y-4">
      <h1 className="text-[var(--text-h1)] font-bold">Audit Logs</h1>

      <FilterPanel
        fields={[
          { key: 'actorType', label: 'Actor Type', type: 'select', options: [
            { value: 'user', label: 'User' },
            { value: 'agent', label: 'Agent' },
            { value: 'system', label: 'System' },
          ]},
          { key: 'action', label: 'Action', type: 'text' },
          { key: 'search', label: 'Search', type: 'text' },
          { key: 'from', label: 'From', type: 'date' },
          { key: 'to', label: 'To', type: 'date' },
        ]}
        values={filters}
        onChange={(key, value) => setFilters({ ...filters, [key]: value })}
        onApply={() => load(filters)}
        onReset={() => { setFilters({}); load(); }}
      />

      <DataTable columns={columns} data={data as unknown as Record<string, unknown>[]} emptyMessage="No audit logs." />
    </div>
  );
}
