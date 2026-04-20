/**
 * Execution Queue — priority-based agent execution queue.
 *
 * Manages task execution with 4-level priority system:
 * - urgent: immediate execution, preempts low-priority tasks
 * - high: preferred execution order
 * - normal: default FIFO
 * - low: execute when idle
 *
 * Integrates with agent-queue for concurrency limits.
 */

import db from './db';
import { executionQueue, settings } from './schema';
import { eq, and, asc, desc, count, sql, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_MAX_CONCURRENT_AGENTS } from './constants';

export type Priority = 'urgent' | 'high' | 'normal' | 'low';
export type ExecutionStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

const PRIORITY_ORDER: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export interface QueueEntry {
  id: string;
  projectId?: string;
  agentId?: string;
  taskDescription: string;
  priority: Priority;
  status: ExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  result?: string;
  createdAt: string;
}

/**
 * Enqueue a task for execution.
 */
export async function enqueueTask(params: {
  projectId?: string;
  agentId?: string;
  taskDescription: string;
  priority?: Priority;
}): Promise<QueueEntry> {
  const id = uuidv4();
  const priority = params.priority || 'normal';
  const now = new Date().toISOString();

  await db.insert(executionQueue)
    .values({
      id,
      projectId: params.projectId ?? null,
      agentId: params.agentId ?? null,
      taskDescription: params.taskDescription,
      priority,
      status: 'queued',
      createdAt: now,
    });

  return {
    id,
    projectId: params.projectId,
    agentId: params.agentId,
    taskDescription: params.taskDescription,
    priority,
    status: 'queued',
    createdAt: now,
  };
}

/**
 * Get the next task to execute based on priority.
 * Priority order: urgent > high > normal > low, then FIFO within same priority.
 */
export async function dequeueNext(): Promise<QueueEntry | null> {
  // Use SQL CASE for priority ordering
  const [row] = await db
    .select()
    .from(executionQueue)
    .where(eq(executionQueue.status, 'queued'))
    .orderBy(
      sql`CASE ${executionQueue.priority}
        WHEN 'urgent' THEN 0
        WHEN 'high' THEN 1
        WHEN 'normal' THEN 2
        WHEN 'low' THEN 3
        ELSE 4
      END`,
      asc(executionQueue.createdAt)
    )
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    projectId: row.projectId ?? undefined,
    agentId: row.agentId ?? undefined,
    taskDescription: row.taskDescription,
    priority: row.priority as Priority,
    status: row.status as ExecutionStatus,
    startedAt: row.startedAt ?? undefined,
    completedAt: row.completedAt ?? undefined,
    result: row.result ?? undefined,
    createdAt: row.createdAt,
  };
}

/**
 * Mark a queued task as running.
 */
export async function markRunning(taskId: string): Promise<void> {
  await db.update(executionQueue)
    .set({
      status: 'running',
      startedAt: new Date().toISOString(),
    })
    .where(eq(executionQueue.id, taskId));
}

/**
 * Mark a running task as completed.
 */
export async function markCompleted(taskId: string, result?: string): Promise<void> {
  await db.update(executionQueue)
    .set({
      status: 'completed',
      completedAt: new Date().toISOString(),
      result: result ?? null,
    })
    .where(eq(executionQueue.id, taskId));
}

/**
 * Mark a running task as failed.
 */
export async function markFailed(taskId: string, error?: string): Promise<void> {
  await db.update(executionQueue)
    .set({
      status: 'failed',
      completedAt: new Date().toISOString(),
      result: error ?? null,
    })
    .where(eq(executionQueue.id, taskId));
}

/**
 * Cancel a queued task.
 */
export async function cancelTask(taskId: string): Promise<boolean> {
  const result = await db
    .update(executionQueue)
    .set({ status: 'cancelled' })
    .where(and(
      eq(executionQueue.id, taskId),
      eq(executionQueue.status, 'queued')
    ))
    .returning();
  return result.length > 0;
}

/**
 * Get the current queue status.
 */
export async function getQueueStatus(): Promise<{
  queued: number;
  running: number;
  completed: number;
  failed: number;
  items: QueueEntry[];
}> {
  const items = await db
    .select()
    .from(executionQueue)
    .where(
      inArray(executionQueue.status, ['queued', 'running'])
    )
    .orderBy(
      sql`CASE ${executionQueue.status} WHEN 'running' THEN 0 ELSE 1 END`,
      sql`CASE ${executionQueue.priority}
        WHEN 'urgent' THEN 0
        WHEN 'high' THEN 1
        WHEN 'normal' THEN 2
        WHEN 'low' THEN 3
        ELSE 4
      END`,
      asc(executionQueue.createdAt)
    );

  const queuedCount = items.filter(i => i.status === 'queued').length;
  const runningCount = items.filter(i => i.status === 'running').length;

  // Count completed and failed from DB
  const completedRows = await db
    .select({ count: count() })
    .from(executionQueue)
    .where(eq(executionQueue.status, 'completed'));

  const failedRows = await db
    .select({ count: count() })
    .from(executionQueue)
    .where(eq(executionQueue.status, 'failed'));

  return {
    queued: queuedCount,
    running: runningCount,
    completed: completedRows[0]?.count ?? 0,
    failed: failedRows[0]?.count ?? 0,
    items: items.map(row => ({
      id: row.id,
      projectId: row.projectId ?? undefined,
      agentId: row.agentId ?? undefined,
      taskDescription: row.taskDescription,
      priority: row.priority as Priority,
      status: row.status as ExecutionStatus,
      startedAt: row.startedAt ?? undefined,
      completedAt: row.completedAt ?? undefined,
      result: row.result ?? undefined,
      createdAt: row.createdAt,
    })),
  };
}

/**
 * Get running task count (for concurrency check).
 */
export async function getRunningCount(): Promise<number> {
  const rows = await db
    .select({ count: count() })
    .from(executionQueue)
    .where(eq(executionQueue.status, 'running'));
  return rows[0]?.count ?? 0;
}
