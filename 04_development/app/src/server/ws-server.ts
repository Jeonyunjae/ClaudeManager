/**
 * WebSocket Server for ClaudeManager — runs on port 3001, separate from Next.js.
 *
 * Supports JWT authentication via query param.
 * Handles all S->C and C->S events defined in the architecture.
 *
 * Usage:
 *   tsx src/server/start-ws.ts          (development)
 *   node dist/server/start-ws.js        (production)
 */

import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import type { IncomingMessage } from 'http';
import { verifyToken } from '../lib/auth';
import { WS_PORT } from '../lib/constants';

function ts() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const BROADCAST_SECRET = process.env.WS_BROADCAST_SECRET || 'claudemanager-ws-internal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WSMessage = {
  type: string;
  payload: unknown;
  timestamp: string;
};

type AuthenticatedSocket = WebSocket & {
  userId?: number;
  isAlive?: boolean;
};

// ---------------------------------------------------------------------------
// Server-to-Client event types
// ---------------------------------------------------------------------------

export const SERVER_EVENTS = [
  'agent:status',
  'agent:message',
  'agent:created',
  'agent:removed',
  'chat:message',
  'chat:typing',
  'chat:stream',
  'approval:request',
  'approval:resolved',
  'project:progress',
  'part:created',
  'notification:new',
  'cost:updated',
  'system:health',
  'system:recovery',
  'note:updated',
  'log:new',
  'terminal:output',
] as const;

// Client-to-Server event types
export const CLIENT_EVENTS = [
  'chat:send',
  'terminal:input',
  'terminal:resize',
  'terminal:connect',
  'terminal:disconnect',
] as const;

// ---------------------------------------------------------------------------
// Client event handlers registry
// ---------------------------------------------------------------------------

type ClientEventHandler = (ws: AuthenticatedSocket, payload: unknown) => void | Promise<void>;
const clientHandlers = new Map<string, ClientEventHandler>();

// CLI execution handler — set by start-ws.ts after importing cli-executor
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CliExecuteHandler = (params: any) => Promise<void>;
type CliCancelHandler = (agentId: string) => boolean;
let cliExecuteHandler: CliExecuteHandler | null = null;
let cliCancelHandler: CliCancelHandler | null = null;
/** 대기 중인 질문 취소 (실행 중인 것은 cliCancelHandler 가 담당) */
type QueueCancelHandler = (agentId: string, messageId: string) => Promise<boolean>;
let queueCancelHandler: QueueCancelHandler | null = null;

/**
 * Register the CLI execution handler (called from start-ws.ts).
 */
export function setCliExecuteHandler(handler: CliExecuteHandler): void {
  cliExecuteHandler = handler;
}

/**
 * Register the CLI cancel handler (called from start-ws.ts).
 */
export function setQueueCancelHandler(handler: QueueCancelHandler): void {
  queueCancelHandler = handler;
}

export function setCliCancelHandler(handler: CliCancelHandler): void {
  cliCancelHandler = handler;
}

/**
 * Register a handler for a client-to-server event.
 */
export function onClientEvent(eventType: string, handler: ClientEventHandler): void {
  clientHandlers.set(eventType, handler);
}

// ---------------------------------------------------------------------------
// WebSocket Server singleton
// ---------------------------------------------------------------------------

let wss: WebSocketServer | null = null;
const clients = new Set<AuthenticatedSocket>();

/**
 * Authenticate a WebSocket connection using the JWT token in query params.
 */
function authenticate(request: IncomingMessage): number | null {
  try {
    const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
    const token = url.searchParams.get('token');
    if (!token) return null;

    const payload = verifyToken(token);
    return payload?.userId ?? null;
  } catch {
    return null;
  }
}

/**
 * Create and start the WebSocket server with an internal HTTP broadcast endpoint.
 */
export function createWSServer(port: number = WS_PORT): WebSocketServer {
  if (wss) return wss;

  // Create an HTTP server that handles both WebSocket upgrades and the /_broadcast endpoint
  const httpServer = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/_broadcast') {
      const secret = req.headers['x-ws-secret'];
      if (secret !== BROADCAST_SECRET) {
        res.writeHead(401);
        res.end('Unauthorized');
        return;
      }

      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const { type, payload } = JSON.parse(body);
          if (type) {
            broadcast(type, payload);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.writeHead(400);
          res.end('Bad Request');
        }
      });
      return;
    }

    // CLI execution endpoint — receives requests from Next.js to run CLI in this process
    if (req.method === 'POST' && req.url === '/_cli-execute') {
      const secret = req.headers['x-ws-secret'];
      if (secret !== BROADCAST_SECRET) {
        res.writeHead(401);
        res.end('Unauthorized');
        return;
      }

      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const params = JSON.parse(body);
          // Return 200 immediately, then run CLI in background
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));

          // Fire-and-forget: import and run cli-executor
          if (cliExecuteHandler) {
            cliExecuteHandler(params).catch((err: unknown) => {
              console.error(`[${ts()}] [WS] CLI execution error:`, err);
            });
          } else {
            console.error(`[${ts()}] [WS] CLI execute handler not registered`);
          }
        } catch {
          res.writeHead(400);
          res.end('Bad Request');
        }
      });
      return;
    }

    // 대기열 취소 — 아직 실행 전인 질문을 큐에서 뺀다
    if (req.method === 'POST' && req.url === '/_queue-cancel') {
      const secret = req.headers['x-ws-secret'];
      if (secret !== BROADCAST_SECRET) {
        res.writeHead(401);
        res.end('Unauthorized');
        return;
      }
      let qbody = '';
      req.on('data', (chunk) => { qbody += chunk; });
      req.on('end', async () => {
        try {
          const { agentId, messageId } = JSON.parse(qbody);
          const cancelled = queueCancelHandler
            ? await queueCancelHandler(agentId, messageId)
            : false;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, cancelled }));
        } catch {
          res.writeHead(400);
          res.end('Bad Request');
        }
      });
      return;
    }

    // CLI cancel endpoint — kills a running CLI process
    if (req.method === 'POST' && req.url === '/_cli-cancel') {
      const secret = req.headers['x-ws-secret'];
      if (secret !== BROADCAST_SECRET) {
        res.writeHead(401);
        res.end('Unauthorized');
        return;
      }

      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const { agentId } = JSON.parse(body);
          if (cliCancelHandler) {
            const cancelled = cliCancelHandler(agentId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, cancelled }));
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'No cancel handler' }));
          }
        } catch {
          res.writeHead(400);
          res.end('Bad Request');
        }
      });
      return;
    }

    // Health check
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', clients: clients.size }));
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: AuthenticatedSocket, request: IncomingMessage) => {
    const userId = authenticate(request);
    if (userId === null) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    ws.userId = userId;
    ws.isAlive = true;
    clients.add(ws);

    console.log(`[${ts()}] [WS] Client connected (userId: ${userId}). Total: ${clients.size}`);

    ws.on('message', (raw) => {
      try {
        const message: WSMessage = JSON.parse(raw.toString());
        const handler = clientHandlers.get(message.type);
        if (handler) {
          Promise.resolve(handler(ws, message.payload)).catch((err) => {
            console.error(`[WS] Handler error for event ${message.type}:`, err);
          });
        } else {
          console.warn(`[WS] No handler for event: ${message.type}`);
        }
      } catch (err) {
        console.error('[WS] Failed to parse message:', err);
      }
    });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[${ts()}] [WS] Client disconnected. Total: ${clients.size}`);
    });

    ws.on('error', (err) => {
      console.error('[WS] Socket error:', err.message);
      clients.delete(ws);
    });
  });

  // Heartbeat: ping every 30s, terminate dead connections
  const heartbeatInterval = setInterval(() => {
    clients.forEach((ws) => {
      if (!ws.isAlive) {
        clients.delete(ws);
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30_000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  httpServer.listen(port, () => {
    console.log(`[WS] WebSocket server listening on port ${port}`);
    console.log(`[WS] Internal broadcast endpoint: http://localhost:${port}/_broadcast`);
  });

  return wss;
}

// ---------------------------------------------------------------------------
// Broadcast functions (called by API routes)
// ---------------------------------------------------------------------------

/**
 * Send a message to all connected clients.
 */
export function broadcast(type: string, payload: unknown): void {
  const message: WSMessage = {
    type,
    payload,
    timestamp: new Date().toISOString(),
  };
  const data = JSON.stringify(message);

  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });
}

/**
 * Send a message to a specific client by userId.
 */
export function sendToUser(userId: number, type: string, payload: unknown): void {
  const message: WSMessage = {
    type,
    payload,
    timestamp: new Date().toISOString(),
  };
  const data = JSON.stringify(message);

  clients.forEach((ws) => {
    if (ws.userId === userId && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });
}

/**
 * Send a message to a specific WebSocket connection.
 */
export function sendToSocket(ws: WebSocket, type: string, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    const message: WSMessage = {
      type,
      payload,
      timestamp: new Date().toISOString(),
    };
    ws.send(JSON.stringify(message));
  }
}

/**
 * Get the count of connected clients.
 */
export function getClientCount(): number {
  return clients.size;
}

/**
 * Shut down the WebSocket server gracefully.
 */
export function shutdownWSServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!wss) {
      resolve();
      return;
    }
    clients.forEach((ws) => ws.terminate());
    clients.clear();
    wss.close(() => {
      wss = null;
      resolve();
    });
  });
}
