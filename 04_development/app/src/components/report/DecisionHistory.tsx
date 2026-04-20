'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface Decision {
  id: string;
  date: string;
  question: string;
  decision: string;
  decidedBy: string;
  background?: string;
  rationale?: string;
}

export function DecisionHistory() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<Decision[]>('/api/reports/decisions')
      .then((res) => setDecisions(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="animate-pulse space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-[var(--primary-50)] rounded-[var(--radius-md)]" />)}</div>;
  }

  if (decisions.length === 0) {
    return <p className="text-sm text-[var(--text-tertiary)] text-center py-8">No decisions found.</p>;
  }

  const statusVariant = (d: string) => {
    if (d === 'approved') return 'complete' as const;
    if (d === 'rejected') return 'error' as const;
    return 'pending' as const;
  };

  return (
    <div className="space-y-3">
      {decisions.map((decision) => (
        <Card key={decision.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <h4 className="text-sm font-medium text-[var(--text-primary)]">{decision.question}</h4>
              <Badge variant={statusVariant(decision.decision)}>{decision.decision}</Badge>
            </div>
            {decision.background && (
              <p className="text-xs text-[var(--text-secondary)] mb-2">{decision.background}</p>
            )}
            {decision.rationale && (
              <p className="text-xs text-[var(--text-tertiary)] italic">Rationale: {decision.rationale}</p>
            )}
            <p className="text-[10px] text-[var(--text-tertiary)] mt-2">
              {formatDate(decision.date)} by {decision.decidedBy}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
