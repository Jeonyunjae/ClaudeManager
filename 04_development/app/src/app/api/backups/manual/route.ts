import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { backups, auditLogs } from '@/lib/schema';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  const dbDir = process.env.CLAUDEMANAGER_HOME
    ? path.join(process.env.CLAUDEMANAGER_HOME, 'data')
    : path.join(process.cwd(), 'data');

  const backupDir = path.join(dbDir, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `backup-${timestamp}.db`);
  const sourceFile = path.join(dbDir, 'claudemanager.db');

  try {
    // Copy database file
    if (fs.existsSync(sourceFile)) {
      fs.copyFileSync(sourceFile, backupFile);
    }

    const stats = fs.existsSync(backupFile) ? fs.statSync(backupFile) : null;

    const [insertResult] = await db.insert(backups).values({
      type: 'manual',
      status: 'completed',
      filePath: backupFile,
      sizeBytes: stats?.size || 0,
    }).returning({ id: backups.id });

    const id = insertResult.id;

    await db.insert(auditLogs).values({
      actorType: 'user',
      actorId: String(userId),
      action: 'manual_backup',
      resource: 'backup',
      resourceId: String(id),
    });

    return NextResponse.json({ data: { id, status: 'completed' } });
  } catch {
    const result = await db.insert(backups).values({
      type: 'manual',
      status: 'failed',
      errorMessage: 'Backup failed',
    });

    return NextResponse.json(
      { error: { code: 'SYSTEM_BACKUP_FAILED', message: 'Backup failed' } },
      { status: 500 }
    );
  }
}
