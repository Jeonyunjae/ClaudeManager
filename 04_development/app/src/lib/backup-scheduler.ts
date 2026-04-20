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
import { execSync } from 'child_process';
import db from './db';
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

function getOrchestratorDir(): string {
  return process.env.ORCHESTRATOR_DIR
    || process.env.CLAUDEMANAGER_HOME
      ? path.join(process.env.CLAUDEMANAGER_HOME || '', '.orchestrator')
      : path.join(process.cwd(), '.orchestrator');
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
 * Perform a single backup.
 */
export async function performBackup(): Promise<{ success: boolean; filePath?: string; error?: string }> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = getBackupDir();
  const orchestratorDir = getOrchestratorDir();
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://claudemanager:claudemanager@localhost:5432/claudemanager';

  try {
    // 1. pg_dump database backup
    const dbBackupPath = path.join(backupDir, `db-${timestamp}.sql`);
    try {
      execSync(
        `pg_dump "${databaseUrl}" > "${dbBackupPath}"`,
        { timeout: 60000 }
      );
    } catch (pgErr) {
      // TODO: pg_dump might not be available in all environments
      console.warn('[backup] pg_dump not available or failed:', pgErr);
    }

    // 2. Compress .orchestrator/ folder if it exists
    let orchestratorBackupPath: string | null = null;
    if (fs.existsSync(orchestratorDir)) {
      orchestratorBackupPath = path.join(backupDir, `orchestrator-${timestamp}.tar.gz`);
      try {
        const parentDir = path.dirname(orchestratorDir);
        const dirName = path.basename(orchestratorDir);
        execSync(
          `tar -czf "${orchestratorBackupPath}" -C "${parentDir}" "${dirName}"`,
          { timeout: 60000 }
        );
      } catch {
        orchestratorBackupPath = null;
        // tar might not be available — continue with DB backup only
      }
    }

    // 3. Calculate total backup size
    let totalSize = 0;
    if (fs.existsSync(dbBackupPath)) {
      totalSize += fs.statSync(dbBackupPath).size;
    }
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
