/**
 * Note Writer — writes hook events to .orchestrator/ note files (dual storage).
 *
 * Each agent gets a note file at:
 *   $ORCHESTRATOR_DIR/<agentId>/events.log
 *
 * This provides a file-based backup alongside the DB, enabling
 * chokidar-based file watching and offline context recovery.
 */

import fs from 'fs';
import path from 'path';

const ORCHESTRATOR_DIR = process.env.ORCHESTRATOR_DIR
  || process.env.CLAUDEMANAGER_HOME
    ? path.join(process.env.CLAUDEMANAGER_HOME || '', '.orchestrator')
    : path.join(process.cwd(), '.orchestrator');

/**
 * Append a hook event to the agent's note file.
 * Creates the directory structure if needed.
 * Never throws.
 */
export function writeNoteFile(
  agentId: string,
  event: string,
  data?: Record<string, unknown> | null
): void {
  try {
    const agentDir = path.join(ORCHESTRATOR_DIR, agentId);
    if (!fs.existsSync(agentDir)) {
      fs.mkdirSync(agentDir, { recursive: true });
    }

    const logFile = path.join(agentDir, 'events.log');
    const timestamp = new Date().toISOString();
    const entry = JSON.stringify({ timestamp, event, data }) + '\n';

    fs.appendFileSync(logFile, entry, 'utf-8');

    // Also update a status file for quick reads
    const statusFile = path.join(agentDir, 'status.json');
    const statusData = {
      agentId,
      lastEvent: event,
      lastMessage: data?.message || null,
      updatedAt: timestamp,
    };
    fs.writeFileSync(statusFile, JSON.stringify(statusData, null, 2), 'utf-8');
  } catch {
    // Silent failure — DB is the primary store
  }
}

/**
 * Read the latest status from an agent's note file.
 */
export function readNoteStatus(agentId: string): Record<string, unknown> | null {
  try {
    const statusFile = path.join(ORCHESTRATOR_DIR, agentId, 'status.json');
    if (!fs.existsSync(statusFile)) return null;
    const content = fs.readFileSync(statusFile, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}
