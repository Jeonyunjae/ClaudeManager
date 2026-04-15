'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal, ModalContent, ModalHeader, ModalTitle } from '@/components/ui/modal';
import { apiClient } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface ApiKeyData {
  id: number;
  provider: string;
  keyMasked: string;
  status: string;
  expiresAt: string | null;
  monthlyUsage: number | null;
  createdAt: string;
}

export function ApiKeySettings() {
  const [keys, setKeys] = useState<ApiKeyData[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newProvider, setNewProvider] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newExpires, setNewExpires] = useState('');

  const loadKeys = () => {
    apiClient.get<ApiKeyData[]>('/api/apikeys').then((res) => setKeys(res.data)).catch(() => {});
  };

  useEffect(() => { loadKeys(); }, []);

  const handleAdd = async () => {
    if (!newProvider || !newKey) return;
    await apiClient.post('/api/apikeys', {
      provider: newProvider,
      key: newKey,
      expiresAt: newExpires || undefined,
    });
    setShowAdd(false);
    setNewProvider('');
    setNewKey('');
    setNewExpires('');
    loadKeys();
  };

  const handleDelete = async (id: number) => {
    await apiClient.del(`/api/apikeys/${id}`);
    loadKeys();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">API Keys</h2>
        <Button size="sm" onClick={() => setShowAdd(true)}>Add Key</Button>
      </div>

      {keys.length === 0 ? (
        <p className="text-sm text-[var(--text-tertiary)] text-center py-8">No API keys registered.</p>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <Card key={k.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{k.provider}</span>
                    <Badge variant={k.status === 'active' ? 'active' : 'error'}>{k.status}</Badge>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] font-mono mt-0.5">{k.keyMasked}</p>
                  {k.monthlyUsage != null && (
                    <p className="text-[10px] text-[var(--text-tertiary)]">Usage: {formatCurrency(k.monthlyUsage)}</p>
                  )}
                </div>
                <Button size="sm" variant="danger" onClick={() => handleDelete(k.id)}>Delete</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showAdd} onOpenChange={(open) => { if (!open) setShowAdd(false); }}>
        <ModalContent size="sm">
        <ModalHeader><ModalTitle>Add API Key</ModalTitle></ModalHeader>
        <div className="space-y-3 px-6 pb-6">
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Provider</label>
            <select
              value={newProvider}
              onChange={(e) => setNewProvider(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--primary-100)] bg-[var(--bg-surface)]"
            >
              <option value="">Select provider...</option>
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
              <option value="google">Google</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-secondary)]">API Key</label>
            <Input
              type="password"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="sk-..."
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Expires At (optional)</label>
            <Input
              type="date"
              value={newExpires}
              onChange={(e) => setNewExpires(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd}>Save</Button>
          </div>
        </div>
        </ModalContent>
      </Modal>
    </div>
  );
}
