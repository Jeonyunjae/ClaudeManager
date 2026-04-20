'use client';

import React, { useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCostStore } from '@/stores/costStore';
import { CostSummaryBar } from '@/components/data/CostSummaryBar';
import { CostByModelChart } from '@/components/data/CostByModelChart';
import { CostTrendChart } from '@/components/data/CostTrendChart';

export default function CostDashboardPage() {
  const { period, setPeriod, fetchAll } = useCostStore();

  useEffect(() => {
    fetchAll();
  }, [fetchAll, period]);

  return (
    <div className="p-[var(--space-6)] space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[var(--text-h1)] font-bold">Cost Dashboard</h1>
        <div className="flex gap-1">
          {(['day', 'week', 'month'] as const).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={period === p ? 'default' : 'outline'}
              onClick={() => setPeriod(p)}
            >
              {p}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cost Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <CostSummaryBar />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">By Model</CardTitle>
          </CardHeader>
          <CardContent>
            <CostByModelChart />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <CostTrendChart />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
