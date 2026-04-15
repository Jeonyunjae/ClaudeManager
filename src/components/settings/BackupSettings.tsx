'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { formatBytes, formatDateTime } from '@/lib/utils';

interface BackupEntry {
  id: number;
  type: string;
  status: string;
  sizeBytes: number | null;
  createdAt: string;
}

interface BackupData {
  latestBackup: BackupEntry | null;
  nextScheduled: string;
  totalSize: number;
  history: BackupEntry[];
}

export function BackupSettings() {
  const [data, setData] = useState<BackupData | null>(null);
  const [backingUp, setBackingUp] = useState(false);

  const load = () => {
    apiClient.get<BackupData>('/api/backups').then((res) => setData(res.data)).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const handleManualBackup = async () => {
    setBackingUp(true);
    try {
      await apiClient.post('/api/backups/manual', {});
      load();
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestore = async (id: number) => {
    if (!confirm('Are you sure you want to restore this backup? A pre-restore backup will be created.')) return;
    await apiClient.post(`/api/backups/${id}/restore`, { confirm: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Backup / Restore</h2>
        <Button size="sm" onClick={handleManualBackup} disabled={backingUp}>
          {backingUp ? 'Backing up...' : 'Manual Backup'}
        </Button>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-[var(--text-secondary)]">Latest</p>
                <p className="text-sm font-medium">
                  {data.latestBackup ? formatDateTime(data.latestBackup.createdAt) : 'None'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-[var(--text-secondary)]">Next Scheduled</p>
                <p className="text-sm font-medium">{formatDateTime(data.nextScheduled)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-[var(--text-secondary)]">Total Size</p>
                <p className="text-sm font-medium">{formatBytes(data.totalSize)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Backup History</CardTitle>
            </CardHeader>
            <CardContent>
              {data.history.length === 0 ? (
                <p className="text-sm text-[var(--text-tertiary)]">No backup history.</p>
              ) : (
                <div className="space-y-2">
                  {data.history.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between py-2 border-b border-[var(--primary-50)] last:border-0">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant={entry.status === 'completed' ? 'complete' : 'error'}>
                            {entry.status}
                          </Badge>
                          <span className="text-xs text-[var(--text-secondary)]">{entry.type}</span>
                        </div>
                        <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                          {formatDateTime(entry.createdAt)} | {entry.sizeBytes ? formatBytes(entry.sizeBytes) : 'N/A'}
                        </p>
                      </div>
                      {entry.status === 'completed' && (
                        <Button size="sm" variant="outline" onClick={() => handleRestore(entry.id)}>
                          Restore
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
