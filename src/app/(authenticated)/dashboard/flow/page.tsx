'use client';

import React from 'react';
import { FlowTreeView } from '@/components/report/FlowTreeView';

export default function FlowPage() {
  return (
    <div className="p-[var(--space-6)] space-y-6">
      <h1 className="text-[var(--text-h1)] font-bold">Conversation Flow</h1>
      <FlowTreeView />
    </div>
  );
}
