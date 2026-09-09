import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { cancelQueuedViaWs } from '@/lib/ws-bridge';

/**
 * 대기 중인 질문 취소.
 *
 * 실행 중인 질문은 취소하지 않는다(그건 cancel-chat 이 담당).
 * 메시지는 지우지 않고 "취소됨"으로 표시만 남긴다 — 대화 이력에 구멍을
 * 내지 않기 위해서다.
 */
export async function DELETE(
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
  const { searchParams } = new URL(request.url);
  const messageId = searchParams.get('messageId');

  if (!messageId) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_REQUIRED', message: 'messageId is required' } },
      { status: 400 }
    );
  }

  const ok = await cancelQueuedViaWs(agentId, messageId);

  if (!ok) {
    return NextResponse.json(
      {
        error: {
          code: 'NOT_QUEUED',
          message: '이미 처리 중이거나 대기열에 없는 메시지입니다.',
        },
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ data: { cancelled: true, messageId } });
}
