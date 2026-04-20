'use client';

import React from 'react';
import { useAgentStore } from '@/stores/agentStore';
import { useSystemStore } from '@/stores/systemStore';

export function BottomBar() {
  const { agents } = useAgentStore();
  const { health } = useSystemStore();

  const activeCount = Array.from(agents.values()).filter((a) => a.status === 'active').length;

  return (
    <div style={{
      height: 36,
      background: 'var(--bg-card, #FFFFFF)',
      borderTop: '1px solid var(--border-light, #E5E7EB)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px',
      fontSize: 11, color: '#9CA3AF',
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 99,
    }}>
      <span>YJ Manager v1.0 &middot; Connected</span>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="2" width="20" height="20" rx="2" />
            <path d="M7 10h10" />
            <path d="M7 14h6" />
          </svg>
          CPU {health ? `${health.cpu.toFixed(0)}%` : '0%'}
        </span>
        <span>MEM {health ? `${health.memory.toFixed(0)}%` : '0%'}</span>
        <span>DISK {health ? `${health.disk.toFixed(0)}%` : '0%'}</span>
        <span>Agents: {activeCount} active</span>
      </div>
    </div>
  );
}
