'use client';

import React, { useEffect, useState } from 'react';
import { DataTable } from '@/components/data/DataTable';
import { FilterPanel } from '@/components/data/FilterPanel';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

interface ApprovalRecord {
  id: string;
  title: string;
  status: string;
  urgency: string;
  sourceAgentName: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export default function ApprovalsHistoryPage() {
  const [data, setData] = useState<ApprovalRecord[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const load = (params?: Record<string, string>) => {
    const query = new URLSearchParams(params || {}).toString();
    apiClient.get<ApprovalRecord[]>(`/api/approvals${query ? `?${query}` : ''}`)
      .then((res) => setData(res.data))
      .catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const statusVariant = (s: string) => {
    if (s === 'approved') return 'complete' as const;
    if (s === 'rejected') return 'error' as const;
    if (s === 'modified') return 'pending' as const;
    return 'idle' as const;
  };

  const columns = [
    { key: 'title', header: 'Title' },
    {
      key: 'status',
      header: 'Status',
      render: (row: Record<string, unknown>) => <Badge variant={statusVariant(row.status as string)}>{row.status as string}</Badge>,
    },
    { key: 'urgency', header: 'Urgency' },
    { key: 'sourceAgentName', header: 'Agent', render: (row: Record<string, unknown>) => (row.sourceAgentName as string) || '-' },
    { key: 'createdAt', header: 'Created', render: (row: Record<string, unknown>) => formatDateTime(row.createdAt as string) },
    { key: 'resolvedAt', header: 'Resolved', render: (row: Record<string, unknown>) => row.resolvedAt ? formatDateTime(row.resolvedAt as string) : '-' },
  ];

  return (
    <div className="p-[var(--space-6)] space-y-4">
      <h1 className="text-[var(--text-h1)] font-bold">Approval History</h1>

      <FilterPanel
        fields={[
          { key: 'status', label: 'Status', type: 'select', options: [
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'modified', label: 'Modified' },
          ]},
          { key: 'from', label: 'From', type: 'date' },
          { key: 'to', label: 'To', type: 'date' },
        ]}
        values={filters}
        onChange={(key, value) => setFilters({ ...filters, [key]: value })}
        onApply={() => load(filters)}
        onReset={() => { setFilters({}); load(); }}
      />

      <DataTable columns={columns} data={data as unknown as Record<string, unknown>[]} emptyMessage="No approval records." />
    </div>
  );
}
