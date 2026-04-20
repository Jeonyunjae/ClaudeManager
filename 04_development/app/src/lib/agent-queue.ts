/**
 * Agent Queue — manages agent concurrency limits.
 *
 * When the number of active agents reaches maxConcurrentAgents,
 * new agents are placed in a 'queued' status. When an active agent
 * finishes, the next queued agent is automatically started.
 */

import db from './db';
import { agents, settings } from './schema';
import { eq, count, asc, sql } from 'drizzle-orm';
import { DEFAULT_MAX_CONCURRENT_AGENTS } from './constants';
import { broadcastAgentStatus } from './ws-bridge';

/**
 * Get the configured max concurrent agents limit.
 */
export async function getMaxConcurrentAgents(): Promise<number> {
  try {
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'max_concurrent_agents'))
      .limit(1);
    return row ? parseInt(row.value, 10) : DEFAULT_MAX_CONCURRENT_AGENTS;
  } catch {
    return DEFAULT_MAX_CONCURRENT_AGENTS;
  }
}

/**
 * Get current active agent count.
 */
export async function getActiveAgentCount(): Promise<number> {
  const rows = await db
    .select({ count: count() })
    .from(agents)
    .where(eq(agents.status, 'active'));
  return rows[0]?.count ?? 0;
}

/**
 * Get queued agents in order.
 */
export async function getQueuedAgents(): Promise<Array<{ id: string; name: string; createdAt: string }>> {
  return await db
    .select({ id: agents.id, name: agents.name, createdAt: agents.createdAt })
    .from(agents)
    .where(eq(agents.status, 'queued'))
    .orderBy(asc(agents.createdAt));
}

/**
 * Try to activate an agent. If the limit is reached, queue it instead.
 * Returns the resulting status ('active' or 'queued').
 */
export async function tryActivateAgent(agentId: string): Promise<'active' | 'queued'> {
  const maxAgents = await getMaxConcurrentAgents();
  const activeCount = await getActiveAgentCount();

  if (activeCount >= maxAgents) {
    // Queue the agent
    await db.update(agents)
      .set({
        status: 'queued',
        statusMessage: `Queued (${activeCount}/${maxAgents} active)`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(agents.id, agentId));

    broadcastAgentStatus(agentId, 'queued', `Queued (${activeCount}/${maxAgents} active)`);
    return 'queued';
  }

  // Activate the agent
  await db.update(agents)
    .set({
      status: 'active',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(agents.id, agentId));

  broadcastAgentStatus(agentId, 'active');
  return 'active';
}

/**
 * Called when an agent finishes (idle, stopped, error).
 * Promotes the next queued agent to active.
 */
export async function onAgentFinished(agentId: string): Promise<void> {
  const queued = await getQueuedAgents();
  if (queued.length === 0) return;

  const maxAgents = await getMaxConcurrentAgents();
  const activeCount = await getActiveAgentCount();

  if (activeCount < maxAgents) {
    const next = queued[0];
    await db.update(agents)
      .set({
        status: 'active',
        statusMessage: 'Promoted from queue',
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(agents.id, next.id));

    broadcastAgentStatus(next.id, 'active', 'Promoted from queue');
    console.log(`[agent-queue] Promoted ${next.id} (${next.name}) from queue`);
  }
}

/**
 * Get queue status for API response.
 */
export async function getQueueStatus(): Promise<{
  maxConcurrent: number;
  activeCount: number;
  queuedCount: number;
  queuedAgents: Array<{ id: string; name: string; createdAt: string }>;
}> {
  const maxConcurrent = await getMaxConcurrentAgents();
  const activeCount = await getActiveAgentCount();
  const queuedAgents = await getQueuedAgents();

  return {
    maxConcurrent,
    activeCount,
    queuedCount: queuedAgents.length,
    queuedAgents,
  };
}
