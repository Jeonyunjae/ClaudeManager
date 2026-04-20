import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function GET(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const dir = searchParams.get('path') || os.homedir();

  const normalized = path.resolve(dir);

  if (!fs.existsSync(normalized)) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Directory not found' } },
      { status: 404 }
    );
  }

  try {
    const entries = fs.readdirSync(normalized, { withFileTypes: true });
    const folders = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => ({
        name: e.name,
        path: path.join(normalized, e.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      data: {
        current: normalized,
        parent: path.dirname(normalized) !== normalized ? path.dirname(normalized) : null,
        folders,
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'READ_ERROR', message: 'Cannot read directory' } },
      { status: 403 }
    );
  }
}
