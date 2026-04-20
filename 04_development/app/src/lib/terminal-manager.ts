/**
 * Terminal Manager — PTY-based terminal management for ClaudeManager.
 *
 * Provides PTY allocation for attaching to agent tmux sessions.
 * Integrates with the WebSocket server for bidirectional terminal I/O.
 *
 * Graceful fallback: if node-pty is not available (native module build failure),
 * falls back to a child_process-based approach.
 */

import { ChildProcess, spawn } from 'child_process';
import { sessionExists } from './orchestrator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TerminalSession = {
  id: string;
  agentId: string;
  tmuxSession: string;
  process: ChildProcess | IPty;
  cols: number;
  rows: number;
  createdAt: Date;
};

type IPty = {
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
  onData: (callback: (data: string) => void) => void;
  onExit: (callback: (code: { exitCode: number }) => void) => void;
  pid: number;
};

type OnDataCallback = (sessionId: string, data: string) => void;
type OnExitCallback = (sessionId: string) => void;

// ---------------------------------------------------------------------------
// Terminal session registry
// ---------------------------------------------------------------------------

const sessions = new Map<string, TerminalSession>();
let onDataHandler: OnDataCallback | null = null;
let onExitHandler: OnExitCallback | null = null;

// Try to load node-pty; fall back gracefully
let nodePty: {
  spawn: (
    file: string,
    args: string[],
    options: { name?: string; cols?: number; rows?: number; cwd?: string; env?: Record<string, string> }
  ) => IPty;
} | null = null;

try {
  // node-pty is an optional native dependency
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  nodePty = require('node-pty');
} catch {
  console.warn('[Terminal] node-pty not available, using fallback child_process mode');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register the callback for terminal data output (terminal:output).
 */
export function setOnDataHandler(handler: OnDataCallback): void {
  onDataHandler = handler;
}

/**
 * Register the callback for terminal session exit.
 */
export function setOnExitHandler(handler: OnExitCallback): void {
  onExitHandler = handler;
}

/**
 * Connect to an agent's tmux session.
 * Creates a PTY that runs `tmux attach-session -t <sessionName>`.
 */
export function connectTerminal(
  agentId: string,
  tmuxSessionName: string,
  cols = 80,
  rows = 24
): string | null {
  // Check if tmux session exists
  if (!sessionExists(tmuxSessionName)) {
    console.error(`[Terminal] tmux session not found: ${tmuxSessionName}`);
    return null;
  }

  // Generate a session ID
  const sessionId = `term-${agentId}-${Date.now()}`;

  // Check for existing session for this agent
  for (const [existingId, session] of sessions.entries()) {
    if (session.agentId === agentId) {
      disconnectTerminal(existingId);
    }
  }

  if (nodePty) {
    return connectWithNodePty(sessionId, agentId, tmuxSessionName, cols, rows);
  } else {
    return connectWithChildProcess(sessionId, agentId, tmuxSessionName, cols, rows);
  }
}

/**
 * Write data to a terminal session (stdin).
 */
export function writeTerminal(sessionId: string, data: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;

  if ('write' in session.process && typeof session.process.write === 'function') {
    session.process.write(data);
  } else if ('stdin' in session.process && session.process.stdin) {
    (session.process as ChildProcess).stdin?.write(data);
  }

  return true;
}

/**
 * Resize a terminal session.
 */
export function resizeTerminal(sessionId: string, cols: number, rows: number): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;

  session.cols = cols;
  session.rows = rows;

  if ('resize' in session.process && typeof session.process.resize === 'function') {
    (session.process as IPty).resize(cols, rows);
  }

  return true;
}

/**
 * Disconnect a terminal session.
 */
export function disconnectTerminal(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;

  try {
    if ('kill' in session.process) {
      if (typeof (session.process as IPty).kill === 'function' && 'pid' in session.process) {
        (session.process as IPty).kill();
      } else {
        (session.process as ChildProcess).kill('SIGTERM');
      }
    }
  } catch {
    // ignore kill errors
  }

  sessions.delete(sessionId);
  return true;
}

/**
 * Disconnect all terminal sessions.
 */
export function disconnectAll(): void {
  for (const sessionId of sessions.keys()) {
    disconnectTerminal(sessionId);
  }
}

/**
 * Get info about an active terminal session.
 */
export function getSession(sessionId: string): TerminalSession | undefined {
  return sessions.get(sessionId);
}

/**
 * Get all active terminal session IDs.
 */
export function getActiveSessions(): string[] {
  return Array.from(sessions.keys());
}

/**
 * Check if node-pty is available.
 */
export function isNodePtyAvailable(): boolean {
  return nodePty !== null;
}

// ---------------------------------------------------------------------------
// Implementation: node-pty
// ---------------------------------------------------------------------------

function connectWithNodePty(
  sessionId: string,
  agentId: string,
  tmuxSessionName: string,
  cols: number,
  rows: number
): string {
  const pty = nodePty!.spawn('tmux', ['attach-session', '-t', tmuxSessionName], {
    name: 'xterm-256color',
    cols,
    rows,
    env: process.env as Record<string, string>,
  });

  const session: TerminalSession = {
    id: sessionId,
    agentId,
    tmuxSession: tmuxSessionName,
    process: pty,
    cols,
    rows,
    createdAt: new Date(),
  };

  sessions.set(sessionId, session);

  pty.onData((data: string) => {
    onDataHandler?.(sessionId, data);
  });

  pty.onExit(() => {
    sessions.delete(sessionId);
    onExitHandler?.(sessionId);
  });

  return sessionId;
}

// ---------------------------------------------------------------------------
// Implementation: child_process fallback
// ---------------------------------------------------------------------------

function connectWithChildProcess(
  sessionId: string,
  agentId: string,
  tmuxSessionName: string,
  cols: number,
  rows: number
): string {
  const env = { ...process.env, COLUMNS: String(cols), LINES: String(rows) };

  const child = spawn('tmux', ['attach-session', '-t', tmuxSessionName], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
  });

  const session: TerminalSession = {
    id: sessionId,
    agentId,
    tmuxSession: tmuxSessionName,
    process: child,
    cols,
    rows,
    createdAt: new Date(),
  };

  sessions.set(sessionId, session);

  child.stdout?.on('data', (data: Buffer) => {
    onDataHandler?.(sessionId, data.toString());
  });

  child.stderr?.on('data', (data: Buffer) => {
    onDataHandler?.(sessionId, data.toString());
  });

  child.on('exit', () => {
    sessions.delete(sessionId);
    onExitHandler?.(sessionId);
  });

  child.on('error', (err) => {
    console.error(`[Terminal] Process error for ${sessionId}:`, err.message);
    sessions.delete(sessionId);
    onExitHandler?.(sessionId);
  });

  return sessionId;
}
