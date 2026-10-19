/**
 * Sub가 띄우는 Instance(하위 에이전트) 기록 (BUG-034, Main M-104).
 *
 * Sub는 Claude Code의 Agent(구 Task) 도구로 Instance를 띄운다. 이 실행은 DB에 남지 않아
 * 대시보드 Instance 열이 늘 비어 있었다. CLI stream-json에는 Agent 도구 호출(tool_use)과
 * 그 결과(tool_result)가 오므로, 호출 순간 agents에 role='instance' 행을 만들고 결과가 오면 끝낸다.
 *
 * 저장·방송은 주입받는다 — 단위 테스트에서 DB 없이 검증한다.
 */

export const INSTANCE_TOOL_NAMES = new Set(['Agent', 'Task']);

export type InstanceRow = {
  id: string;
  name: string;
  role: 'instance';
  status: 'active' | 'idle' | 'error' | 'stopped';
  parentId: string;
  partId: string | null;
  modelName: string | null;
  taskType: string | null;
  statusMessage: string;
  startedAt: string;
  stoppedAt: string | null;
};

export type InstanceStore = {
  insert: (row: InstanceRow) => Promise<void>;
  update: (id: string, fields: Partial<Pick<InstanceRow, 'status' | 'statusMessage' | 'stoppedAt'>>) => Promise<void>;
};

export type InstanceBroadcast = (event: 'agent:created' | 'agent:status', payload: Record<string, unknown>) => void;

type AgentToolInput = {
  description?: unknown;
  subagent_type?: unknown;
  model?: unknown;
  prompt?: unknown;
};

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** 화면에 보일 한 줄 (하는 일) */
export function instanceSummary(input: AgentToolInput): string {
  const text = str(input.description) ?? str(input.prompt) ?? '';
  const oneLine = text.replace(/\s+/g, ' ');
  return oneLine.length > 60 ? oneLine.slice(0, 60) + '…' : oneLine;
}

/** Instance 이름 = 에이전트 유형 (devils-advocate, general-purpose …) */
export function instanceName(input: AgentToolInput): string {
  return str(input.subagent_type) ?? 'general-purpose';
}

/** Agent 도구의 model 값('opus'·'sonnet'·'haiku'·'inherit'/없음) → 저장할 모델 이름 */
export function instanceModel(input: AgentToolInput, parentModel: string | null | undefined): string | null {
  const m = str(input.model);
  if (m && m !== 'inherit') return m;
  return parentModel ?? null;
}

export class InstanceTracker {
  /** tool_use id → instance id (이번 Sub 실행 동안만) */
  private readonly running = new Map<string, string>();

  constructor(
    private readonly sub: { id: string; partId: string | null; modelName: string | null },
    private readonly deps: {
      store: InstanceStore;
      broadcast: InstanceBroadcast;
      newId: () => string;
      now?: () => Date;
      log?: (msg: string) => void;
    }
  ) {}

  private nowIso(): string {
    return (this.deps.now ? this.deps.now() : new Date()).toISOString();
  }

  /** Sub 스트림의 tool_use. Agent 도구이고 Sub 자신이 부른 것(Instance 안의 도구가 아님)만 기록한다 */
  async onToolUse(tool: { name?: string; input?: unknown; id?: string; parentToolUseId?: string | null }): Promise<void> {
    if (!tool.name || !INSTANCE_TOOL_NAMES.has(tool.name) || !tool.id || tool.parentToolUseId) return;
    if (this.running.has(tool.id)) return;
    const input = (tool.input && typeof tool.input === 'object' ? tool.input : {}) as AgentToolInput;
    const row: InstanceRow = {
      id: this.deps.newId(),
      name: instanceName(input),
      role: 'instance',
      status: 'active',
      parentId: this.sub.id,
      partId: this.sub.partId,
      modelName: instanceModel(input, this.sub.modelName),
      taskType: str(input.subagent_type) ?? null,
      statusMessage: instanceSummary(input),
      startedAt: this.nowIso(),
      stoppedAt: null,
    };
    this.running.set(tool.id, row.id);
    try {
      await this.deps.store.insert(row);
      this.deps.broadcast('agent:created', {
        parentId: row.parentId,
        agent: {
          id: row.id, name: row.name, role: 'instance', status: 'active', statusMessage: row.statusMessage,
          partId: row.partId ?? undefined, modelName: row.modelName ?? undefined, startedAt: row.startedAt, children: [],
        },
      });
    } catch (e) {
      this.deps.log?.(`[instance] 기록 실패: ${String(e)}`);
    }
  }

  /** Sub 스트림의 tool_result. 기록 중인 Instance면 끝낸다 */
  async onToolResult(result: { toolUseId: string; isError: boolean; parentToolUseId?: string | null }): Promise<void> {
    if (result.parentToolUseId) return;
    const id = this.running.get(result.toolUseId);
    if (!id) return;
    this.running.delete(result.toolUseId);
    await this.finish(id, result.isError ? 'error' : 'idle');
  }

  /** Sub 실행이 끝났는데 결과가 오지 않은 Instance — 실패면 error, 아니면 중단으로 닫는다 */
  async finishAll(failed: boolean): Promise<void> {
    const ids = [...this.running.values()];
    this.running.clear();
    for (const id of ids) await this.finish(id, failed ? 'error' : 'stopped');
  }

  get activeCount(): number {
    return this.running.size;
  }

  private async finish(id: string, status: 'idle' | 'error' | 'stopped'): Promise<void> {
    const stoppedAt = this.nowIso();
    try {
      await this.deps.store.update(id, { status, stoppedAt });
      this.deps.broadcast('agent:status', { agentId: id, status, stoppedAt });
    } catch (e) {
      this.deps.log?.(`[instance] 종료 기록 실패: ${String(e)}`);
    }
  }
}
