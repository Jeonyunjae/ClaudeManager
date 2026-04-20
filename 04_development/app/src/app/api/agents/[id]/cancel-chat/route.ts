import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { requestCliCancel } from '@/lib/ws-bridge';

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

  const { id: agentId } = await params;
  const cancelled = await requestCliCancel(agentId);

  return NextResponse.json({ data: { cancelled } });
}
