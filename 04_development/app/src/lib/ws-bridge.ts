/**
 * WebSocket Bridge — allows Next.js API routes to communicate with the
 * WebSocket server running in the same process via internal HTTP endpoints.
 *
 * Even though WS server runs in the same Node.js process (via instrumentation.ts),
 * Next.js bundles API routes separately, so direct imports may reference
 * different module instances. HTTP bridging via localhost is reliable and fast.
 */

import { WS_PORT } from './constants';

/**
 * 브리지가 실제로 붙을 WS 서버 포트를 정한다 (순수 함수 — BUG-001a).
 *
 * `process.env.WS_PORT`가 있으면(정수로 파싱 가능하면) 그 값을 최우선으로 쓴다 — 테스트
 * 인스턴스(WS_PORT=3111)에서도 브리지가 같은 프로세스의 WS 서버로 가게 하기 위함이다
 * (DF-013: 이 우선순위가 없어 항상 상수 3001로 나가 테스트 인스턴스 채팅이 무응답이었다).
 * 없거나 파싱할 수 없으면 기존 상수 `WS_PORT`(3001)를 쓴다 — 운영은 `WS_PORT` 환경변수가
 * 그대로 3001이므로 동작이 바뀌지 않는다.
 */
export function resolveBridgePort(envWsPort: string | undefined): number {
  const parsed = envWsPort ? parseInt(envWsPort, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : WS_PORT;
}

/** 브리지가 호출할 내부 HTTP 엔드포인트 URL들을 만든다 (순수 함수 — 테스트 용이). */
export function buildBridgeUrls(port: number): {
  broadcast: string;
  cliExecute: string;
  cliCancel: string;
  queueCancel: string;
} {
  return {
    broadcast: `http://localhost:${port}/_broadcast`,
    cliExecute: `http://localhost:${port}/_cli-execute`,
    cliCancel: `http://localhost:${port}/_cli-cancel`,
    queueCancel: `http://localhost:${port}/_queue-cancel`,
  };
}

const BRIDGE_PORT = resolveBridgePort(process.env.WS_PORT);
const {
  broadcast: WS_BROADCAST_URL,
  cliExecute: WS_CLI_EXECUTE_URL,
  cliCancel: WS_CLI_CANCEL_URL,
  queueCancel: WS_QUEUE_CANCEL_URL,
} = buildBridgeUrls(BRIDGE_PORT);
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
  userMsgId?: string;
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

/** 대기 중인 질문 취소를 WS 서버에 요청한다. */
export async function cancelQueuedViaWs(agentId: string, messageId: string): Promise<boolean> {
  try {
    const res = await fetch(WS_QUEUE_CANCEL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ws-secret': BROADCAST_SECRET },
      body: JSON.stringify({ agentId, messageId }),
    });
    if (!res.ok) return false;
    const j = (await res.json()) as { cancelled?: boolean };
    return Boolean(j.cancelled);
  } catch {
    return false;
  }
}
