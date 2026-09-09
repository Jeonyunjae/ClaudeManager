import { NextRequest, NextResponse } from 'next/server';

/**
 * [폐기] bash 스킬의 `execute` 모드 전용 엔드포인트였다.
 *
 * 프로젝트 폴더 생성은 Main의 SCAFFOLD_PROJECT 액션이 담당한다.
 * (git 저장소에서 스킬을 내려받아 template/을 복사하고 skills.lock.json을 기록)
 *
 * 호출자가 남아 있을 수 있어 404 대신 410으로 이유를 알린다.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  return NextResponse.json(
    {
      error: {
        code: 'SKILL_EXECUTE_RETIRED',
        message:
          'bash 스킬 실행은 폐기됐습니다. 프로젝트 생성은 Main과 대화해 진행하세요.',
        details: { skill: name },
      },
    },
    { status: 410 }
  );
}
