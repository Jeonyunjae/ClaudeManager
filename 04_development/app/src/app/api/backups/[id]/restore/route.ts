import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { backups, auditLogs } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const backupId = parseInt(id, 10);
  const body = await request.json();

  if (!body.confirm) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_REQUIRED', message: 'Confirmation required' } },
      { status: 400 }
    );
  }

  const [backup] = await db.select().from(backups).where(eq(backups.id, backupId)).limit(1);
  if (!backup || !backup.filePath) {
    return NextResponse.json(
      { error: { code: 'SYSTEM_RESTORE_FAILED', message: 'Backup not found' } },
      { status: 404 }
    );
  }

  if (!fs.existsSync(backup.filePath)) {
    return NextResponse.json(
      { error: { code: 'SYSTEM_RESTORE_FAILED', message: 'Backup file not found on disk' } },
      { status: 404 }
    );
  }

  try {
    const dbDir = process.env.CLAUDEMANAGER_HOME
      ? path.join(process.env.CLAUDEMANAGER_HOME, 'data')
      : path.join(process.cwd(), 'data');
    const targetFile = path.join(dbDir, 'claudemanager.db');

    // Create a pre-restore backup
    const preRestoreBackup = path.join(dbDir, 'backups', `pre-restore-${Date.now()}.db`);
    if (fs.existsSync(targetFile)) {
      fs.copyFileSync(targetFile, preRestoreBackup);
    }

    await db.insert(auditLogs).values({
      actorType: 'user',
      actorId: String(userId),
      action: 'restore_backup',
      resource: 'backup',
      resourceId: id,
    });

    // Note: actual restore requires process restart for SQLite
    // This records the intent; a deployment script handles the actual file swap
    return NextResponse.json({ data: { status: 'restoring' } });
  } catch {
    return NextResponse.json(
      { error: { code: 'SYSTEM_RESTORE_FAILED', message: 'Restore failed' } },
      { status: 500 }
    );
  }
}
