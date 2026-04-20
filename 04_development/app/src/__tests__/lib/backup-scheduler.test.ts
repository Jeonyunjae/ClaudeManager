/**
 * backup-scheduler.ts 단위 테스트
 * 대상 기능: F068~F069 (자동/수동 백업)
 * 수용 기준:
 *   - performBackup이 DB 파일을 복사
 *   - 오래된 백업 삭제 로직
 *   - 스케줄러 시작/정지
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

// Mock DB
const mockRun = vi.fn();
const mockInsertValues = vi.fn().mockReturnValue({ run: mockRun });
const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn().mockReturnValue({ run: mockRun });
mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

const mockSelectGet = vi.fn();
const mockSelectAll = vi.fn();
const mockSelectOrderBy = vi.fn().mockReturnValue({ all: mockSelectAll });
const mockSelectWhere = vi.fn().mockReturnValue({
  get: mockSelectGet,
  orderBy: mockSelectOrderBy,
  all: mockSelectAll,
});
const mockSelectFrom = vi.fn().mockReturnValue({
  where: mockSelectWhere,
  get: mockSelectGet,
});
const mockSelect = vi.fn().mockReturnValue({ from: mockSelectFrom });

const mockPragma = vi.fn();

vi.mock('@/lib/db', () => ({
  default: {
    insert: (...args: unknown[]) => mockInsert(...args),
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
  sqlite: {
    pragma: (...args: unknown[]) => mockPragma(...args),
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: vi.fn((...args: unknown[]) => args),
    desc: vi.fn((...args: unknown[]) => args),
  };
});

const TEST_HOME = path.join(os.tmpdir(), `cm-backup-test-${Date.now()}`);

describe('backup-scheduler.ts - 자동 백업', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLAUDEMANAGER_HOME = TEST_HOME;

    // Create backup-related directories
    fs.mkdirSync(path.join(TEST_HOME, 'data'), { recursive: true });
    fs.mkdirSync(path.join(TEST_HOME, 'backups'), { recursive: true });

    // Create a dummy DB file
    fs.writeFileSync(path.join(TEST_HOME, 'data', 'claudemanager.db'), 'dummy-db-content');

    // Default: no settings found
    mockSelectGet.mockReturnValue(undefined);
    mockSelectAll.mockReturnValue([]);
  });

  afterEach(() => {
    fs.rmSync(TEST_HOME, { recursive: true, force: true });
  });

  // --- AC: performBackup ---
  describe('performBackup', () => {
    it('DB 파일을 backups/ 디렉토리로 복사', async () => {
      const { performBackup } = await import('@/lib/backup-scheduler');
      const result = performBackup();

      expect(result.success).toBe(true);
      expect(result.filePath).toBeDefined();
      expect(result.filePath).toContain('backups');
      expect(result.filePath).toContain('db-');

      // Verify the backup file exists
      if (result.filePath) {
        expect(fs.existsSync(result.filePath)).toBe(true);
        const backupContent = fs.readFileSync(result.filePath, 'utf-8');
        expect(backupContent).toBe('dummy-db-content');
      }
    });

    it('WAL checkpoint을 실행', async () => {
      const { performBackup } = await import('@/lib/backup-scheduler');
      performBackup();

      expect(mockPragma).toHaveBeenCalledWith('wal_checkpoint(TRUNCATE)');
    });

    it('백업 결과를 DB backups 테이블에 INSERT', async () => {
      const { performBackup } = await import('@/lib/backup-scheduler');
      performBackup();

      expect(mockInsert).toHaveBeenCalled();
      const insertValues = mockInsertValues.mock.calls[0][0];
      expect(insertValues.type).toBe('auto');
      expect(insertValues.status).toBe('completed');
      expect(insertValues.filePath).toBeDefined();
      expect(insertValues.sizeBytes).toBeGreaterThan(0);
    });

    it('DB 파일이 없어도 에러를 throw하지 않음', async () => {
      fs.rmSync(path.join(TEST_HOME, 'data', 'claudemanager.db'), { force: true });

      const { performBackup } = await import('@/lib/backup-scheduler');
      const result = performBackup();
      // Should still succeed (no file to copy but no crash)
      expect(result.success).toBe(true);
    });
  });

  // --- AC: 스케줄러 시작/정지 ---
  describe('startBackupScheduler / stopBackupScheduler', () => {
    it('스케줄러 시작 후 정지 가능', async () => {
      const { startBackupScheduler, stopBackupScheduler } = await import('@/lib/backup-scheduler');

      // Should not throw
      startBackupScheduler();
      stopBackupScheduler();
    });

    it('중복 시작 방지', async () => {
      const { startBackupScheduler, stopBackupScheduler } = await import('@/lib/backup-scheduler');

      startBackupScheduler();
      startBackupScheduler(); // Should be a no-op
      stopBackupScheduler();
    });
  });
});
