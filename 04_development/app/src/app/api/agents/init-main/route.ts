import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import db from '@/lib/db';
import { agents } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { logError } from '@/lib/error-logger';

/**
 * POST /api/agents/init-main
 * Auto-creates the Main agent if it doesn't exist yet.
 * Returns the existing or newly created Main agent.
 */
export async function POST(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_TOKEN_EXPIRED', message: 'Authentication required.' } },
      { status: 401 }
    );
  }

  try {
    // Check if a Main agent already exists
    const [existing] = await db
      .select()
      .from(agents)
      .where(eq(agents.role, 'main'))
      .limit(1);

    if (existing) {
      return NextResponse.json({
        data: { agent: existing, created: false },
      });
    }

    // Create the Main agent
    const now = new Date().toISOString();
    const newAgent = {
      id: uuidv4(),
      name: 'Main',
      role: 'main',
      status: 'idle',
      modelName: 'opus',
      createdAt: now,
      updatedAt: now,
    };

    // 위의 "있으면 반환" 조회와 이 삽입 사이는 원자적이지 않다. 화면이 열릴 때
    // 요청이 동시에 둘 들어오면 둘 다 조회에서 "없음"을 보고 둘 다 삽입에 도달한다
    // (실제로 3ms 간격으로 Main 이 중복 생성된 적이 있다). ux_agents_single_main
    // 부분 유니크 인덱스가 뒤늦은 쪽을 23505 로 막으므로, 그때는 먼저 들어간
    // 레코드를 읽어 돌려준다 — 호출부 입장에서는 "이미 있었다"와 같은 결과다.
    try {
      await db.insert(agents).values(newAgent);
    } catch (insertError) {
      if ((insertError as { code?: string }).code !== '23505') throw insertError;

      const [winner] = await db
        .select()
        .from(agents)
        .where(eq(agents.role, 'main'))
        .limit(1);

      if (!winner) throw insertError;

      return NextResponse.json({
        data: { agent: winner, created: false },
      });
    }

    const [created] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, newAgent.id))
      .limit(1);

    return NextResponse.json({
      data: { agent: created, created: true },
    });
  } catch (error) {
    logError(error, { requestPath: '/api/agents/init-main' });
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: 'Failed to initialize Main agent.' } },
      { status: 500 }
    );
  }
}
