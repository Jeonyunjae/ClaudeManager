/**
 * WebSocket Bridge — allows Next.js API routes to broadcast events to the
 * separate WebSocket server process.
 *
 * The WS server exposes an internal HTTP endpoint at /_broadcast on port 3001.
 * This module provides a simple fire-and-forget POST to that endpoint.
 *
 * If the WS server is unreachable (e.g. not started yet), errors are logged
 * but do not break the API route.
 */

import { WS_PORT } from './constants';

const WS_BROADCAST_URL = `http://localhost:${WS_PORT}/_broadcast`;
const WS_CLI_EXECUTE_URL = `http://localhost:${WS_PORT}/_cli-execute`;
const WS_CLI_CANCEL_URL = `http://localhost:${WS_PORT}/_cli-cancel`;
const BROADCAST_SECRET = process.env.WS_BROADCAST_SECRET || 'claudemanager-ws-internal';

/**
 * Request CLI execution on the WS server process.
 * Fire-and-forget — the WS server runs the CLI and delivers results via WebSocket.
 */
export async function requestCliExecution(params: {
  agentId: string;
  agentName: string;
  modelName?: string;
  cliPrompt: string;
  systemPrompt: string;
  responseMsgId: string;
  userId: string;
}): Promise<void> {
  try {
    await fetch(WS_CLI_EXECUTE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ws-secret': BROADCAST_SECRET,
      },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[ws-bridge] Failed to request CLI execution — WS server may be offline');
    }
  }
}

/**
 * Request cancellation of a running CLI process.
 */
export async function requestCliCancel(agentId: string): Promise<boolean> {
  try {
    const res = await fetch(WS_CLI_CANCEL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ws-secret': BROADCAST_SECRET,
      },
      body: JSON.stringify({ agentId }),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      return data.cancelled === true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Broadcast an event to all connected WebSocket clients.
 * Fire-and-forget — never throws.
 */
export async function wsBroadcast(type: string, payload: unknown): Promise<void> {
  try {
    await fetch(WS_BROADCAST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ws-secret': BROADCAST_SECRET,
      },
      body: JSON.stringify({ type, payload }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // WS server may not be running — silently ignore
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[ws-bridge] Failed to broadcast ${type} — WS server may be offline`);
    }
  }
}

/**
 * Broadcast an agent status change.
 */
export function broadcastAgentStatus(
  agentId: string,
  status: string,
  statusMessage?: string
): Promise<void> {
  return wsBroadcast('agent:status', { agentId, status, statusMessage });
}

/**
 * Broadcast a new chat message.
 */
export function broadcastChatMessage(message: {
  id: string;
  sender: string;
  content: string;
  messageType: string;
  metadata?: unknown;
}): Promise<void> {
  return wsBroadcast('chat:message', message);
}

/**
 * Broadcast an approval request.
 */
export function broadcastApprovalRequest(approval: {
  id: string;
  title: string;
  content: string;
  urgency: string;
  sourceAgent?: string;
}): Promise<void> {
  return wsBroadcast('approval:request', approval);
}

/**
 * Broadcast an approval resolution.
 */
export function broadcastApprovalResolved(id: string, result: string): Promise<void> {
  return wsBroadcast('approval:resolved', { id, result });
}

/**
 * Broadcast a new Part creation.
 */
export function broadcastPartCreated(part: {
  id: string;
  name: string;
  color?: string | null;
}): Promise<void> {
  return wsBroadcast('part:created', { part });
}

/**
 * Broadcast a new agent creation.
 */
export function broadcastAgentCreated(agent: {
  id: string;
  name: string;
  role: string;
  partId?: string | null;
}): Promise<void> {
  return wsBroadcast('agent:created', { agent });
}

/**
 * Broadcast an agent removal.
 */
export function broadcastAgentRemoved(agentId: string): Promise<void> {
  return wsBroadcast('agent:removed', { agentId });
}

/**
 * Broadcast a notification.
 */
export function broadcastNotification(notification: {
  id?: number;
  type: string;
  title: string;
  message: string;
}): Promise<void> {
  return wsBroadcast('notification:new', { notification });
}

/**
 * Broadcast cost update.
 */
export function broadcastCostUpdated(summary: {
  totalCost: number;
  overageLimit: number;
  overage: number;
  overageRemaining: number;
  percentage: number;
}): Promise<void> {
  return wsBroadcast('cost:updated', { summary });
}

/**
 * Broadcast a new log entry.
 */
export function broadcastLogNew(agentId: string, entry: Record<string, unknown>): Promise<void> {
  return wsBroadcast('log:new', { agentId, entry });
}
