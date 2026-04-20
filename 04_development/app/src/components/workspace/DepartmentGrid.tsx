'use client';

import React from 'react';
import type { AgentTreeNode } from '@/types/agent';
import { DepartmentCard } from './DepartmentCard';

type DepartmentGridProps = {
  partAgents: AgentTreeNode[];
};

export function DepartmentGrid({ partAgents }: DepartmentGridProps) {
  if (partAgents.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {partAgents.map((part, index) => (
        <DepartmentCard key={part.id} partAgent={part} partIndex={index} />
      ))}
    </div>
  );
}
