import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { agentManager } from '@/lib/agent-manager';

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
  const session = agentManager.getAgent(agentId);
  const logs = agentManager.getCLILogs(agentId);

  return NextResponse.json({
    data: {
      sessionId: session?.sessionId || null,
      status: session?.status || 'stopped',
      messageCount: session?.messageCount || 0,
      startedAt: session?.startedAt?.toISOString() || null,
      logs,
    },
  });
}
