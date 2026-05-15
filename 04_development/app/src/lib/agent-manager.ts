/**
 * Agent Manager — manages Claude Code CLI agent sessions.
 *
 * Session persistence via DB:
 *   - session_id is saved to agents.cli_session_id in DB
 *   - On server restart, loads session_id from DB and continues with --continue
 *   - CLI session files are on disk (~/.claude/), so context survives reboots
 */

import { spawn } from 'child_process';
import { EventEmitter } from 'events';

function ts() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

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
  projectRoot?: string;
  messageCount: number;
  cliLogs: CLILogEntry[];
  activeProcess?: import('child_process').ChildProcess;
}

// Callback to persist session_id to DB (injected from outside to avoid circular imports)
type SessionPersister = (agentId: string, sessionId: string) => void | Promise<void>;
type SessionLoader = (agentId: string) => Promise<{ sessionId: string | null; projectRoot: string | null }>;

class AgentManager extends EventEmitter {
  private sessions: Map<string, AgentSession> = new Map();
  private sessionPersister: SessionPersister | null = null;
  private sessionLoader: SessionLoader | null = null;

  /**
   * Set the callback that saves session_id to DB.
   */
  setSessionPersister(fn: SessionPersister): void {
    this.sessionPersister = fn;
  }

  /**
   * Set the callback that loads session_id from DB.
   */
  setSessionLoader(fn: SessionLoader): void {
    this.sessionLoader = fn;
  }

  private persistSession(agentId: string, sessionId: string): void {
    if (this.sessionPersister) {
      // Fire-and-forget: catch errors to prevent unhandled rejections from async persisters
      Promise.resolve(this.sessionPersister(agentId, sessionId)).catch((err) => {
        console.error(`[${ts()}] [AgentManager] Failed to persist session:`, err);
      });
    }
  }

  /**
   * Resume an agent from an existing session_id (loaded from DB).
   */
  resumeAgent(agentId: string, sessionId: string, systemPrompt?: string, projectRoot?: string): AgentSession {
    const session: AgentSession = {
      agentId,
      sessionId,
      status: 'idle',
      startedAt: new Date(),
      lastActivity: new Date(),
      systemPrompt,
      projectRoot,
      messageCount: 0,
      cliLogs: [],
    };
    this.sessions.set(agentId, session);
    console.log(`[${ts()}] [AgentManager] Agent "${agentId}" resumed (session: ${sessionId.substring(0, 8)}…)`);
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

    console.log(`[${ts()}] [AgentManager] Agent "${agentId}" initialized (session: ${result.session_id.substring(0, 8)}…)`);
    return session;
  }

  /**
   * Send a message to an agent and get the response (streaming).
   */
  async sendMessage(agentId: string, content: string, systemPrompt?: string, modelName?: string, onStream?: (text: string) => void): Promise<{ text: string; costUsd: number; inputTokens: number; outputTokens: number; durationMs: number; modelName: string }> {
    let session = this.sessions.get(agentId);
    let projectRoot: string | undefined;

    if (!session || !session.sessionId) {
      if (this.sessionLoader) {
        const stored = await this.sessionLoader(agentId);
        if (stored.sessionId) {
          session = this.resumeAgent(agentId, stored.sessionId, systemPrompt, stored.projectRoot || undefined);
        }
        projectRoot = stored.projectRoot || undefined;
      }
      if (!session || !session.sessionId) {
        session = {
          agentId,
          sessionId: null,
          status: 'active',
          startedAt: new Date(),
          lastActivity: new Date(),
          systemPrompt,
          projectRoot,
          messageCount: 0,
          cliLogs: [],
        };
        this.sessions.set(agentId, session);
      }
    }

    session.status = 'active';
    session.lastActivity = new Date();

    const model = modelName || 'sonnet';

    try {
      const result = await this.execCLI({
        prompt: content,
        systemPrompt,
        resumeSessionId: session.sessionId || undefined,
        projectRoot: session.projectRoot,
        model,
        onStream,
      });

      session.sessionId = result.session_id;
      session.messageCount++;
      session.status = 'idle';
      session.lastActivity = new Date();
      session.cliLogs.push({
        timestamp: new Date().toISOString(),
        command: `claude --continue ${session.sessionId?.substring(0, 8)}... -p "${content.substring(0, 40)}..."`,
        prompt: content,
        response: result.result,
        costUsd: result.total_cost_usd || 0,
        durationMs: result.duration_ms || 0,
        inputTokens: result.usage?.input_tokens || 0,
        outputTokens: result.usage?.output_tokens || 0,
        isError: false,
      });

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
        command: `claude --continue ${session.sessionId?.substring(0, 8)}... -p "${content.substring(0, 40)}..."`,
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
   * Execute a Claude CLI command with stream-json output.
   */
  private execCLI(options: {
    prompt: string;
    systemPrompt?: string;
    resumeSessionId?: string;
    projectRoot?: string;
    model?: string;
    onStream?: (text: string) => void;
  }): Promise<CLIResult> {
    return new Promise((resolve, reject) => {
      const agentProjectRoot = options.projectRoot || process.env.PROJECT_ROOT || '';
      const model = options.model || 'sonnet';
      const args = ['--print', '--verbose', '--output-format', 'stream-json', '--permission-mode', 'bypassPermissions', '--model', model];

      if (agentProjectRoot) {
        args.push('--add-dir', agentProjectRoot);
      }

      if (options.resumeSessionId) {
        args.push('--continue', options.resumeSessionId);
      } else if (options.systemPrompt) {
        args.push('--system-prompt', options.systemPrompt);
      }

      args.push('-p', options.prompt);

      console.log(`[${ts()}] [AgentManager] execCLI args: resume=${options.resumeSessionId || 'NEW'}, model=${model}, prompt_len=${options.prompt.length}, system_len=${options.systemPrompt?.length || 0}`);

      // Each agent gets an isolated temp CWD to prevent session contamination
      // from parent Claude Code sessions sharing the same project directory.
      const agentId2 = options.resumeSessionId
        ? Array.from(this.sessions.entries()).find(([, s]) => s.sessionId === options.resumeSessionId)?.[0]
        : Array.from(this.sessions.entries()).find(([, s]) => !s.sessionId)?.[0];
      const isolatedCwd = `/tmp/cm-agent-${agentId2 || 'unknown'}`;
      require('fs').mkdirSync(isolatedCwd, { recursive: true });

      const cleanEnv = { ...process.env };
      delete cleanEnv.CLAUDECODE;
      delete cleanEnv.AI_AGENT;
      delete cleanEnv.CLAUDE_CODE_ENTRYPOINT;
      delete cleanEnv.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
      delete cleanEnv.CLAUDE_CODE_EXECPATH;
      const proc = spawn('claude', args, {
        cwd: isolatedCwd,
        env: cleanEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const agentId = options.resumeSessionId
        ? Array.from(this.sessions.entries()).find(([, s]) => s.sessionId === options.resumeSessionId)?.[0]
        : undefined;
      if (agentId) {
        const session = this.sessions.get(agentId);
        if (session) session.activeProcess = proc;
      }

      let stderr = '';
      let lastResult: CLIResult | null = null;
      let lineBuf = '';

      proc.stdout?.on('data', (data: Buffer) => {
        lineBuf += data.toString();
        const lines = lineBuf.split('\n');
        lineBuf = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const event = JSON.parse(trimmed);
            if (event.type === 'assistant' && event.subtype === 'text') {
              if (options.onStream && event.content) {
                options.onStream(event.content);
              }
            } else if (event.type === 'result') {
              lastResult = event as CLIResult;
            }
          } catch {
            // partial JSON line, ignore
          }
        }
      });

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (agentId) {
          const session = this.sessions.get(agentId);
          if (session) session.activeProcess = undefined;
        }

        // Process remaining buffer
        if (lineBuf.trim()) {
          try {
            const event = JSON.parse(lineBuf.trim());
            if (event.type === 'result') {
              lastResult = event as CLIResult;
            }
          } catch {
            // ignore
          }
        }

        if (code !== 0 && !lastResult) {
          reject(new Error(`CLI exited with code ${code}: ${stderr}`));
          return;
        }

        if (lastResult) {
          if (lastResult.is_error) {
            const errDetail = lastResult.result || stderr || 'CLI returned error';
            console.error(`[${ts()}] [AgentManager] CLI error: ${errDetail}`);
            reject(new Error(errDetail));
            return;
          }
          console.log(`[${ts()}] [AgentManager] CLI result — session_id: ${lastResult.session_id}, result_len: ${lastResult.result?.length}, result_preview: ${lastResult.result?.substring(0, 80)}`);
          resolve(lastResult);
        } else {
          reject(new Error(`No result event received from CLI`));
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
