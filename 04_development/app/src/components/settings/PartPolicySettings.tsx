'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api';
import { usePartStore } from '@/stores/partStore';

interface PartPolicy {
  retryCount: number;
  retryStrategy: string;
  retryIntervalBase: number;
  approvalStages: string[];
  defaultModel: string | null;
  sensitivityLevel: string;
}

export function PartPolicySettings() {
  const { parts, selectedPartId, fetchParts, selectPart } = usePartStore();
  const [policy, setPolicy] = useState<PartPolicy | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  useEffect(() => {
    if (selectedPartId) {
      apiClient.get<PartPolicy>(`/api/parts/${selectedPartId}/policy`)
        .then((res) => setPolicy(res.data))
        .catch(() => setPolicy(null));
    }
  }, [selectedPartId]);

  const handleSave = async () => {
    if (!selectedPartId || !policy) return;
    setSaving(true);
    try {
      await apiClient.put(`/api/parts/${selectedPartId}/policy`, policy);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Part Policy</h2>

      <div className="flex gap-2 flex-wrap">
        {parts.map((part) => (
          <Button
            key={part.id}
            size="sm"
            variant={selectedPartId === part.id ? 'default' : 'outline'}
            onClick={() => selectPart(part.id)}
          >
            {part.name}
          </Button>
        ))}
      </div>

      {policy && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Retry Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-[var(--text-secondary)]">Retry Count</label>
                <Input
                  type="number"
                  value={policy.retryCount}
                  onChange={(e) => setPolicy({ ...policy, retryCount: parseInt(e.target.value, 10) || 0 })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[var(--text-secondary)]">Strategy</label>
                <select
                  value={policy.retryStrategy}
                  onChange={(e) => setPolicy({ ...policy, retryStrategy: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--primary-100)] bg-[var(--bg-surface)]"
                >
                  <option value="exponential">Exponential</option>
                  <option value="fixed">Fixed</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[var(--text-secondary)]">Interval Base (s)</label>
                <Input
                  type="number"
                  value={policy.retryIntervalBase}
                  onChange={(e) => setPolicy({ ...policy, retryIntervalBase: parseInt(e.target.value, 10) || 10 })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[var(--text-secondary)]">Sensitivity Level</label>
                <select
                  value={policy.sensitivityLevel}
                  onChange={(e) => setPolicy({ ...policy, sensitivityLevel: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--primary-100)] bg-[var(--bg-surface)]"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-xs text-[var(--text-secondary)]">Default Model</label>
                <Input
                  value={policy.defaultModel || ''}
                  onChange={(e) => setPolicy({ ...policy, defaultModel: e.target.value || null })}
                  placeholder="e.g., claude-sonnet-4-20250514"
                />
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="mt-4">
              {saving ? 'Saving...' : 'Save Policy'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
