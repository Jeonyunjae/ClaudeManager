/**
 * Error Logger — saves errors to the agentLogs table for centralized error tracking.
 *
 * Used across all API routes to replace bare console.error calls with
 * persistent DB storage + optional WebSocket broadcast.
 */

import db from './db';
import { agentLogs } from './schema';
import { broadcastLogNew } from './ws-bridge';

interface ErrorLogOptions {
  /** Agent ID that caused the error (use 'system' for non-agent errors) */
  agentId?: string;
  /** HTTP request path, e.g. /api/settings */
  requestPath?: string;
  /** Related resource ID (project, approval, etc.) */
  resourceId?: string;
  /** Additional structured context */
  context?: Record<string, unknown>;
}

/**
 * Log an error to the DB and optionally broadcast via WebSocket.
 * Never throws — safe to call in catch blocks.
 */
export function logError(error: unknown, options: ErrorLogOptions = {}): void {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const agentId = options.agentId || 'system';
    const message = err.message;

    const detail: Record<string, unknown> = {
      stack: err.stack,
      requestPath: options.requestPath,
      resourceId: options.resourceId,
      ...options.context,
    };

    // Fire and forget — don't await in error logging to avoid cascading failures
    db.insert(agentLogs)
      .values({
        agentId,
        eventType: 'error',
        message,
        detail: JSON.stringify(detail),
      })
      .then(() => {})
      .catch((logErr) => {
        console.error('[error-logger] Failed to persist error:', logErr);
      });

    // Also broadcast to connected clients
    broadcastLogNew(agentId, {
      eventType: 'error',
      message,
      data: detail,
    });
  } catch (logErr) {
    // Last resort — if DB write fails, fall back to console
    console.error('[error-logger] Failed to persist error:', logErr);
    console.error('[error-logger] Original error:', error);
  }
}

/**
 * Convenience wrapper: log + return a formatted API error response body.
 */
export function logAndFormatError(
  error: unknown,
  code: string,
  userMessage: string,
  options: ErrorLogOptions = {}
): { error: { code: string; message: string } } {
  logError(error, options);
  return { error: { code, message: userMessage } };
}
