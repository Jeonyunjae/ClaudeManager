import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { settings, auditLogs } from '@/lib/schema';
import { getAuthenticatedUserId } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import { DEFAULT_RETRY_COUNT, DEFAULT_COST_LIMIT, DEFAULT_ALERT_THRESHOLD, DEFAULT_MAX_CONCURRENT_AGENTS } from '@/lib/constants';

const SETTING_KEYS = ['retry_count', 'retry_strategy', 'cost_limit', 'alert_threshold', 'max_concurrent_agents'] as const;

const DEFAULTS: Record<string, string> = {
  retry_count: String(DEFAULT_RETRY_COUNT),
  retry_strategy: 'exponential',
  cost_limit: String(DEFAULT_COST_LIMIT),
  alert_threshold: String(DEFAULT_ALERT_THRESHOLD),
  max_concurrent_agents: String(DEFAULT_MAX_CONCURRENT_AGENTS),
};

export async function GET(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_TOKEN_EXPIRED', message: '인증이 필요합니다.' } },
      { status: 401 }
    );
  }

  try {
    const allSettings = await db.select().from(settings);
    const settingsMap = new Map(allSettings.map((s) => [s.key, s.value]));

    return NextResponse.json({
      data: {
        retryCount: parseInt(settingsMap.get('retry_count') || DEFAULTS.retry_count),
        retryStrategy: settingsMap.get('retry_strategy') || DEFAULTS.retry_strategy,
        costLimit: parseFloat(settingsMap.get('cost_limit') || DEFAULTS.cost_limit),
        alertThreshold: parseFloat(settingsMap.get('alert_threshold') || DEFAULTS.alert_threshold),
        maxConcurrentAgents: parseInt(settingsMap.get('max_concurrent_agents') || DEFAULTS.max_concurrent_agents),
      },
    });
  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: '서버 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_TOKEN_EXPIRED', message: '인증이 필요합니다.' } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const keyMap: Record<string, string> = {
      retryCount: 'retry_count',
      retryStrategy: 'retry_strategy',
      costLimit: 'cost_limit',
      alertThreshold: 'alert_threshold',
      maxConcurrentAgents: 'max_concurrent_agents',
    };

    for (const [camelKey, value] of Object.entries(body)) {
      const dbKey = keyMap[camelKey];
      if (!dbKey) continue;

      const existing = await db.select().from(settings).where(eq(settings.key, dbKey)).limit(1);
      const now = new Date().toISOString();

      if (existing.length > 0) {
        await db.update(settings).set({ value: String(value), updatedAt: now }).where(eq(settings.key, dbKey));
      } else {
        await db.insert(settings).values({ key: dbKey, value: String(value), updatedAt: now });
      }
    }

    await db.insert(auditLogs).values({
      actorType: 'user',
      actorId: String(userId),
      action: 'setting_change',
      resource: 'settings',
      detail: JSON.stringify(body),
    });

    return NextResponse.json({ data: { updated: true } });
  } catch (error) {
    console.error('Settings PUT error:', error);
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: '서버 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}
