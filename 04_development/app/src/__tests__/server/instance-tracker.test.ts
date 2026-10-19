/**
 * Instance 기록 단위 테스트 — BUG-034 (Main M-104)
 * Sub 스트림의 Agent 도구 호출 → agents에 instance 행 생성, 결과 → 종료.
 */
import { describe, it, expect, vi } from 'vitest';
import { InstanceTracker, instanceSummary, instanceName, instanceModel, type InstanceRow } from '@/server/instance-tracker';

function setup() {
  const rows = new Map<string, InstanceRow>();
  const events: { event: string; payload: Record<string, unknown> }[] = [];
  let n = 0;
  let t = Date.parse('2026-10-19T10:00:00.000Z');
  const tracker = new InstanceTracker(
    { id: 'sub-1', partId: 'part-1', modelName: 'sonnet' },
    {
      store: {
        insert: async (row) => { rows.set(row.id, { ...row }); },
        update: async (id, fields) => { rows.set(id, { ...rows.get(id)!, ...fields }); },
      },
      broadcast: (event, payload) => events.push({ event, payload }),
      newId: () => `inst-${++n}`,
      now: () => new Date(t),
    }
  );
  return { tracker, rows, events, advance: (ms: number) => { t += ms; } };
}

const agentCall = (id: string, input: Record<string, unknown> = {}, parentToolUseId: string | null = null) =>
  ({ name: 'Agent', id, input: { description: '시장 규모 조사', subagent_type: 'market-analyst', model: 'opus', ...input }, parentToolUseId });

describe('InstanceTracker', () => {
  it('Agent 도구 호출 → instance 행(active) 생성 + agent:created(parentId 포함)', async () => {
    const s = setup();
    await s.tracker.onToolUse(agentCall('tu-1'));
    const row = s.rows.get('inst-1')!;
    expect(row).toMatchObject({
      role: 'instance', status: 'active', parentId: 'sub-1', partId: 'part-1',
      name: 'market-analyst', modelName: 'opus', statusMessage: '시장 규모 조사', stoppedAt: null,
    });
    expect(s.events[0].event).toBe('agent:created');
    expect(s.events[0].payload.parentId).toBe('sub-1');
  });

  it('결과(tool_result) → idle + stoppedAt, 오류면 error', async () => {
    const s = setup();
    await s.tracker.onToolUse(agentCall('tu-1'));
    await s.tracker.onToolUse(agentCall('tu-2'));
    s.advance(65_000);
    await s.tracker.onToolResult({ toolUseId: 'tu-1', isError: false });
    await s.tracker.onToolResult({ toolUseId: 'tu-2', isError: true });
    expect(s.rows.get('inst-1')).toMatchObject({ status: 'idle', stoppedAt: '2026-10-19T10:01:05.000Z' });
    expect(s.rows.get('inst-2')!.status).toBe('error');
    expect(s.events.filter((e) => e.event === 'agent:status')).toHaveLength(2);
  });

  it('Task(구 이름)도 Instance로 본다', async () => {
    const s = setup();
    await s.tracker.onToolUse({ ...agentCall('tu-1'), name: 'Task' });
    expect(s.rows.size).toBe(1);
  });

  it('다른 도구, id 없는 호출, Instance 안에서 부른 Agent는 기록하지 않는다', async () => {
    const s = setup();
    await s.tracker.onToolUse({ name: 'Read', id: 'tu-1', input: { file_path: 'a' } });
    await s.tracker.onToolUse({ name: 'Agent', input: {} });
    await s.tracker.onToolUse(agentCall('tu-3', {}, 'tu-parent'));
    expect(s.rows.size).toBe(0);
  });

  it('모르는 tool_result·Instance 안의 결과는 무시', async () => {
    const s = setup();
    await s.tracker.onToolUse(agentCall('tu-1'));
    await s.tracker.onToolResult({ toolUseId: 'tu-x', isError: false });
    await s.tracker.onToolResult({ toolUseId: 'tu-1', isError: false, parentToolUseId: 'tu-parent' });
    expect(s.rows.get('inst-1')!.status).toBe('active');
  });

  it('같은 tool_use가 두 번 와도 한 번만 기록', async () => {
    const s = setup();
    await s.tracker.onToolUse(agentCall('tu-1'));
    await s.tracker.onToolUse(agentCall('tu-1'));
    expect(s.rows.size).toBe(1);
  });

  it('Sub 실행이 끝났는데 결과가 없던 Instance → 정상 종료면 stopped, 실패면 error', async () => {
    const s = setup();
    await s.tracker.onToolUse(agentCall('tu-1'));
    await s.tracker.finishAll(false);
    expect(s.rows.get('inst-1')!.status).toBe('stopped');
    const f = setup();
    await f.tracker.onToolUse(agentCall('tu-1'));
    await f.tracker.finishAll(true);
    expect(f.rows.get('inst-1')!.status).toBe('error');
    expect(f.tracker.activeCount).toBe(0);
  });

  it('저장 실패가 예외로 번지지 않는다 (대화를 막지 않음)', async () => {
    const log = vi.fn();
    const tracker = new InstanceTracker({ id: 's', partId: null, modelName: null }, {
      store: { insert: async () => { throw new Error('db down'); }, update: async () => { throw new Error('db down'); } },
      broadcast: () => {}, newId: () => 'i', log,
    });
    await expect(tracker.onToolUse(agentCall('tu-1'))).resolves.toBeUndefined();
    await expect(tracker.finishAll(false)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
  });
});

describe('표시 도우미', () => {
  it('하는 일 한 줄: description 우선, 없으면 prompt, 60자 자름', () => {
    expect(instanceSummary({ description: '  고객 인터뷰\n정리 ' })).toBe('고객 인터뷰 정리');
    expect(instanceSummary({ prompt: 'x'.repeat(80) })).toBe('x'.repeat(60) + '…');
  });
  it('이름 = 에이전트 유형, 없으면 general-purpose', () => {
    expect(instanceName({ subagent_type: 'devils-advocate' })).toBe('devils-advocate');
    expect(instanceName({})).toBe('general-purpose');
  });
  it('모델: 지정값, inherit·없음이면 Sub 모델', () => {
    expect(instanceModel({ model: 'haiku' }, 'sonnet')).toBe('haiku');
    expect(instanceModel({ model: 'inherit' }, 'sonnet')).toBe('sonnet');
    expect(instanceModel({}, null)).toBeNull();
  });
});
