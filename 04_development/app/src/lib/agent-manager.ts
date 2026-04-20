/**
 * Agent Manager — manages Claude Code CLI agent sessions.
 *
 * Session persistence via DB:
 *   - session_id is saved to agents.cli_session_id in DB
 *   - On server restart, loads session_id from DB and resumes with --resume
 *   - CLI session files are on disk (~/.claude/), so context survives reboots
 */

import { spawn } from 'child_process';
import { EventEmitter } from 'events';

export interface CLIResult {
  type: string;
  subtype?: string;
  result: string;
  session_id: string;
  total_cost_usd?: number;
  duration_ms?: number;
  is_error?: boolean;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

export interface CLILogEntry {
  timestamp: string;
  command: string;
  prompt: string;
  response: string;
  costUsd: number;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  isError: boolean;
}

export interface AgentSession {
  agentId: string;
  sessionId: string | null;
  status: 'active' | 'idle' | 'error';
  startedAt: Date;
  lastActivity: Date;
  systemPrompt?: string;
  messageCount: number;
  cliLogs: CLILogEntry[];
  activeProcess?: import('child_process').ChildProcess;
}

// Callback to persist session_id to DB (injected from outside to avoid circular imports)
type SessionPersister = (agentId: string, sessionId: string) => void | Promise<void>;

class AgentManager extends EventEmitter {
  private sessions: Map<string, AgentSession> = new Map();
  private sessionPersister: SessionPersister | null = null;

  /**
   * Set the callback that saves session_id to DB.
   */
  setSessionPersister(fn: SessionPersister): void {
    this.sessionPersister = fn;
  }

  private persistSession(agentId: string, sessionId: string): void {
    if (this.sessionPersister) {
      // Fire-and-forget: catch errors to prevent unhandled rejections from async persisters
      Promise.resolve(this.sessionPersister(agentId, sessionId)).catch((err) => {
        console.error('[AgentManager] Failed to persist session:', err);
      });
    }
  }

  /**
   * Resume an agent from an existing session_id (loaded from DB).
   */
  resumeAgent(agentId: string, sessionId: string, systemPrompt?: string): AgentSession {
    const session: AgentSession = {
      agentId,
      sessionId,
      status: 'idle',
      startedAt: new Date(),
      lastActivity: new Date(),
      systemPrompt,
      messageCount: 0,
      cliLogs: [],
    };
    this.sessions.set(agentId, session);
    console.log(`[AgentManager] Agent ${agentId} resumed with session ${sessionId}`);
    return session;
  }

  /**
   * Initialize a new agent session. Sends init message to get a session_id.
   */
  async initAgent(agentId: string, systemPrompt?: string): Promise<AgentSession> {
    const session: AgentSession = {
      agentId,
      sessionId: null,
      status: 'active',
      startedAt: new Date(),
      lastActivity: new Date(),
      systemPrompt,
      messageCount: 0,
      cliLogs: [],
    };

    const result = await this.execCLI({
      prompt: 'You have been initialized. Reply with: "Ready."',
      systemPrompt,
    });

    session.sessionId = result.session_id;
    session.messageCount = 1;
    session.cliLogs.push({
      timestamp: new Date().toISOString(),
      command: `claude --print -p "init"`,
      prompt: '(initialization)',
      response: result.result,
      costUsd: result.total_cost_usd || 0,
      durationMs: result.duration_ms || 0,
      inputTokens: result.usage?.input_tokens || 0,
      outputTokens: result.usage?.output_tokens || 0,
      isError: false,
    });
    this.sessions.set(agentId, session);
    this.persistSession(agentId, result.session_id);
    this.emit('agent:started', agentId);

    console.log(`[AgentManager] Agent ${agentId} initialized with session ${result.session_id}`);
    return session;
  }

  /**
   * Send a message to an agent and get the response.
   */
  async sendMessage(agentId: string, content: string, systemPrompt?: string, modelName?: string): Promise<{ text: string; costUsd: number; inputTokens: number; outputTokens: number; durationMs: number; modelName: string }> {
    let session = this.sessions.get(agentId);

    if (!session || !session.sessionId) {
      session = await this.initAgent(agentId, systemPrompt);
    }

    session.status = 'active';
    session.lastActivity = new Date();
    this.emit('agent:stream', agentId, { type: 'system', content: 'Processing...' });

    const model = modelName || 'sonnet';

    try {
      const result = await this.execCLI({
        prompt: content,
        resumeSessionId: session.sessionId!,
        model,
      });

      session.sessionId = result.session_id;
      session.messageCount++;
      session.status = 'idle';
      session.lastActivity = new Date();
      session.cliLogs.push({
        timestamp: new Date().toISOString(),
        command: `claude --resume ${session.sessionId?.substring(0, 8)}... -p "${content.substring(0, 40)}..."`,
        prompt: content,
        response: result.result,
        costUsd: result.total_cost_usd || 0,
        durationMs: result.duration_ms || 0,
        inputTokens: result.usage?.input_tokens || 0,
        outputTokens: result.usage?.output_tokens || 0,
        isError: false,
      });

      // Persist updated session_id
      this.persistSession(agentId, result.session_id);

      this.emit('agent:response', agentId, result.result);
      return {
        text: result.result,
        costUsd: result.total_cost_usd || 0,
        inputTokens: result.usage?.input_tokens || 0,
        outputTokens: result.usage?.output_tokens || 0,
        durationMs: result.duration_ms || 0,
        modelName: model,
      };
    } catch (err) {
      session.status = 'error';
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      session.cliLogs.push({
        timestamp: new Date().toISOString(),
        command: `claude --resume ${session.sessionId?.substring(0, 8)}... -p "${content.substring(0, 40)}..."`,
        prompt: content,
        response: errorMsg,
        costUsd: 0,
        durationMs: 0,
        inputTokens: 0,
        outputTokens: 0,
        isError: true,
      });
      this.emit('agent:error', agentId, errorMsg);
      throw err;
    }
  }

  /**
   * Execute a Claude CLI command and parse JSON result.
   */
  private execCLI(options: {
    prompt: string;
    systemPrompt?: string;
    resumeSessionId?: string;
    model?: string;
  }): Promise<CLIResult> {
    return new Promise((resolve, reject) => {
      const projectRoot = process.env.PROJECT_ROOT || '';
      const model = options.model || 'sonnet';
      const args = ['--print', '--output-format', 'json', '--permission-mode', 'bypassPermissions', '--model', model];

      if (projectRoot) {
        args.push('--add-dir', projectRoot);
      }

      if (options.systemPrompt) {
        args.push('--system-prompt', options.systemPrompt);
      }

      if (options.resumeSessionId) {
        args.push('--resume', options.resumeSessionId);
      }

      args.push('-p', options.prompt);

      const proc = spawn('claude', args, {
        cwd: process.cwd(),
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // Track active process for cancellation
      const agentId = options.resumeSessionId
        ? Array.from(this.sessions.entries()).find(([, s]) => s.sessionId === options.resumeSessionId)?.[0]
        : undefined;
      if (agentId) {
        const session = this.sessions.get(agentId);
        if (session) session.activeProcess = proc;
      }

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        // Clear active process reference
        if (agentId) {
          const session = this.sessions.get(agentId);
          if (session) session.activeProcess = undefined;
        }

        if (code !== 0) {
          reject(new Error(`CLI exited with code ${code}: ${stderr || stdout}`));
          return;
        }

        try {
          const result = JSON.parse(stdout.trim()) as CLIResult;
          if (result.is_error) {
            reject(new Error(result.result || 'CLI returned error'));
            return;
          }
          resolve(result);
        } catch {
          reject(new Error(`Failed to parse CLI output: ${stdout.substring(0, 200)}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn CLI: ${err.message}`));
      });
    });
  }

  /**
   * Cancel a running CLI process for an agent.
   */
  cancelProcess(agentId: string): boolean {
    const session = this.sessions.get(agentId);
    if (!session?.activeProcess) return false;
    session.activeProcess.kill('SIGTERM');
    session.activeProcess = undefined;
    session.status = 'idle';
    return true;
  }

  isRunning(agentId: string): boolean {
    const session = this.sessions.get(agentId);
    return !!session && !!session.sessionId;
  }

  getAgent(agentId: string): AgentSession | undefined {
    return this.sessions.get(agentId);
  }

  getRunningAgents(): AgentSession[] {
    return Array.from(this.sessions.values());
  }

  getRunningCount(): number {
    return this.sessions.size;
  }

  getCLILogs(agentId: string): CLILogEntry[] {
    return this.sessions.get(agentId)?.cliLogs || [];
  }

  stopAgent(agentId: string): boolean {
    const existed = this.sessions.delete(agentId);
    if (existed) {
      this.emit('agent:exit', agentId, 0);
    }
    return existed;
  }

  stopAll(): void {
    for (const [agentId] of this.sessions) {
      this.stopAgent(agentId);
    }
  }
}

export const agentManager = new AgentManager();
