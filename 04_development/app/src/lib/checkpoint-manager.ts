/**
 * Checkpoint Manager — saves and restores agent checkpoints.
 *
 * Provides state persistence for agent recovery after crashes.
 * Each checkpoint captures the agent's current stage, completed tasks,
 * pending tasks, and a context snapshot.
 */

import db from './db';
import { agentCheckpoints, agents } from './schema';
import { eq, desc, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

export interface CheckpointData {
  agentId: string;
  projectId?: string;
  currentStage: string;
  completedTasks: string[];
  pendingTasks: string[];
  contextSnapshot?: string;
  lastOutputHash?: string;
  metadata?: Record<string, unknown>;
}

const MAX_CHECKPOINTS_PER_AGENT = 3;

/**
 * Save a checkpoint for an agent.
 * Automatically prunes old checkpoints beyond MAX_CHECKPOINTS_PER_AGENT.
 */
export async function saveCheckpoint(data: CheckpointData): Promise<number> {
  const result = await db
    .insert(agentCheckpoints)
    .values({
      agentId: data.agentId,
      projectId: data.projectId ?? null,
      currentStage: data.currentStage,
      completedTasks: JSON.stringify(data.completedTasks),
      pendingTasks: JSON.stringify(data.pendingTasks),
      contextSnapshot: data.contextSnapshot ?? null,
      lastOutputHash: data.lastOutputHash ?? null,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
    })
    .returning({ id: agentCheckpoints.id });

  // Prune old checkpoints
  await pruneCheckpoints(data.agentId);

  return result[0].id;
}

/**
 * Get the latest checkpoint for an agent.
 */
export async function getLatestCheckpoint(agentId: string): Promise<CheckpointData | null> {
  const [row] = await db
    .select()
    .from(agentCheckpoints)
    .where(eq(agentCheckpoints.agentId, agentId))
    .orderBy(desc(agentCheckpoints.createdAt))
    .limit(1);

  if (!row) return null;

  return {
    agentId: row.agentId,
    projectId: row.projectId ?? undefined,
    currentStage: row.currentStage,
    completedTasks: row.completedTasks ? JSON.parse(row.completedTasks) : [],
    pendingTasks: row.pendingTasks ? JSON.parse(row.pendingTasks) : [],
    contextSnapshot: row.contextSnapshot ?? undefined,
    lastOutputHash: row.lastOutputHash ?? undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  };
}

/**
 * Get all checkpoints for an agent, ordered by newest first.
 */
export async function getCheckpoints(agentId: string): Promise<Array<CheckpointData & { id: number; createdAt: string }>> {
  const rows = await db
    .select()
    .from(agentCheckpoints)
    .where(eq(agentCheckpoints.agentId, agentId))
    .orderBy(desc(agentCheckpoints.createdAt));

  return rows.map((row) => ({
    id: row.id,
    agentId: row.agentId,
    projectId: row.projectId ?? undefined,
    currentStage: row.currentStage,
    completedTasks: row.completedTasks ? JSON.parse(row.completedTasks) : [],
    pendingTasks: row.pendingTasks ? JSON.parse(row.pendingTasks) : [],
    contextSnapshot: row.contextSnapshot ?? undefined,
    lastOutputHash: row.lastOutputHash ?? undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt: row.createdAt,
  }));
}

/**
 * Build a recovery prompt from the latest checkpoint.
 * Used when restarting a crashed agent.
 */
export async function buildRecoveryPrompt(agentId: string): Promise<string | null> {
  const checkpoint = await getLatestCheckpoint(agentId);
  if (!checkpoint) return null;

  const parts = [
    `[Recovery Mode] Resuming from checkpoint.`,
    `Current stage: ${checkpoint.currentStage}`,
    `Completed tasks: ${checkpoint.completedTasks.join(', ') || 'none'}`,
    `Pending tasks: ${checkpoint.pendingTasks.join(', ') || 'none'}`,
  ];

  if (checkpoint.contextSnapshot) {
    parts.push(`Context: ${checkpoint.contextSnapshot}`);
  }

  return parts.join('\n');
}

/**
 * Compute a hash of output content for verification.
 */
export function computeOutputHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Prune old checkpoints, keeping only the most recent ones.
 */
async function pruneCheckpoints(agentId: string): Promise<void> {
  const checkpoints = await db
    .select({ id: agentCheckpoints.id })
    .from(agentCheckpoints)
    .where(eq(agentCheckpoints.agentId, agentId))
    .orderBy(desc(agentCheckpoints.createdAt));

  if (checkpoints.length > MAX_CHECKPOINTS_PER_AGENT) {
    const toDelete = checkpoints.slice(MAX_CHECKPOINTS_PER_AGENT);
    for (const cp of toDelete) {
      await db.delete(agentCheckpoints).where(eq(agentCheckpoints.id, cp.id));
    }
  }
}
