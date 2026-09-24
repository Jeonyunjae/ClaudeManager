/**
 * instrumentation.ts 단위 테스트
 * 대상 기능: CM_BACKGROUND_JOBS=off 분기 (NFR-002)
 * 수용 기준(DES-001 §테스트 인스턴스 구성, DES-008):
 *   - CM_BACKGROUND_JOBS='off' → 파일 감시·백업·키 만료·리포트·Main 재개 5종 미호출.
 *     WS 서버 기동·클라이언트 이벤트 등록·세션 persister/loader 등록은 그대로 호출된다.
 *   - 변수 없음 → 5종 모두 호출된다 (기존과 동일).
 *
 * 모든 의존 모듈을 모킹한다 — register()가 실제 DB·WS 서버·파일 감시를
 * 건드리지 않고, 어떤 함수가 호출/미호출되는지만 검증한다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => {
  const state = { pending: [] as unknown[] };
  const chain: Record<string, unknown> = {};
  for (const method of ['from', 'where', 'limit', 'set', 'values']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (v: unknown) => void) => resolve(state.pending.shift() ?? []);

  return {
    state,
    db: {
      select: vi.fn(() => chain),
      update: vi.fn(() => chain),
      insert: vi.fn(() => chain),
    },
    agentManager: {
      setSessionPersister: vi.fn(),
      setSessionLoader: vi.fn(),
      cancelProcess: vi.fn(() => false),
      resumeAgent: vi.fn(),
    },
    ws: {
      createWSServer: vi.fn(),
      onClientEvent: vi.fn(),
      broadcast: vi.fn(),
      sendToSocket: vi.fn(),
      setCliExecuteHandler: vi.fn(),
      setCliCancelHandler: vi.fn(),
      setQueueCancelHandler: vi.fn(),
    },
    cli: {
      processChatInBackground: vi.fn(),
      enqueueChat: vi.fn(),
      cancelQueued: vi.fn(),
    },
    terminal: {
      connectTerminal: vi.fn(),
      writeTerminal: vi.fn(),
      resizeTerminal: vi.fn(),
      disconnectTerminal: vi.fn(),
      setOnDataHandler: vi.fn(),
      setOnExitHandler: vi.fn(),
    },
    fileWatcher: {
      setWatcherBroadcast: vi.fn(),
      startFileWatcher: vi.fn(() => Promise.resolve()),
    },
    backup: { startBackupScheduler: vi.fn() },
    keyExpiry: { startKeyExpiryChecker: vi.fn() },
    report: {
      startReportScheduler: vi.fn(),
      setReportSchedulerBroadcast: vi.fn(),
      setReportSchedulerCliHandler: vi.fn(),
    },
  };
});

vi.mock('@/lib/agent-manager', () => ({ agentManager: h.agentManager }));
vi.mock('@/lib/db', () => ({ db: h.db }));
vi.mock('@/lib/schema', () => ({ agents: {}, chatMessages: {} }));
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }));
vi.mock('uuid', () => ({ v4: vi.fn(() => 'test-uuid') }));
vi.mock('@/server/ws-server', () => h.ws);
vi.mock('@/server/cli-executor', () => h.cli);
vi.mock('@/lib/terminal-manager', () => h.terminal);
vi.mock('@/lib/file-watcher', () => h.fileWatcher);
vi.mock('@/lib/backup-scheduler', () => h.backup);
vi.mock('@/lib/key-expiry-checker', () => h.keyExpiry);
vi.mock('@/lib/report-scheduler', () => h.report);
vi.mock('@/lib/constants', () => ({ WS_PORT: 3001 }));
// background-jobs.ts는 실제 구현을 그대로 쓴다 — 이 테스트가 검증할 대상이다.

import { register } from '@/instrumentation';

const ORIGINAL_ENV = { ...process.env };

describe('instrumentation register() — CM_BACKGROUND_JOBS 분기', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.state.pending.length = 0;
    process.env.NEXT_RUNTIME = 'nodejs';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("CM_BACKGROUND_JOBS='off'면 기동 작업 5종을 건너뛰지만 WS 서버·세션 저장기는 그대로 켠다", async () => {
    process.env.CM_BACKGROUND_JOBS = 'off';

    await register();

    // WS 서버·핸들러·세션 persister/loader는 유지된다
    expect(h.ws.createWSServer).toHaveBeenCalled();
    expect(h.ws.onClientEvent).toHaveBeenCalled();
    expect(h.agentManager.setSessionPersister).toHaveBeenCalled();
    expect(h.agentManager.setSessionLoader).toHaveBeenCalled();

    // 기동 작업 5종은 건너뛴다
    expect(h.fileWatcher.startFileWatcher).not.toHaveBeenCalled();
    expect(h.backup.startBackupScheduler).not.toHaveBeenCalled();
    expect(h.keyExpiry.startKeyExpiryChecker).not.toHaveBeenCalled();
    expect(h.report.startReportScheduler).not.toHaveBeenCalled();
    expect(h.agentManager.resumeAgent).not.toHaveBeenCalled();
  });

  it('CM_BACKGROUND_JOBS가 없으면 기존과 동일하게 5종 모두 실행한다', async () => {
    delete process.env.CM_BACKGROUND_JOBS;
    h.state.pending.push([
      { id: 'main-1', name: 'Main', cliSessionId: 'sess-123', projectRoot: null },
    ]);

    await register();

    expect(h.ws.createWSServer).toHaveBeenCalled();
    expect(h.fileWatcher.startFileWatcher).toHaveBeenCalled();
    expect(h.backup.startBackupScheduler).toHaveBeenCalled();
    expect(h.keyExpiry.startKeyExpiryChecker).toHaveBeenCalled();
    expect(h.report.startReportScheduler).toHaveBeenCalled();
    expect(h.agentManager.resumeAgent).toHaveBeenCalled();
  });
});
