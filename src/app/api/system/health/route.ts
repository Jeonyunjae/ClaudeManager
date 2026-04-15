import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import db from '@/lib/db';
import { agents, settings } from '@/lib/schema';
import { eq, count } from 'drizzle-orm';
import os from 'os';

export async function GET(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_TOKEN_EXPIRED', message: '인증이 필요합니다.' } },
      { status: 401 }
    );
  }

  try {
    // CPU usage (approximate via load average)
    const loadAvg = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    const cpuPercent = Math.min(100, (loadAvg / cpuCount) * 100);

    // Memory
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryPercent = ((totalMem - freeMem) / totalMem) * 100;

    // Disk (simplified — returns 0 as we cannot easily get disk usage in Node)
    const diskPercent = 0;

    // Active agents
    const [activeResult] = await db.select({ count: count() }).from(agents).where(eq(agents.status, 'active'));

    // Max agents setting
    const maxAgentsSetting = await db.select().from(settings).where(eq(settings.key, 'max_concurrent_agents')).limit(1);
    const maxAgents = maxAgentsSetting.length > 0 ? parseInt(maxAgentsSetting[0].value) : 10;

    // Determine status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (cpuPercent > 90 || memoryPercent > 90) {
      status = 'critical';
    } else if (cpuPercent > 70 || memoryPercent > 70) {
      status = 'warning';
    }

    return NextResponse.json({
      data: {
        cpu: cpuPercent,
        memory: memoryPercent,
        disk: diskPercent,
        networkUp: 0,
        networkDown: 0,
        activeAgents: activeResult.count,
        maxAgents,
        status,
      },
    });
  } catch (error) {
    console.error('Health error:', error);
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: '서버 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}
