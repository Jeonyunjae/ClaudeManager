'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSettingsStore } from '@/stores/settingsStore';
import { PartPolicySettings } from '@/components/settings/PartPolicySettings';
import { ApiKeySettings } from '@/components/settings/ApiKeySettings';
import { BackupSettings } from '@/components/settings/BackupSettings';
import { SystemHealthPanel } from '@/components/system/SystemHealthPanel';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'global', label: 'Global' },
  { key: 'part-policy', label: 'Part Policy' },
  { key: 'apikeys', label: 'API Keys' },
  { key: 'backup', label: 'Backup' },
  { key: 'system', label: 'System Health' },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function SettingsPage() {
  const { settings, fetchSettings, updateSettings } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<TabKey>('global');
  const [formData, setFormData] = useState({
    retryCount: 3,
    costLimit: 100,
    alertThreshold: 80,
    maxConcurrentAgents: 10,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (settings) {
      setFormData({
        retryCount: settings.retryCount,
        costLimit: settings.costLimit,
        alertThreshold: settings.alertThreshold,
        maxConcurrentAgents: settings.maxConcurrentAgents,
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings(formData);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-[var(--space-6)] space-y-6">
      <h1 className="text-[var(--text-h1)] font-bold">Settings</h1>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[var(--primary-50)]">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.key
                ? 'border-[var(--primary-500)] text-[var(--primary-600)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="max-w-3xl">
        {activeTab === 'global' && (
          <Card>
            <CardHeader>
              <CardTitle>Global Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--text-primary)] mb-1 block">Retry Count</label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={formData.retryCount}
                  onChange={(e) => setFormData((prev) => ({ ...prev, retryCount: parseInt(e.target.value) || 0 }))}
                />
                <p className="text-xs text-[var(--text-tertiary)] mt-1">Auto retry count on agent error (0~10)</p>
              </div>

              <div>
                <label className="text-sm font-medium text-[var(--text-primary)] mb-1 block">Monthly Cost Limit ($)</label>
                <Input
                  type="number"
                  min={0}
                  value={formData.costLimit}
                  onChange={(e) => setFormData((prev) => ({ ...prev, costLimit: parseFloat(e.target.value) || 0 }))}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[var(--text-primary)] mb-1 block">Alert Threshold (%)</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.alertThreshold}
                  onChange={(e) => setFormData((prev) => ({ ...prev, alertThreshold: parseInt(e.target.value) || 0 }))}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[var(--text-primary)] mb-1 block">Max Concurrent Agents</label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={formData.maxConcurrentAgents}
                  onChange={(e) => setFormData((prev) => ({ ...prev, maxConcurrentAgents: parseInt(e.target.value) || 1 }))}
                />
              </div>

              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </CardContent>
          </Card>
        )}

        {activeTab === 'part-policy' && <PartPolicySettings />}
        {activeTab === 'apikeys' && <ApiKeySettings />}
        {activeTab === 'backup' && <BackupSettings />}
        {activeTab === 'system' && (
          <Card>
            <CardHeader>
              <CardTitle>System Health</CardTitle>
            </CardHeader>
            <CardContent>
              <SystemHealthPanel />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
