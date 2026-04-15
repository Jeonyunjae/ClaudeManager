'use client';

import React, { useEffect, useState } from 'react';
import { DataTable } from '@/components/data/DataTable';
import { FilterPanel } from '@/components/data/FilterPanel';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

interface ErrorLog {
  id: number;
  agentId: string;
  agentName: string;
  message: string | null;
  stackTrace: string | null;
  createdAt: string;
}

export default function ErrorLogsPage() {
  const [data, setData] = useState<ErrorLog[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const load = (params?: Record<string, string>) => {
    const query = new URLSearchParams(params || {}).toString();
    apiClient.get<ErrorLog[]>(`/api/logs/errors${query ? `?${query}` : ''}`)
      .then((res) => setData(res.data))
      .catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const columns = [
    { key: 'agentName', header: 'Agent' },
    {
      key: 'message',
      header: 'Message',
      render: (row: Record<string, unknown>) => (
        <span className="truncate max-w-xs block">{(row.message as string) || 'No message'}</span>
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
      <h1 className="text-[var(--text-h1)] font-bold">Error Logs</h1>

      <FilterPanel
        fields={[
          { key: 'search', label: 'Search', type: 'text' },
          { key: 'from', label: 'From', type: 'date' },
          { key: 'to', label: 'To', type: 'date' },
        ]}
        values={filters}
        onChange={(key, value) => setFilters({ ...filters, [key]: value })}
        onApply={() => load(filters)}
        onReset={() => { setFilters({}); load(); }}
      />

      <DataTable columns={columns} data={data as unknown as Record<string, unknown>[]} emptyMessage="No error logs." />
    </div>
  );
}
