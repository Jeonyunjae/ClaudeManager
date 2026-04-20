/**
 * File Watcher — uses chokidar to watch .orchestrator/ for changes
 * and broadcasts updates via WebSocket.
 *
 * Gracefully degrades if chokidar is not installed.
 */

import path from 'path';
import fs from 'fs';

// Broadcast function reference — set by start-ws.ts
let broadcastFn: ((type: string, payload: unknown) => void) | null = null;

export function setWatcherBroadcast(fn: (type: string, payload: unknown) => void): void {
  broadcastFn = fn;
}

const ORCHESTRATOR_DIR = process.env.ORCHESTRATOR_DIR
  || process.env.CLAUDEMANAGER_HOME
    ? path.join(process.env.CLAUDEMANAGER_HOME || '', '.orchestrator')
    : path.join(process.cwd(), '.orchestrator');

let watcherInstance: unknown = null;

/**
 * Start watching the .orchestrator/ directory for file changes.
 * Requires chokidar to be installed; silently no-ops if unavailable.
 */
export async function startFileWatcher(): Promise<void> {
  if (watcherInstance) return;

  // Ensure directory exists
  if (!fs.existsSync(ORCHESTRATOR_DIR)) {
    fs.mkdirSync(ORCHESTRATOR_DIR, { recursive: true });
  }

  try {
    // Dynamic import so the app still works if chokidar is not installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const chokidarModule = 'chokidar';
    const chokidar = await import(/* webpackIgnore: true */ chokidarModule) as {
      watch: (path: string, opts: Record<string, unknown>) => {
        on: (event: string, handler: (path: string) => void) => void;
        close: () => Promise<void>;
      };
    };

    const watcher = chokidar.watch(ORCHESTRATOR_DIR, {
      persistent: true,
      ignoreInitial: true,
      depth: 3,
      // Debounce rapid writes
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });

    watcher.on('change', (filePath: string) => {
      handleFileChange(filePath, 'change');
    });

    watcher.on('add', (filePath: string) => {
      handleFileChange(filePath, 'add');
    });

    watcherInstance = watcher;
    console.log(`[file-watcher] Watching ${ORCHESTRATOR_DIR}`);
  } catch (err) {
    console.warn('[file-watcher] chokidar not available, file watching disabled:', (err as Error).message);
  }
}

/**
 * Stop the file watcher.
 */
export async function stopFileWatcher(): Promise<void> {
  if (watcherInstance && typeof (watcherInstance as { close?: () => Promise<void> }).close === 'function') {
    await (watcherInstance as { close: () => Promise<void> }).close();
    watcherInstance = null;
    console.log('[file-watcher] Stopped');
  }
}

/**
 * Handle a file change event — extract agentId from path and broadcast.
 */
function handleFileChange(filePath: string, changeType: 'change' | 'add'): void {
  try {
    const relative = path.relative(ORCHESTRATOR_DIR, filePath);
    const parts = relative.split(path.sep);

    // Expected structure: <agentId>/<filename>
    if (parts.length < 2) return;

    const agentId = parts[0];
    const fileName = parts.slice(1).join('/');

    // Read file content (for small files only)
    let content: string | null = null;
    try {
      const stats = fs.statSync(filePath);
      // Only read files under 100KB to avoid memory issues
      if (stats.size < 100 * 1024) {
        content = fs.readFileSync(filePath, 'utf-8');
      }
    } catch {
      // File may have been deleted between stat and read
    }

    if (broadcastFn) {
      broadcastFn('note:updated', {
        agentId,
        file: fileName,
        content,
        changeType,
      });
    }
  } catch {
    // Non-critical
  }
}
