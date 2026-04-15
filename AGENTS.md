# ClaudeManager — 공통 에이전트 지시 (v5.0)

## 핵심 원칙: Human-in-the-Loop
모든 단계는 사람의 검토와 승인 후에만 다음 단계로 진행한다.

## 기능 추적 매트릭스 규칙
01_planning/📊 feature-tracking.md는 모든 에이전트가 참조하는 핵심 문서다.
- 기획 완료 시: planner가 기능 ID를 부여하고 매트릭스 생성
- 시나리오 완료 시: scenario-writer가 시나리오 매핑 열 업데이트
- 스토리보드 완료 시: storyboard-writer가 스토리보드 매핑 열 업데이트
- 설계 완료 시: designer가 화면 매핑 열 업데이트
- 개발 완료 시: developer가 구현 상태 열 업데이트
- 각 테스트 완료 시: tester가 테스트 결과 열 업데이트
- 매트릭스에 빈 칸이 있으면 해당 단계 완료 보고 불가

## 완료 조건 검증 규칙
각 단계 완료 보고 전, 반드시 실행:
bash .scripts/verify-completion.sh "단계번호"
검증 실패 시 완료 보고 금지.

## 알림 규칙
bash .scripts/notify.sh "제목" "내용" "타입(완료/질문/오류/시작)"

## 대시보드 업데이트 규칙
단계 시작: bash .scripts/update-dashboard.sh "번호" "🔄 진행 중"
단계 완료: bash .scripts/update-dashboard.sh "번호" "✅ 완료"

## 막혔을 때 규칙
임의로 결정하거나 추측으로 진행하지 않는다.
해당 단계 feedback.md에 질문을 기록하고 알림 후 대기.

## 기술 검토 요청 패턴
피드백 대기 중에도 언제든 CLI에서 질문 가능.
Team Lead가 A/B/C 옵션으로 답변하고 결정은 사람이 한다.
결정된 내용은 feedback.md 하단 기술 결정 이력에 자동 기록.

## 체크포인트 규칙 (중단 대비)
- 섹션 단위로 나눠서 저장 (한 번에 전체 작성 금지)
- 파일 하나 완성 시 즉시 저장
- 재시작 시: MASTER_CONTEXT.md + docs 파일 읽으면 이어서 진행 가능

## 재시작 규칙
종료 후 재시작 시:
1. MASTER_CONTEXT.md 읽기
2. 각 feedback.md 읽기 (체크포인트 확인)
3. 01_planning/📊 feature-tracking.md 읽기
4. 중단된 지점부터 이어서 진행
5. 사람에게 현재 상태 보고

## 피드백 상태
- ✅ 승인 → 다음 단계 진행
- 🔄 수정 요청 → 반영 후 재작성
- ❓ 질문 → feedback.md 기록 후 알림 후 대기
- ⏳ 검토 전 → 대기

## 폴더 구조
- 00_overview/     : 프로젝트 현황 대시보드
- 01_planning/     : 요구사항 + PRD + 기능 추적
- 02_concept/      : 컨셉 결정
- 03_design/       : 시나리오 + 스토리보드 + 화면설계 + 설계문서
- 04_development/  : 개발 현황
- 05_testing/      : 단위·시나리오·통합 테스트
- 06_deployment/   : 배포 이력
- .scripts/        : 자동화 스크립트
