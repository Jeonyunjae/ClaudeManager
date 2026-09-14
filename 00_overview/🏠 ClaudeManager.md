# ClaudeManager

## 프로젝트 개요

Claude Code 세션을 웹 UI 에서 4계층(Main → Part → Sub → Instance)으로 구성·운영하는
오케스트레이션 콘솔. Next.js 16 + PostgreSQL + WebSocket 으로 구현돼 있으며,
현재 Spark 워크스테이션(spark-3f44)에서 내부망 전용으로 상시 기동 중이다.

| | |
|---|---|
| 접속 | http://192.168.30.24:3010 |
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
