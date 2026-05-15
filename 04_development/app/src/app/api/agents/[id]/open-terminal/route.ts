import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import db from '@/lib/db';
import { agents } from '@/lib/schema';
import { getAuthenticatedUserId } from '@/lib/auth';
import { eq } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { id } = await params;
  const [agent] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });
  }

  const sessionId = agent.cliSessionId;
  const projectRoot = agent.projectRoot || process.cwd();

  const continueFlag = sessionId ? `--continue ${sessionId}` : '';
  const cmd = `ulimit -n 2147483646; cd '${projectRoot.replace(/'/g, "'\\''")}' && claude ${continueFlag}`.trim();

  const script = `
tell application "Terminal"
  activate
  do script "${cmd.replace(/"/g, '\\"')}"
end tell`;

  return new Promise<NextResponse>((resolve) => {
    exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, (err) => {
      if (err) {
        resolve(NextResponse.json({ error: err.message }, { status: 500 }));
      } else {
        resolve(NextResponse.json({ ok: true, command: cmd }));
      }
    });
  });
}
