/**
 * backup-scheduler.ts 단위 테스트
 * 대상 기능: F068~F069 (자동/수동 백업)
 * 수용 기준:
 *   - performBackup 이 내용이 있는 DB 덤프를 남긴다
 *   - pg_dump 이 없으면 pg 커넥션 폴백으로 덤프한다
 *   - 실패를 completed 로 기록하지 않는다
 *   - 스케줄러 시작/정지
 *
 * PostgreSQL 전환 반영: 예전 테스트는 "SQLite 파일 복사 + wal_checkpoint"를
 * 검증했다. 구현이 pg 덤프로 바뀌어 그 기대는 더 이상 성립하지 않는다.
 * 특히 0바이트 덤프가 completed 로 기록되던 버그가 있었으므로, 파일에 내용이
 * 실제로 들어갔는지를 본다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

const h = vi.hoisted(() => ({
  execFileSync: vi.fn(),
  insertValues: vi.fn((_values: Record<string, unknown>) => Promise.resolve()),
  selectRows: [] as unknown[],
  clientQuery: vi.fn(),
  clientRelease: vi.fn(),
  connect: vi.fn(),
}));

vi.mock('child_process', () => ({ execFileSync: h.execFileSync }));

vi.mock('@/lib/db', () => {
  const selectChain: Record<string, unknown> = {};
  for (const m of ['from', 'where', 'orderBy', 'limit']) selectChain[m] = vi.fn(() => selectChain);
  selectChain.then = (res: (v: unknown) => void) => Promise.resolve(h.selectRows).then(res);

  return {
    default: {
      insert: vi.fn(() => ({ values: h.insertValues })),
      select: vi.fn(() => selectChain),
      delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
    },
    pool: { connect: h.connect },
  };
});

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn((...a: unknown[]) => a), desc: vi.fn((...a: unknown[]) => a) };
});

const TEST_HOME = path.join(os.tmpdir(), `cm-backup-test-${Date.now()}`);

/** pg 폴백이 쓰는 커넥션. 테이블 한 개에 행 한 개를 돌려준다 */
function stubPgClient() {
  h.clientQuery.mockImplementation((sql: string) => {
    if (sql.includes('information_schema')) return { rows: [{ table_name: 'agents' }] };
    return { rows: [{ id: 'a1', name: 'Main' }] };
  });
  h.connect.mockResolvedValue({
    query: h.clientQuery,
    release: h.clientRelease,
    escapeIdentifier: (v: string) => `"${v}"`,
    escapeLiteral: (v: string) => `'${v}'`,
  });
}

function latestDump(): string {
  const dir = path.join(TEST_HOME, 'backups');
  const file = fs.readdirSync(dir).find((f) => f.startsWith('db-'));
  return file ? fs.readFileSync(path.join(dir, file), 'utf-8') : '';
}

describe('backup-scheduler.ts - 자동 백업', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLAUDEMANAGER_HOME = TEST_HOME;
    process.env.DATABASE_URL = 'postgresql://u:p@127.0.0.1:5434/db';
    fs.mkdirSync(path.join(TEST_HOME, 'backups'), { recursive: true });
    h.selectRows = [];
    stubPgClient();
  });

  afterEach(() => {
    fs.rmSync(TEST_HOME, { recursive: true, force: true });
  });

  describe('performBackup', () => {
    it('pg_dump 이 있으면 그 출력을 덤프 파일로 쓴다', async () => {
      h.execFileSync.mockReturnValue(Buffer.from('-- pg_dump output\nCREATE TABLE agents();'));

      const { performBackup } = await import('@/lib/backup-scheduler');
      const result = await performBackup();

      expect(result.success).toBe(true);
      expect(result.filePath).toContain('db-');
      expect(latestDump()).toContain('pg_dump output');
      expect(h.execFileSync.mock.calls[0][0]).toBe('pg_dump');
      // pg_dump 으로 끝났으면 폴백 커넥션은 쓰이지 않는다
      expect(h.connect).not.toHaveBeenCalled();
    });

    it('pg_dump 이 없으면 pg 커넥션으로 폴백해 데이터를 덤프한다', async () => {
      h.execFileSync.mockImplementation((cmd: string) => {
        if (cmd === 'pg_dump') throw new Error('ENOENT');
        return Buffer.from('');   // tar 는 성공한 셈 치고 빈 출력
      });

      const { performBackup } = await import('@/lib/backup-scheduler');
      const result = await performBackup();

      expect(result.success).toBe(true);
      const dump = latestDump();
      expect(dump).toContain('data-only dump');
      expect(dump).toContain('INSERT INTO "agents"');
      expect(h.clientRelease).toHaveBeenCalled();   // 커넥션을 돌려준다
    });

    it('덤프에 내용이 들어간다 (0바이트를 남기지 않는다)', async () => {
      h.execFileSync.mockImplementation((cmd: string) => {
        if (cmd === 'pg_dump') throw new Error('ENOENT');
        return Buffer.from('');
      });

      const { performBackup } = await import('@/lib/backup-scheduler');
      await performBackup();

      const dir = path.join(TEST_HOME, 'backups');
      const dump = fs.readdirSync(dir).find((f) => f.startsWith('db-'))!;
      expect(fs.statSync(path.join(dir, dump)).size).toBeGreaterThan(0);
    });

    it('백업 결과를 backups 테이블에 completed 로 기록한다', async () => {
      h.execFileSync.mockReturnValue(Buffer.from('-- dump\n'));

      const { performBackup } = await import('@/lib/backup-scheduler');
      await performBackup();

      expect(h.insertValues).toHaveBeenCalled();
      const values = h.insertValues.mock.calls[0][0] as Record<string, unknown>;
      expect(values.type).toBe('auto');
      expect(values.status).toBe('completed');
      expect(values.sizeBytes).toBeGreaterThan(0);
    });

    it('덤프가 실패하면 completed 로 기록하지 않는다', async () => {
      h.execFileSync.mockImplementation(() => { throw new Error('ENOENT'); });
      h.connect.mockRejectedValue(new Error('DB 접속 불가'));

      const { performBackup } = await import('@/lib/backup-scheduler');
      const result = await performBackup();

      expect(result.success).toBe(false);
      const values = h.insertValues.mock.calls[0][0] as Record<string, unknown>;
      expect(values.status).toBe('failed');
      expect(values.errorMessage).toBeDefined();
    });
  });

  describe('startBackupScheduler / stopBackupScheduler', () => {
    it('스케줄러 시작 후 정지 가능', async () => {
      const { startBackupScheduler, stopBackupScheduler } = await import('@/lib/backup-scheduler');
      startBackupScheduler();
      stopBackupScheduler();
    });

    it('중복 시작 방지', async () => {
      const { startBackupScheduler, stopBackupScheduler } = await import('@/lib/backup-scheduler');
      startBackupScheduler();
      startBackupScheduler();
      stopBackupScheduler();
    });
  });
});
