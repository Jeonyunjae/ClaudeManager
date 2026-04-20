/**
 * Orchestrator Engine — tmux session management for ClaudeManager agents.
 *
 * Manages the full lifecycle of tmux sessions:
 *   - create / kill / send-keys / list
 *   - Claude Code execution within sessions
 *   - .orchestrator/ folder structure creation
 *
 * All paths use CLAUDEMANAGER_HOME env var (no hardcoding).
 */

import { execSync, execFile } from 'child_process';
import path from 'path';
import fs from 'fs';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CM_HOME = process.env.CLAUDEMANAGER_HOME || path.join(process.env.HOME || '~', '.claudemanager');
const ORCHESTRATOR_DIR = path.join(CM_HOME, '.orchestrator');
const TMUX_PREFIX = 'cm-';
const CLAUDE_CMD = 'claude';
const CLAUDE_FLAGS = '--dangerously-skip-permissions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TmuxSessionInfo = {
  name: string;
  created: string;
  attached: boolean;
  windows: number;
};

export type OrchestratorResult = {
  success: boolean;
  sessionName?: string;
  error?: string;
};

export type AgentRole = 'main' | 'part' | 'sub' | 'instance';

// ---------------------------------------------------------------------------
// Low-level tmux helpers
// ---------------------------------------------------------------------------

function runTmux(args: string[]): string {
  try {
    return execSync(['tmux', ...args].join(' '), {
      encoding: 'utf-8',
      timeout: 10_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // "no server running" is not a real error — just means no sessions
    if (msg.includes('no server running') || msg.includes('no sessions')) {
      return '';
    }
    throw new Error(`tmux command failed: ${msg}`);
  }
}

/**
 * Check whether tmux is available on the system.
 */
export function isTmuxAvailable(): boolean {
  try {
    execSync('which tmux', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Session CRUD
// ---------------------------------------------------------------------------

/**
 * List all ClaudeManager tmux sessions (prefixed with `cm-`).
 */
export function listSessions(): TmuxSessionInfo[] {
  const raw = runTmux([
    'list-sessions',
    '-F',
    '"#{session_name}|#{session_created_string}|#{session_attached}|#{session_windows}"',
  ]);
  if (!raw) return [];

  return raw
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const clean = line.replace(/"/g, '');
      const [name, created, attached, windows] = clean.split('|');
      return { name, created, attached: attached === '1', windows: parseInt(windows, 10) || 1 };
    })
    .filter((s) => s.name.startsWith(TMUX_PREFIX));
}

/**
 * Check if a specific session exists.
 */
export function sessionExists(sessionName: string): boolean {
  try {
    runTmux(['has-session', '-t', sessionName]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Build a deterministic session name for an agent.
 */
export function buildSessionName(role: AgentRole, id: string): string {
  return `${TMUX_PREFIX}${role}-${id.slice(0, 8)}`;
}

/**
 * Create a new tmux session.
 * Returns the session name on success.
 */
export function createSession(sessionName: string, workDir?: string): OrchestratorResult {
  if (sessionExists(sessionName)) {
    return { success: true, sessionName };
  }

  try {
    const args = ['new-session', '-d', '-s', sessionName];
    if (workDir && fs.existsSync(workDir)) {
      args.push('-c', workDir);
    }
    runTmux(args);
    return { success: true, sessionName };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Kill a tmux session.
 */
export function killSession(sessionName: string): OrchestratorResult {
  if (!sessionExists(sessionName)) {
    return { success: true, sessionName };
  }
  try {
    runTmux(['kill-session', '-t', sessionName]);
    return { success: true, sessionName };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Send keys (commands) to a tmux session.
 */
export function sendKeys(sessionName: string, command: string): OrchestratorResult {
  if (!sessionExists(sessionName)) {
    return { success: false, error: `Session ${sessionName} does not exist` };
  }
  try {
    // Escape single quotes in the command
    const escaped = command.replace(/'/g, "'\\''");
    runTmux(['send-keys', '-t', sessionName, `'${escaped}'`, 'Enter']);
    return { success: true, sessionName };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Capture the visible pane content of a session.
 */
export function capturePane(sessionName: string, lines = 200): string {
  if (!sessionExists(sessionName)) return '';
  try {
    return runTmux(['capture-pane', '-t', sessionName, '-p', '-S', `-${lines}`]);
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// .orchestrator/ folder structure
// ---------------------------------------------------------------------------

/**
 * Ensure the base .orchestrator directory exists.
 */
export function ensureOrchestratorDir(): string {
  if (!fs.existsSync(ORCHESTRATOR_DIR)) {
    fs.mkdirSync(ORCHESTRATOR_DIR, { recursive: true });
  }
  return ORCHESTRATOR_DIR;
}

/**
 * Create the standard folder structure for a Part under .orchestrator/.
 */
export function createPartFolderStructure(partId: string, partName: string): string {
  ensureOrchestratorDir();
  const partDir = path.join(ORCHESTRATOR_DIR, partId);

  const dirs = [
    partDir,
    path.join(partDir, 'sub-contexts'),
    path.join(partDir, 'decisions'),
    path.join(partDir, 'progress'),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Create main-context.md
  const contextPath = path.join(partDir, 'main-context.md');
  if (!fs.existsSync(contextPath)) {
    fs.writeFileSync(
      contextPath,
      `# ${partName}\n\n- Part ID: ${partId}\n- Created: ${new Date().toISOString()}\n- Status: active\n`,
      'utf-8'
    );
  }

  return partDir;
}

/**
 * Create sub-context file for a Sub agent.
 */
export function createSubContext(partId: string, subId: string, subName: string): string {
  const subDir = path.join(ORCHESTRATOR_DIR, partId, 'sub-contexts');
  if (!fs.existsSync(subDir)) {
    fs.mkdirSync(subDir, { recursive: true });
  }

  const filePath = path.join(subDir, `${subId}.md`);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(
      filePath,
      `# ${subName}\n\n- Sub ID: ${subId}\n- Part ID: ${partId}\n- Created: ${new Date().toISOString()}\n- Status: active\n`,
      'utf-8'
    );
  }

  return filePath;
}

// ---------------------------------------------------------------------------
// High-level orchestration: Main
// ---------------------------------------------------------------------------

/**
 * Start the Main orchestrator.
 * Creates a tmux session and optionally runs Claude Code inside it.
 */
export function startMain(mainAgentId: string, projectDir?: string): OrchestratorResult {
  const sessionName = buildSessionName('main', mainAgentId);
  const result = createSession(sessionName, projectDir);
  if (!result.success) return result;

  ensureOrchestratorDir();

  // Create main-context.md at orchestrator root
  const mainContextPath = path.join(ORCHESTRATOR_DIR, 'main-context.md');
  if (!fs.existsSync(mainContextPath)) {
    fs.writeFileSync(
      mainContextPath,
      `# Main Orchestrator\n\n- Agent ID: ${mainAgentId}\n- Session: ${sessionName}\n- Started: ${new Date().toISOString()}\n`,
      'utf-8'
    );
  }

  // Launch Claude Code in the session
  const claudeCmd = `${CLAUDE_CMD} ${CLAUDE_FLAGS}`;
  sendKeys(sessionName, claudeCmd);

  return { success: true, sessionName };
}

/**
 * Stop the Main orchestrator.
 */
export function stopMain(mainAgentId: string): OrchestratorResult {
  const sessionName = buildSessionName('main', mainAgentId);
  return killSession(sessionName);
}

// ---------------------------------------------------------------------------
// High-level orchestration: Part
// ---------------------------------------------------------------------------

/**
 * Create a Part agent with its folder structure and tmux session.
 */
export function startPart(
  partId: string,
  partName: string,
  agentId: string,
  projectDir?: string
): OrchestratorResult {
  // Create folder structure
  const partDir = createPartFolderStructure(partId, partName);

  // Create tmux session
  const sessionName = buildSessionName('part', agentId);
  const result = createSession(sessionName, projectDir || partDir);
  if (!result.success) return result;

  return { success: true, sessionName };
}

/**
 * Stop a Part agent.
 */
export function stopPart(agentId: string): OrchestratorResult {
  const sessionName = buildSessionName('part', agentId);
  return killSession(sessionName);
}

// ---------------------------------------------------------------------------
// High-level orchestration: Sub
// ---------------------------------------------------------------------------

/**
 * Start a Sub agent tmux session.
 */
export function startSub(
  partId: string,
  subId: string,
  subName: string,
  agentId: string,
  projectDir?: string
): OrchestratorResult {
  // Create sub context
  createSubContext(partId, subId, subName);

  const sessionName = buildSessionName('sub', agentId);
  const result = createSession(sessionName, projectDir);
  if (!result.success) return result;

  return { success: true, sessionName };
}

/**
 * Stop a Sub agent.
 */
export function stopSub(agentId: string): OrchestratorResult {
  const sessionName = buildSessionName('sub', agentId);
  return killSession(sessionName);
}

/**
 * Restart a Sub agent by killing and recreating its session.
 */
export function restartSub(
  partId: string,
  subId: string,
  subName: string,
  agentId: string,
  projectDir?: string
): OrchestratorResult {
  stopSub(agentId);
  return startSub(partId, subId, subName, agentId, projectDir);
}

// ---------------------------------------------------------------------------
// High-level orchestration: Instance
// ---------------------------------------------------------------------------

/**
 * Start an Instance agent tmux session with Claude Code.
 */
export function startInstance(
  agentId: string,
  projectDir?: string,
  model?: string
): OrchestratorResult {
  const sessionName = buildSessionName('instance', agentId);
  const result = createSession(sessionName, projectDir);
  if (!result.success) return result;

  // Launch Claude Code with optional model flag
  let cmd = `${CLAUDE_CMD} ${CLAUDE_FLAGS}`;
  if (model) {
    cmd += ` --model ${model}`;
  }
  sendKeys(sessionName, cmd);

  return { success: true, sessionName };
}

/**
 * Stop an Instance agent.
 */
export function stopInstance(agentId: string): OrchestratorResult {
  const sessionName = buildSessionName('instance', agentId);
  return killSession(sessionName);
}

// ---------------------------------------------------------------------------
// Hooks integration helper
// ---------------------------------------------------------------------------

/**
 * Generate Claude Code hooks configuration for a project directory.
 * This creates the .claude/settings.json with hooks pointing back to
 * the ClaudeManager API.
 */
export function setupHooks(projectDir: string, agentId: string): void {
  const hooksDir = path.join(projectDir, '.claude');
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  const apiBase = process.env.CLAUDEMANAGER_API_URL || 'http://localhost:3000';
  const hooksSecret = process.env.HOOKS_SECRET || 'claudemanager-hooks-secret';

  const hooksConfig = {
    hooks: {
      PostToolUse: [
        {
          matcher: '.*',
          hooks: [
            {
              type: 'command',
              command: `curl -s -X POST ${apiBase}/api/hooks/event -H "Content-Type: application/json" -H "x-hooks-secret: ${hooksSecret}" -d '{"event":"tool_use","agentId":"${agentId}","data":{"tool":"$TOOL_NAME"}}'`,
            },
          ],
        },
      ],
      Stop: [
        {
          matcher: '.*',
          hooks: [
            {
              type: 'command',
              command: `curl -s -X POST ${apiBase}/api/hooks/event -H "Content-Type: application/json" -H "x-hooks-secret: ${hooksSecret}" -d '{"event":"task_complete","agentId":"${agentId}","data":{"message":"Task completed"}}'`,
            },
          ],
        },
      ],
    },
  };

  const settingsPath = path.join(hooksDir, 'settings.json');
  // Merge with existing settings if present
  let existing: Record<string, unknown> = {};
  if (fs.existsSync(settingsPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    } catch {
      // ignore parse errors
    }
  }

  const merged = { ...existing, ...hooksConfig };
  fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2), 'utf-8');
}
