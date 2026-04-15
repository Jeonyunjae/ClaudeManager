import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { agents } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

export async function GET(
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

  const { id: agentId } = await params;

  const agent = db.select().from(agents).where(eq(agents.id, agentId)).get();
  if (!agent) {
    return NextResponse.json(
      { error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found' } },
      { status: 404 }
    );
  }

  // Read notes from .orchestrator/ directory if tmuxSession path exists
  const notes: Array<{ file: string; content: string; updatedAt: string }> = [];

  const orchestratorPath = path.join(
    process.env.CLAUDEMANAGER_HOME || process.cwd(),
    'orchestrator',
    agentId
  );

  if (fs.existsSync(orchestratorPath)) {
    const readDir = (dir: string, prefix: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          readDir(fullPath, relativePath);
        } else if (entry.name.endsWith('.md')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const stat = fs.statSync(fullPath);
          notes.push({
            file: relativePath,
            content,
            updatedAt: stat.mtime.toISOString(),
          });
        }
      }
    };
    readDir(orchestratorPath, '');
  }

  return NextResponse.json({ data: notes });
}
