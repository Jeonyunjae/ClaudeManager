'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';

interface ProjectProgress {
  projectId: string;
  projectName: string;
  stages: Array<{ name: string; status: string; percentage: number }>;
  overallProgress: number;
  recentActivities: Array<{ date: string; description: string }>;
}

export function ProgressReport() {
  const [projects, setProjects] = useState<ProjectProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<ProjectProgress[]>('/api/reports/progress')
      .then((res) => setProjects(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="animate-pulse space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-24 bg-[var(--primary-50)] rounded-[var(--radius-md)]" />)}</div>;
  }

  if (projects.length === 0) {
    return <p className="text-sm text-[var(--text-tertiary)] text-center py-8">No projects found.</p>;
  }

  return (
    <div className="space-y-4">
      {projects.map((project) => (
        <Card key={project.projectId}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{project.projectName}</CardTitle>
              <span className="text-xs font-medium text-[var(--primary-600)]">
                {project.overallProgress}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--primary-50)] mt-2">
              <div
                className="h-full rounded-full bg-[var(--primary-500)] transition-all"
                style={{ width: `${project.overallProgress}%` }}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {project.stages.map((stage) => (
                <div key={stage.name} className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-secondary)]">{stage.name}</span>
                  <Badge variant={stage.status === 'completed' ? 'complete' : stage.status === 'active' ? 'active' : 'idle'}>
                    {stage.percentage}%
                  </Badge>
                </div>
              ))}
            </div>
            {project.recentActivities.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[var(--primary-50)] space-y-1">
                {project.recentActivities.slice(0, 3).map((activity, i) => (
                  <p key={i} className="text-[10px] text-[var(--text-tertiary)]">
                    {formatRelativeTime(activity.date)}: {activity.description}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
