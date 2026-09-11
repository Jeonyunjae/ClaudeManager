/**
 * Backup Scheduler — automated periodic backup of PostgreSQL DB and .orchestrator/ folder.
 *
 * - Uses pg_dump for database backups
 * - Compresses .orchestrator/ into tar.gz
 * - Stores backups in $CLAUDEMANAGER_HOME/backups/
 * - Auto-deletes old backups beyond retention limit
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import db, { pool } from './db';
import { backups, settings } from './schema';
import { eq, desc } from 'drizzle-orm';

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_MAX_BACKUPS = 7;

let intervalId: ReturnType<typeof setInterval> | null = null;

function getBackupDir(): string {
  const home = process.env.CLAUDEMANAGER_HOME || process.cwd();
  const dir = path.join(home, 'backups');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * .orchestrator 폴더 경로.
 *
 * 기존 구현은 `A || B ? x : y` 였다. || 가 ?: 보다 먼저 묶이는 탓에 조건이
 * (A || B) 가 되어, ORCHESTRATOR_DIR 을 설정해도 값이 쓰이지 않고 항상
 * CLAUDEMANAGER_HOME 쪽 분기로 갔다. HOME 없이 DIR 만 있으면 path.join('', ...)
 * 으로 상대 경로가 나와 엉뚱한 곳을 압축했다.
 */
function getOrchestratorDir(): string {
  if (process.env.ORCHESTRATOR_DIR) return process.env.ORCHESTRATOR_DIR;
  if (process.env.CLAUDEMANAGER_HOME) {
    return path.join(process.env.CLAUDEMANAGER_HOME, '.orchestrator');
  }
  return path.join(process.cwd(), '.orchestrator');
}

async function getMaxBackups(): Promise<number> {
  try {
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'backup_retention_count'))
      .limit(1);
    return row ? parseInt(row.value, 10) : DEFAULT_MAX_BACKUPS;
  } catch {
    return DEFAULT_MAX_BACKUPS;
  }
}

async function getBackupIntervalMs(): Promise<number> {
  try {
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'backup_interval_hours'))
      .limit(1);
    return row ? parseInt(row.value, 10) * 60 * 60 * 1000 : DEFAULT_INTERVAL_MS;
  } catch {
    return DEFAULT_INTERVAL_MS;
  }
}

/**
 * 한 행의 값을 SQL 리터럴로. 따옴표 처리는 드라이버(escapeLiteral)에 맡긴다.
 */
function toSqlLiteral(client: { escapeLiteral: (v: string) => string }, value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return client.escapeLiteral(value.toISOString());
  if (Buffer.isBuffer(value)) return `'\\x${value.toString('hex')}'::bytea`;
  if (typeof value === 'object') return client.escapeLiteral(JSON.stringify(value));
  return client.escapeLiteral(String(value));
}

/**
 * DB 덤프. 실제로 쓰인 바이트 수를 돌려주고, 한 바이트도 못 쓰면 throw 한다.
 *
 * 기존 구현은 `pg_dump "<url>" > "<path>"` 한 줄을 셸에 통째로 넘겼다.
 * 셸은 명령을 실행하기 **전에** 리다이렉트 대상 파일부터 만들기 때문에,
 * pg_dump 가 없는 환경에서도 0바이트 파일이 남았다. 게다가 실패를 warn 으로만
 * 흘리고 호출부가 status:'completed' 로 기록해, 백업이 없는데 있는 것처럼 보였다
 * (이 워크스테이션에 0바이트 덤프만 7개 쌓여 있었다).
 *
 * 그래서 (1) 리다이렉트를 버리고 stdout 을 직접 받아 쓰고,
 * (2) pg_dump 가 없으면 앱이 이미 들고 있는 pg 커넥션으로 데이터만 덤프한다.
 *     postgresql-client 설치에는 sudo 가 필요해 이 장비에서는 깔 수 없고,
 *     DB 는 도커 안이라 컨테이너의 pg_dump 도 docker exec(=sudo) 없이는 못 쓴다.
 */
async function dumpDatabase(databaseUrl: string, filePath: string): Promise<number> {
  // (1) pg_dump — 있으면 스키마까지 온전히 담기므로 우선한다
  try {
    const out = execFileSync('pg_dump', ['--no-owner', '--no-privileges', databaseUrl], {
      timeout: 60000,
      maxBuffer: 512 * 1024 * 1024,
    });
    if (out.length > 0) {
      fs.writeFileSync(filePath, out);
      return out.length;
    }
  } catch {
    // pg_dump 부재/실패 — 아래 폴백으로 간다
  }

  // (2) 폴백: 데이터만 덤프. 복원 전에 마이그레이션을 먼저 적용해야 한다
  const client = await pool.connect();
  try {
    const { rows: tables } = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name`
    );

    const lines: string[] = [
      '-- ClaudeManager data-only dump',
      `-- generated: ${new Date().toISOString()}`,
      '-- pg_dump 이 없어 데이터만 담았다. 복원 순서: db:migrate -> 이 파일 실행',
      'BEGIN;',
    ];

    for (const { table_name: table } of tables) {
      const ident = client.escapeIdentifier(table);
      const { rows } = await client.query(`SELECT * FROM ${ident}`);
      if (rows.length === 0) continue;

      const columns = Object.keys(rows[0] as Record<string, unknown>);
      const columnList = columns.map((c) => client.escapeIdentifier(c)).join(', ');
      lines.push(`\n-- ${table} (${rows.length} rows)`);
      for (const row of rows as Record<string, unknown>[]) {
        const values = columns.map((c) => toSqlLiteral(client, row[c])).join(', ');
        lines.push(`INSERT INTO ${ident} (${columnList}) VALUES (${values});`);
      }
    }

    lines.push('COMMIT;', '');
    const sql = lines.join('\n');
    fs.writeFileSync(filePath, sql, 'utf-8');
    return Buffer.byteLength(sql);
  } finally {
    client.release();
  }
}

/**
 * Perform a single backup.
 */
export async function performBackup(): Promise<{ success: boolean; filePath?: string; error?: string }> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = getBackupDir();
  const orchestratorDir = getOrchestratorDir();
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://claudemanager:claudemanager@localhost:5432/claudemanager';

  try {
    // 1. Database dump
    const dbBackupPath = path.join(backupDir, `db-${timestamp}.sql`);
    const dbBytes = await dumpDatabase(databaseUrl, dbBackupPath);

    // 2. Compress .orchestrator/ folder if it exists
    let orchestratorBackupPath: string | null = null;
    if (fs.existsSync(orchestratorDir)) {
      orchestratorBackupPath = path.join(backupDir, `orchestrator-${timestamp}.tar.gz`);
      try {
        const parentDir = path.dirname(orchestratorDir);
        const dirName = path.basename(orchestratorDir);
        execFileSync('tar', ['-czf', orchestratorBackupPath, '-C', parentDir, dirName], {
          timeout: 60000,
        });
      } catch {
        orchestratorBackupPath = null;
        // tar might not be available — continue with DB backup only
      }
    }

    // 3. Calculate total backup size
    let totalSize = dbBytes;
    if (orchestratorBackupPath && fs.existsSync(orchestratorBackupPath)) {
      totalSize += fs.statSync(orchestratorBackupPath).size;
    }

    // 4. Record backup in DB
    await db.insert(backups)
      .values({
        type: 'auto',
        status: 'completed',
        filePath: dbBackupPath,
        sizeBytes: totalSize,
      });

    console.log(`[backup] Completed: ${dbBackupPath} (${(totalSize / 1024).toFixed(1)} KB)`);

    // 5. Cleanup old backups
    await cleanupOldBackups();

    return { success: true, filePath: dbBackupPath };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    await db.insert(backups)
      .values({
        type: 'auto',
        status: 'failed',
        errorMessage: errorMsg,
      });

    console.error('[backup] Failed:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Remove old backup files beyond the retention limit.
 */
async function cleanupOldBackups(): Promise<void> {
  try {
    const maxBackups = await getMaxBackups();
    const allBackups = await db
      .select()
      .from(backups)
      .where(eq(backups.status, 'completed'))
      .orderBy(desc(backups.createdAt));

    if (allBackups.length <= maxBackups) return;

    const toDelete = allBackups.slice(maxBackups);
    for (const backup of toDelete) {
      // Delete the file(s)
      if (backup.filePath && fs.existsSync(backup.filePath)) {
        fs.unlinkSync(backup.filePath);
        // Also try to delete the corresponding orchestrator backup
        const orchPath = backup.filePath.replace('db-', 'orchestrator-').replace('.sql', '.tar.gz');
        if (fs.existsSync(orchPath)) {
          fs.unlinkSync(orchPath);
        }
      }

      // Update DB record
      await db.update(backups)
        .set({ status: 'deleted' })
        .where(eq(backups.id, backup.id));
    }

    console.log(`[backup] Cleaned up ${toDelete.length} old backup(s)`);
  } catch (err) {
    console.error('[backup] Cleanup failed:', err);
  }
}

/**
 * Start the backup scheduler.
 */
export async function startBackupScheduler(): Promise<void> {
  if (intervalId) return;

  const intervalMs = await getBackupIntervalMs();
  intervalId = setInterval(() => { performBackup(); }, intervalMs);

  console.log(
    `[backup] Scheduler started (interval: ${(intervalMs / 3600000).toFixed(1)}h)`
  );
}

/**
 * Stop the backup scheduler.
 */
export function stopBackupScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[backup] Scheduler stopped');
  }
}
