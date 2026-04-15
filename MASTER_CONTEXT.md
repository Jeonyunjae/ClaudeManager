# ClaudeManager — 마스터 컨텍스트 v5.0.0

## 이 문서의 역할
Claude Code가 처음 실행될 때 읽는 컨텍스트 문서.
읽은 직후 자동으로 사람에게 다음 할 일을 안내한다.

## 프로젝트 방법론
- 멀티 에이전트 오케스트레이션 + Human-in-the-Loop
- Obsidian Vault = 프로젝트 폴더
- Claude Code가 모든 단계를 안내
- 사람은 요구사항·컨셉결정·기술결정·피드백만 담당
- 기능 추적 매트릭스로 전 단계 추적

## 12단계 워크플로우
01. 요구사항 정의 (사람)
02. 기획/PRD (planner)
03. 컨셉 결정 (사람)
04. 기술 결정 (사람)
05. 시나리오 작성 (scenario-writer)
06. 스토리보드 (storyboard-writer)
07. 화면설계 + 설계 (designer)
08. 개발 (developer)
09. 단위 테스트 (tester)
10. 시나리오 테스트 (tester)
11. 통합 테스트 (tester)
12. 배포 (deployer)

## 재시작 방법 (중단 후 복구)
Claude Code가 종료되어도 docs/ 파일이 살아있어 이어서 진행 가능.

1. tmux new-session -s ClaudeManager
2. cd "/Users/jeon-yunjae/Documents/윤재 자료 정리/04.Project/05.ClaudeManager/ClaudeManager/ClaudeManager" && claude
3. > MASTER_CONTEXT.md 읽어줘. 현재까지 진행된 내용을 파악하고 이어서 진행해줘.

## CLI 입력 명령어
- "요구사항 작성 완료" → 기획 시작
- "컨셉 결정 완료" → 기술 결정 안내
- "기술 결정 완료" → 시나리오 작성 시작
- "피드백 완료" → 다음 단계 진행

## 에이전트 SKILL 위치
.claude/agents/ 폴더 (7개 에이전트)
- planner, scenario-writer, storyboard-writer, designer, developer, tester, deployer

## 자동화 스크립트
.scripts/notify.sh — Mac/Slack 알림
.scripts/update-dashboard.sh — 대시보드 업데이트
.scripts/verify-completion.sh [단계번호] — 완료 조건 검증
.scripts/rollback.sh [01~11] — 이전 단계 롤백

## 핵심 추적 문서
01_planning/📊 feature-tracking.md — 전 단계 기능 추적 매트릭스
