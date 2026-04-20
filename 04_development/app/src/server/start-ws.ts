/**
 * WebSocket Server Entrypoint — starts the WS server with all event handlers wired.
 *
 * Run with: tsx src/server/start-ws.ts
 */

import { createWSServer, onClientEvent, broadcast, sendToSocket, setCliExecuteHandler, setCliCancelHandler } from './ws-server';
import { processChatInBackground } from './cli-executor';
import { agentManager } from '../lib/agent-manager';
import {
  connectTerminal,
  writeTerminal,
  resizeTerminal,
  disconnectTerminal,
  setOnDataHandler,
  setOnExitHandler,
} from '../lib/terminal-manager';
import { WS_PORT } from '../lib/constants';
import db from '../lib/db';
import { agents, chatMessages } from '../lib/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { startFileWatcher, stopFileWatcher, setWatcherBroadcast } from '../lib/file-watcher';
import { startBackupScheduler, stopBackupScheduler } from '../lib/backup-scheduler';
import { startKeyExpiryChecker, stopKeyExpiryChecker } from '../lib/key-expiry-checker';

// ---------------------------------------------------------------------------
// Terminal event handlers
// ---------------------------------------------------------------------------

// Wire terminal output -> WS broadcast
setOnDataHandler((sessionId, data) => {
  broadcast('terminal:output', { sessionId, data });
});

setOnExitHandler((sessionId) => {
  broadcast('terminal:output', { sessionId, data: '\r\n[Session ended]\r\n' });
});

// ---------------------------------------------------------------------------
// Client -> Server event handlers
// ---------------------------------------------------------------------------

// terminal:connect — attach to an agent's tmux session
onClientEvent('terminal:connect', async (ws, payload) => {
  const { agentId } = payload as { agentId: string };
  if (!agentId) return;

  // Look up the agent's tmux session name
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
  if (!agent?.tmuxSession) {
    sendToSocket(ws, 'terminal:output', {
      sessionId: '',
      data: 'Error: Agent has no tmux session\r\n',
    });
    return;
  }

  const sessionId = connectTerminal(agentId, agent.tmuxSession);
  if (sessionId) {
    sendToSocket(ws, 'terminal:connect', { sessionId, agentId });
  } else {
    sendToSocket(ws, 'terminal:output', {
      sessionId: '',
      data: `Error: Could not attach to tmux session "${agent.tmuxSession}"\r\n`,
    });
  }
});

// terminal:input — write to terminal stdin
onClientEvent('terminal:input', (_ws, payload) => {
  const { sessionId, data } = payload as { sessionId: string; data: string };
  if (sessionId && data) {
    writeTerminal(sessionId, data);
  }
});

// terminal:resize — resize terminal
onClientEvent('terminal:resize', (_ws, payload) => {
  const { sessionId, cols, rows } = payload as { sessionId: string; cols: number; rows: number };
  if (sessionId && cols && rows) {
    resizeTerminal(sessionId, cols, rows);
  }
});

// terminal:disconnect — close terminal session
onClientEvent('terminal:disconnect', (_ws, payload) => {
  const { sessionId } = payload as { sessionId: string };
  if (sessionId) {
    disconnectTerminal(sessionId);
  }
});

// chat:send — save message and relay to Main
onClientEvent('chat:send', async (_ws, payload) => {
  const { content } = payload as { content: string };
  if (!content) return;

  const id = uuidv4();
  await db.insert(chatMessages).values({
    id,
    sender: 'user',
    content,
    messageType: 'text',
  });

  // Broadcast the user message to all clients
  broadcast('chat:message', {
    id,
    sender: 'user',
    content,
    messageType: 'text',
  });
});

// ---------------------------------------------------------------------------
// Wire CLI executor to WS server
// ---------------------------------------------------------------------------

setCliExecuteHandler(processChatInBackground);
setCliCancelHandler((agentId: string) => agentManager.cancelProcess(agentId));

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const port = parseInt(process.env.WS_PORT || String(WS_PORT), 10);
createWSServer(port);

console.log(`[WS] Server started on port ${port}`);
console.log(`[WS] Press Ctrl+C to stop`);

// ---------------------------------------------------------------------------
// Start auxiliary services (GAP-8, GAP-10, GAP-15)
// ---------------------------------------------------------------------------

// GAP-10: File watcher — connect broadcast function and start
setWatcherBroadcast(broadcast);
startFileWatcher().catch((err) => {
  console.warn('[WS] File watcher failed to start:', err);
});

// GAP-8: Backup scheduler
startBackupScheduler();

// GAP-15: Key expiry checker
startKeyExpiryChecker();

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

async function shutdown() {
  console.log('\n[WS] Shutting down...');
  stopBackupScheduler();
  stopKeyExpiryChecker();
  await stopFileWatcher();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
