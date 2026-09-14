# ClaudeManager

## 프로젝트 개요

Claude Code 세션을 웹 UI 에서 4계층(Main → Part → Sub → Instance)으로 구성·운영하는
오케스트레이션 콘솔. Next.js 16 + PostgreSQL + WebSocket 으로 구현돼 있으며,
현재 Spark 워크스테이션(spark-3f44)에서 내부망 전용으로 상시 기동 중이다.

| | |
|---|---|
| 접속 | [[📇 facts#호스트]] |
| 최신 커밋 | `d18524d` (2026-09-14 기준) |
| 기동 절차 | [[06_deployment/🚀 deploy-guide\|🚀 배포 가이드]] |

## 🔄 진행 현황

| 단계 | 담당 | 상태 | 완료일 |
|---|---|---|---|
| 01. 요구사항 정의 | 사람 | ✅ 완료 | 2026-04-14 |
| 02. 기획 (PRD) | planner | ✅ 완료 | 2026-04-14 |
| 03. 컨셉 결정 | 사람 | ✅ 완료 | 2026-04-14 |
| 04. 기술 결정 | 사람 | ✅ 완료 | 2026-04-14 |
| 05. 시나리오 작성 | scenario-writer | 🔄 진행 중 | 2026-04-14 |
| 06. 스토리보드 | storyboard-writer | ✅ 완료 | 2026-04-14 |
| 07. 화면설계 + 설계 | designer | ✅ 완료 | 2026-04-16 |
| 08. 개발 | developer | 🔄 진행 중 | 2026-09-14 |
| 09. 단위 테스트 | tester | ✅ 완료 | 2026-04-23 |
| 10. 시나리오 테스트 | tester | ✅ 완료 | 2026-04-16 |
| 11. 통합 테스트 | tester | ✅ 완료 | 2026-04-16 |
| 12. 배포 | deployer | ⏳ 대기 | - |

## 🔄 최근 진행 (2026-09-11 ~ 09-14)

- Spark(Linux) 운영 결함 6건 수정 — LAN 접속 하이드레이션, 0바이트 백업,
  Main 중복 생성, 마이그레이션 누락, dev 포트, 팝업 기본 크기 (`d18524d`)
- DB 볼륨 유실로 비었던 Part·Sub 레코드를 `.orchestrator` 파일 기준으로 복구
  (Software / LLMManager Sub)
- 자동 백업 2회(9/12·9/13) 정상 동작 확인
- 상세: [[04_development/📊 progress|📊 개발 현황]] Phase 6

## 📑 어디에 무엇이 있나 (문서 소유권)

같은 내용을 여러 문서가 각자 적으면 반드시 어긋난다 — 실제로 DB 포트가 네 문서에
옛 값인 채로 남아, 문서대로 따라 하면 다른 프로젝트의 DB 에 붙는 상태였다
(경위는 [[99_reference/📇 facts\|📇 facts]] 서두). 주제마다 **원본 문서 하나**를 정하고,
나머지는 옮겨 적지 말고 가리킨다.

| 주제 | 원본 (여기만 고친다) | 나머지 문서는 |
|---|---|---|
| 포트·호스트·경로·명령·버전 | [[99_reference/📇 facts\|📇 facts]] | 값을 적지 않고 링크 |
| 4계층 구조의 정의 | [[02_concept/📌 DR001-yj-manager-hierarchy\|📌 DR001]] | 자기 맥락의 요약 + 링크 |
| 권한 경계 | [[02_concept/📌 DR002-yj-manager-permission-boundary\|📌 DR002]] | 요약 + 링크 |
| DB 스키마 | [[03_design/🗄️ ERD\|🗄️ ERD]] | 링크 |
| API 계약 | [[03_design/🔌 API\|🔌 API]] | 링크 |
| 기동·복구 절차 | [[06_deployment/🚀 deploy-guide\|🚀 배포 가이드]] | 링크 |
| 기능별 진행 상태 | [[01_planning/📊 feature-tracking\|📊 기능 추적]] | 링크 |
| 개발 변경 이력 | [[04_development/📊 progress\|📊 개발 현황]] | 링크 |

> **개념 설명까지 링크로 바꾸지는 않는다.** 4계층 구조가 17개 문서에 나오는 건 대부분
> 정상이다 — 각자 필요한 만큼 자기 맥락에서 말하는 것이라서다. 다만 *정의*가 갈리면
> 원본(DR001)을 따른다.

### 썩음 방지

```bash
bash .scripts/check-doc-facts.sh   # 값이 facts 밖에 적혔는지
bash .scripts/check-runtime.sh     # 포트·응답·백업 상태 (값은 facts 에서 읽는다)
```

## 📋 빠른 링크
- [[01_planning/📋 requirements-input|✏️ 요구사항 작성]]
- [[01_planning/📊 feature-tracking|📊 기능 추적 매트릭스]]
- [[02_concept/🎨 concept-decision|🎨 컨셉 결정]]
- [[03_design/🔧 tech-decisions|⚙️ 기술 결정]]
- [[03_design/📖 scenarios|📖 시나리오]]
- [[03_design/🎬 storyboard|🎬 스토리보드]]
- [[03_design/🎨 ui-concept|🎨 UI 컨셉]]
- [[03_design/🔀 user-flow|🔀 User Flow]]
- [[03_design/🖥️ screen-list|🖥️ 화면 목록]]

## 🔄 롤백
- 요구사항으로: bash .scripts/rollback.sh 01
- 기획으로: bash .scripts/rollback.sh 02
- 컨셉으로: bash .scripts/rollback.sh 03
- 시나리오로: bash .scripts/rollback.sh 05
- 스토리보드로: bash .scripts/rollback.sh 06
- 화면설계로: bash .scripts/rollback.sh 07
- 개발로: bash .scripts/rollback.sh 08
- 단위 테스트로: bash .scripts/rollback.sh 09
