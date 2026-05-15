/**
 * WebSocket Bridge — allows Next.js API routes to communicate with the
 * WebSocket server running in the same process via internal HTTP endpoints.
 *
 * Even though WS server runs in the same Node.js process (via instrumentation.ts),
 * Next.js bundles API routes separately, so direct imports may reference
 * different module instances. HTTP bridging via localhost is reliable and fast.
 */

import { WS_PORT } from './constants';

const WS_BROADCAST_URL = `http://localhost:${WS_PORT}/_broadcast`;
const WS_CLI_EXECUTE_URL = `http://localhost:${WS_PORT}/_cli-execute`;
const WS_CLI_CANCEL_URL = `http://localhost:${WS_PORT}/_cli-cancel`;
const BROADCAST_SECRET = process.env.WS_BROADCAST_SECRET || 'claudemanager-ws-internal';

/**
 * Request CLI execution on the WS server.
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
    console.debug('[ws-bridge] Failed to request CLI execution');
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
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[ws-bridge] Failed to broadcast ${type}`);
    }
  }
}

export function broadcastAgentStatus(agentId: string, status: string, statusMessage?: string): Promise<void> {
  return wsBroadcast('agent:status', { agentId, status, statusMessage });
}

export function broadcastChatMessage(message: {
  id: string; sender: string; content: string; messageType: string; metadata?: unknown;
}): Promise<void> {
  return wsBroadcast('chat:message', message);
}

export function broadcastApprovalRequest(approval: {
  id: string; title: string; content: string; urgency: string; sourceAgent?: string;
}): Promise<void> {
  return wsBroadcast('approval:request', approval);
}

export function broadcastApprovalResolved(id: string, result: string): Promise<void> {
  return wsBroadcast('approval:resolved', { id, result });
}

export function broadcastPartCreated(part: { id: string; name: string; color?: string | null }): Promise<void> {
  return wsBroadcast('part:created', { part });
}

export function broadcastAgentCreated(agent: {
  id: string; name: string; role: string; partId?: string | null;
}): Promise<void> {
  return wsBroadcast('agent:created', { agent });
}

export function broadcastAgentRemoved(agentId: string): Promise<void> {
  return wsBroadcast('agent:removed', { agentId });
}

export function broadcastNotification(notification: {
  id?: number; type: string; title: string; message: string;
}): Promise<void> {
  return wsBroadcast('notification:new', { notification });
}

export function broadcastCostUpdated(summary: {
  totalCost: number; overageLimit: number; overage: number; overageRemaining: number; percentage: number;
}): Promise<void> {
  return wsBroadcast('cost:updated', { summary });
}

export function broadcastLogNew(agentId: string, entry: Record<string, unknown>): Promise<void> {
  return wsBroadcast('log:new', { agentId, entry });
}
