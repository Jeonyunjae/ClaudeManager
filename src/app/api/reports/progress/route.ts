import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, auditLogs } from '@/lib/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const partId = searchParams.get('partId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const conditions = [];
  if (partId) conditions.push(eq(projects.partId, partId));
  if (from) conditions.push(gte(projects.createdAt, from));
  if (to) conditions.push(lte(projects.createdAt, to));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const projectList = db.select()
    .from(projects)
    .where(whereClause)
    .all();

  const data = projectList.map((project) => {
    const recentActivities = db.select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.resource, 'project'),
          eq(auditLogs.resourceId, project.id)
        )
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(5)
      .all()
      .map((log) => ({
        date: log.createdAt,
        description: log.detail || log.action,
      }));

    return {
      projectId: project.id,
      projectName: project.name,
      stages: [
        {
          name: project.currentStage || 'unknown',
          status: project.status === 'completed' ? 'completed' : 'active',
          percentage: project.progressPercent || 0,
        },
      ],
      overallProgress: project.progressPercent || 0,
      recentActivities,
    };
  });

  return NextResponse.json({ data });
}
