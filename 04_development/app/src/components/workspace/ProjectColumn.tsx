'use client';

import React, { useEffect } from 'react';
import { FolderOpen } from 'lucide-react';
import { ProjectCard } from './ProjectCard';
import { usePriorityStore } from '@/stores/priorityStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { usePartStore } from '@/stores/partStore';

export function ProjectColumn() {
  const { projects, isLoading, fetchProjects } = usePriorityStore();
  const { setSelectedProjectId, sortOrder, filterState } = useWorkspaceStore();
  const { parts } = usePartStore();

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Filter projects
  let filtered = [...projects];
  if (filterState.status) {
    filtered = filtered.filter((p) => p.status === filterState.status);
  }
  if (filterState.priority) {
    filtered = filtered.filter((p) => p.priority === filterState.priority);
  }
  if (filterState.partId) {
    filtered = filtered.filter((p) => p.partId === filterState.partId);
  }

  // Sort projects
  const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
  if (sortOrder === 'priority') {
    filtered.sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));
  } else if (sortOrder === 'name') {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortOrder === 'progress') {
    filtered.sort((a, b) => b.progressPercent - a.progressPercent);
  }

  const getPartInfo = (partId: string) => {
    return parts.find((p) => p.id === partId);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--primary-50)]">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-[var(--primary-500)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Projects</h3>
          <span className="text-xs text-[var(--text-tertiary)]">({filtered.length})</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-lg bg-[var(--primary-50)] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-sm text-[var(--text-tertiary)]">
            No projects yet. Start a conversation with Main to create one.
          </div>
        ) : (
          filtered.map((project) => {
            const part = getPartInfo(project.partId);
            return (
              <ProjectCard
                key={project.id}
                id={project.id}
                name={project.name}
                priority={project.priority}
                status={project.status}
                currentStage={project.currentStage}
                progressPercent={project.progressPercent}
                partName={part?.name}
                partColor={part?.color ?? undefined}
                onClick={() => setSelectedProjectId(project.id)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
