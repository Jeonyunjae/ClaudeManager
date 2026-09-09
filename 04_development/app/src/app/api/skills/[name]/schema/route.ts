import { NextRequest, NextResponse } from 'next/server';

/**
 * [폐기] bash 스킬의 `schema` 모드 전용 엔드포인트였다.
 *
 * 스킬은 git 저장소의 마크다운(SKILL.md + template/)으로 전환됐고,
 * 입력 스키마로 폼을 자동 생성하던 역할은 Main과의 대화가 대신한다.
 * 근거 컬럼(skills.schema_json)도 제거됐다.
 *
 * 호출자가 남아 있을 수 있어 404 대신 410으로 이유를 알린다.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  return NextResponse.json(
    {
      error: {
        code: 'SKILL_SCHEMA_RETIRED',
        message:
          'bash 스킬의 schema 모드는 폐기됐습니다. 스킬은 git 저장소의 SKILL.md로 관리하며, 입력은 Main과의 대화로 받습니다.',
        details: { skill: name },
      },
    },
    { status: 410 }
  );
}
