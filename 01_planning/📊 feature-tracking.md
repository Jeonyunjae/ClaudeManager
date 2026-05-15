# 기능 추적 매트릭스
> 작성: planner가 생성, 이후 각 에이전트가 업데이트 (피드백 12건 반영)
> 모든 열이 체크여야 배포 가능
> 단위테스트 마지막 실행: 2026-04-23 (tester v4.0) — 485 PASS / 54 FAIL / 108 SKIP

## A. Skill 엔진

| ID   | 기능명            | 시나리오           | 스토리보드 | 화면  | 구현  | 단위테스트 | 시나리오테스트 | 통합테스트 |
| ---- | -------------- | -------------- | ----- | --- | --- | ----- | ------- | ----- |
| F001 | Skill 실행 엔진    | SC-002         | SB-009, SB-010, SB-011 | SCR-SKILL-001, SCR-SKILL-002, SCR-OFFICE-005 | v   | v     | v       | v     |
| F002 | 기본 Skill 제공    | SC-002         | SB-009 | SCR-SKILL-001 | v   | v     | v       | v     |
| F003 | 단일 상속 메커니즘     | SC-002, SC-018 | SB-009 | SCR-SKILL-001 | v   | v     | v       | v     |
| F004 | Skill 라이브러리 관리 | SC-002, SC-018 | SB-009 | SCR-SKILL-001 | v   | v     | v       | v     |
| F005 | 스키마 기반 입력 폼    | SC-002         | SB-010 | SCR-SKILL-002 | v   | v     | v       | v     |
| F006 | Skill 버전 관리    | SC-002         | SB-009, SB-010 | SCR-SKILL-001, SCR-SKILL-002 | v   | v     | v       | v     |
| F007 | Skill 작성 지원    | SC-018         | SB-007, SB-009 | SCR-CHAT-001, SCR-SKILL-001 | v   | v     | v       | v     |

## B. 4계층 오케스트레이션

| ID | 기능명 | 시나리오 | 스토리보드 | 화면 | 구현 | 단위테스트 | 시나리오테스트 | 통합테스트 |
|---|---|---|---|---|---|---|---|---|
| F008 | Main 오케스트레이터 관리 | SC-001, SC-003, SC-013, SC-018 | SB-003, SB-004, SB-007 | SCR-OFFICE-001, SCR-OFFICE-002, SCR-CHAT-001 | v | v | v | v |
| F009 | Part 동적 생성 | SC-002, SC-003, SC-028 | SB-010, SB-011, SB-023 | SCR-SKILL-002, SCR-OFFICE-005, SCR-SETTINGS-002 | v | v | v | v |
| F010 | Sub 오케스트레이터 관리 | SC-003 | SB-004 | SCR-OFFICE-002 | v | v | v | v |
| F011 | 인스턴스 관리 | SC-003, SC-026 | SB-004, SB-007 | SCR-OFFICE-002, SCR-CHAT-001 | v | v | v | v |
| F012 | 에이전트 트리 구조 | SC-003, SC-022 | SB-004, SB-012, SB-021 | SCR-OFFICE-002, SCR-AGENT-001, SCR-REPORT-003 | v | v | v | v |

## C. 모니터링

| ID | 기능명 | 시나리오 | 스토리보드 | 화면 | 구현 | 단위테스트 | 시나리오테스트 | 통합테스트 |
|---|---|---|---|---|---|---|---|---|
| F013 | 전체 대시보드 | SC-001, SC-003, SC-008, SC-025, SC-027 | SB-003, SB-004, SB-016, SB-026, SB-028 | SCR-OFFICE-001, SCR-OFFICE-002, SCR-REPORT-001, SCR-MOBILE-001, SCR-MOBILE-003 | v | v | v | v |
| F014 | 프로젝트 상세 뷰 | SC-003, SC-005, SC-008, SC-022 | SB-012, SB-016, SB-021 | SCR-AGENT-001, SCR-REPORT-001, SCR-REPORT-003 | v | v | v | v |
| F015 | 인스턴스 상세 뷰 | SC-005 | SB-012, SB-015 | SCR-AGENT-001, SCR-AGENT-004 | v | v | v | v |
| F016 | 비용 대시보드 | SC-007 | SB-018 | SCR-DATA-001 | v | v | v | v |
| F017 | 시스템 헬스 모니터링 | SC-016, SC-017 | SB-019, SB-022 | SCR-SYSTEM-001, SCR-SETTINGS-001 | v | v | v | v |
| F018 | UI 네비게이션 Part 탭 | SC-001, SC-025 | SB-003, SB-004 | SCR-OFFICE-001, SCR-OFFICE-002 | v | v | v | v |

## D. 제어

| ID | 기능명 | 시나리오 | 스토리보드 | 화면 | 구현 | 단위테스트 | 시나리오테스트 | 통합테스트 |
|---|---|---|---|---|---|---|---|---|
| F019 | 프로젝트 생성 | SC-003 | SB-004, SB-007 | SCR-OFFICE-002, SCR-CHAT-001 | v | v | v | v |
| F020 | 프로젝트 생명주기 관리 | SC-003, SC-013, SC-019 | SB-004, SB-007 | SCR-OFFICE-002, SCR-CHAT-001 | v | v | v | v |
| F021 | 프로젝트 우선순위 변경 | SC-013 | SB-007 | SCR-CHAT-001 | v | v | v | v |
| F022 | 인스턴스 모델 수동 선택 | SC-007, SC-026 | SB-007, SB-018 | SCR-CHAT-001, SCR-DATA-001 | v | v | v | v |

## E. Human-in-the-Loop (의사결정)

| ID | 기능명 | 시나리오 | 스토리보드 | 화면 | 구현 | 단위테스트 | 시나리오테스트 | 통합테스트 |
|---|---|---|---|---|---|---|---|---|
| F023 | 승인 요청 수신 | SC-004, SC-009 | SB-005, SB-008, SB-026 | SCR-OFFICE-003, SCR-CHAT-002, SCR-MOBILE-001 | v | v | v | v |
| F024 | 승인 처리 | SC-004, SC-009 | SB-008, SB-026 | SCR-CHAT-002, SCR-MOBILE-001 | v | v | v | v |
| F025 | 승인 이력 관리 | SC-004, SC-008, SC-014 | SB-008, SB-016, SB-017, SB-018-B | SCR-CHAT-002, SCR-REPORT-001, SCR-REPORT-002, SCR-DATA-002 | v | v | v | v |
| F026 | 승인 대기 강조 | SC-004 | SB-005, SB-008 | SCR-OFFICE-003, SCR-CHAT-002 | v | v | v | v |
| F027 | Part별 승인 정책 | SC-004, SC-012 | SB-008, SB-022, SB-023 | SCR-CHAT-002, SCR-SETTINGS-001, SCR-SETTINGS-002 | v | v | v | v |

## F. 알림

| ID | 기능명 | 시나리오 | 스토리보드 | 화면 | 구현 | 단위테스트 | 시나리오테스트 | 통합테스트 |
|---|---|---|---|---|---|---|---|---|
| F028 | 대시보드 실시간 알림 | SC-001, SC-004, SC-006, SC-009, SC-017, SC-024, SC-027 | SB-003, SB-005, SB-019, SB-020, SB-026, SB-027 | SCR-OFFICE-001, SCR-OFFICE-003, SCR-SYSTEM-001, SCR-SYSTEM-002, SCR-MOBILE-001, SCR-MOBILE-002 | v | v | v | v |
| F029 | 브라우저 푸시 알림 | SC-004, SC-006, SC-009, SC-024, SC-027 | SB-005, SB-020, SB-026, SB-027 | SCR-OFFICE-003, SCR-SYSTEM-002, SCR-MOBILE-001, SCR-MOBILE-002 | v | v | v | v |
| F030 | 알림 트리거 관리 | SC-004, SC-006, SC-017, SC-024 | SB-019, SB-020, SB-027 | SCR-SYSTEM-001, SCR-SYSTEM-002, SCR-MOBILE-002 | v | v | v | v |
| F031 | 비용 임계값 알림 | SC-007, SC-024 | SB-018, SB-020 | SCR-DATA-001, SCR-SYSTEM-002 | v | v | v | v |

## G. 오류 처리

| ID | 기능명 | 시나리오 | 스토리보드 | 화면 | 구현 | 단위테스트 | 시나리오테스트 | 통합테스트 |
|---|---|---|---|---|---|---|---|---|
| F032 | 자동 재시도 | SC-006 | SB-004, SB-007 | SCR-OFFICE-002, SCR-CHAT-001 | v | v | v | v |
| F033 | 재시도 실패 처리 | SC-006 | SB-004, SB-007, SB-015 | SCR-OFFICE-002, SCR-CHAT-001, SCR-AGENT-004 | v | v | v | v |
| F034 | 오류 로그 저장 | SC-006, SC-014 | SB-014, SB-018-B | SCR-AGENT-003, SCR-DATA-002 | v | ! | v | v |
| F035 | Part별 재시도 정책 설정 | SC-006, SC-012 | SB-022, SB-023 | SCR-SETTINGS-001, SCR-SETTINGS-002 | v | v | v | v |

## H. API 키 관리

| ID | 기능명 | 시나리오 | 스토리보드 | 화면 | 구현 | 단위테스트 | 시나리오테스트 | 통합테스트 |
|---|---|---|---|---|---|---|---|---|
| F036 | API 키 등록/갱신 | SC-011 | SB-007, SB-024 | SCR-CHAT-001, SCR-SETTINGS-003 | v | v | v | v |
| F037 | 키 사용량 추적 | SC-007, SC-011 | SB-018, SB-024 | SCR-DATA-001, SCR-SETTINGS-003 | v | v | v | v |
| F038 | 키 만료일 알림 | SC-011 | SB-007, SB-024 | SCR-CHAT-001, SCR-SETTINGS-003 | v | ! | v | v |
| F039 | 키 암호화 저장 | SC-011, SC-028 | SB-023, SB-024 | SCR-SETTINGS-002, SCR-SETTINGS-003 | v | v | v | v |

## I. 상태 관리 및 복구

| ID | 기능명 | 시나리오 | 스토리보드 | 화면 | 구현 | 단위테스트 | 시나리오테스트 | 통합테스트 |
|---|---|---|---|---|---|---|---|---|
| F040 | 노트 기반 컨텍스트 관리 | SC-003, SC-005, SC-008, SC-010, SC-022, SC-023 | SB-004, SB-012, SB-013, SB-016 | SCR-OFFICE-002, SCR-AGENT-001, SCR-AGENT-002, SCR-REPORT-001 | v | v | v | v |
| F041 | 이중 저장 (노트 + DB) | SC-003, SC-008, SC-010, SC-023 | SB-004, SB-013, SB-016 | SCR-OFFICE-002, SCR-AGENT-002, SCR-REPORT-001 | v | v | v | v |
| F042 | 자동 복구 | SC-010 | SB-006 | SCR-OFFICE-004 | v | v | v | v |
| F043 | 복구 완료 알림 | SC-010, SC-024 | SB-006, SB-020 | SCR-OFFICE-004, SCR-SYSTEM-002 | v | v | v | v |

## J. AI Gateway

| ID | 기능명 | 시나리오 | 스토리보드 | 화면 | 구현 | 단위테스트 | 시나리오테스트 | 통합테스트 |
|---|---|---|---|---|---|---|---|---|
| F044 | LiteLLM 통합 | SC-002, SC-003, SC-007, SC-026 | SB-004, SB-007, SB-018 | SCR-OFFICE-002, SCR-CHAT-001, SCR-DATA-001 | v | v | v | v |
| F045 | 모델 라우팅 설정 | SC-002, SC-007, SC-026 | SB-007, SB-010, SB-018 | SCR-CHAT-001, SCR-SKILL-002, SCR-DATA-001 | v | v | v | v |
| F046 | 토큰/비용 수집 | SC-003, SC-007, SC-023, SC-026 | SB-004, SB-014, SB-018 | SCR-OFFICE-002, SCR-AGENT-003, SCR-DATA-001 | v | v | v | v |

## K. 이전 용이성

| ID | 기능명 | 시나리오 | 스토리보드 | 화면 | 구현 | 단위테스트 | 시나리오테스트 | 통합테스트 |
|---|---|---|---|---|---|---|---|---|
| F047 | 환경변수 기반 경로 관리 | SC-020, SC-028 | SB-007, SB-023 | SCR-CHAT-001, SCR-SETTINGS-002 | v | v | v | v |
| F048 | 설정 외부화 | SC-020, SC-028 | SB-007, SB-023 | SCR-CHAT-001, SCR-SETTINGS-002 | v | v | v | v |
| F049 | 마이그레이션 스크립트 | SC-020 | SB-007 | SCR-CHAT-001 | v | v | v | v |

## L. 양방향 터미널 제어

| ID | 기능명 | 시나리오 | 스토리보드 | 화면 | 구현 | 단위테스트 | 시나리오테스트 | 통합테스트 |
|---|---|---|---|---|---|---|---|---|
| F057 | 웹-CLI 양방향 통신 | SC-005 | SB-012, SB-015 | SCR-AGENT-001, SCR-AGENT-004 | v | v | v | v |
| F058 | stdin 전송 | SC-005 | SB-015 | SCR-AGENT-004 | v | v | v | v |

## M. 대표 지시 인터페이스

| ID | 기능명 | 시나리오 | 스토리보드 | 화면 | 구현 | 단위테스트 | 시나리오테스트 | 통합테스트 |
|---|---|---|---|---|---|---|---|---|
| F059 | 대표-Main 지시 UI | SC-001, SC-003, SC-004, SC-009, SC-013, SC-019 | SB-001, SB-003, SB-007, SB-008, SB-026 | SCR-AUTH-001, SCR-OFFICE-001, SCR-CHAT-001, SCR-CHAT-002, SCR-MOBILE-001 | v | v | v | v |
| F060 | 지시 이력 저장 | SC-003, SC-013, SC-019 | SB-007 | SCR-CHAT-001 | v | v | v | v |

## N. 감사 로그 (Audit Trail)

| ID | 기능명 | 시나리오 | 스토리보드 | 화면 | 구현 | 단위테스트 | 시나리오테스트 | 통합테스트 |
|---|---|---|---|---|---|---|---|---|
| F061 | 대표 행동 감사 로그 | SC-003, SC-004, SC-008, SC-012, SC-013, SC-019 | SB-007, SB-008, SB-016, SB-018-B, SB-022 | SCR-CHAT-001, SCR-CHAT-002, SCR-REPORT-001, SCR-DATA-002, SCR-SETTINGS-001 | v | v | v | v |
| F062 | 에이전트 행동 로그 | SC-003, SC-005, SC-006, SC-022 | SB-004, SB-012, SB-013, SB-014, SB-021 | SCR-OFFICE-002, SCR-AGENT-001, SCR-AGENT-002, SCR-AGENT-003, SCR-REPORT-003 | v | v | v | v |
| F063 | 감사 로그 조회 | SC-008, SC-014, SC-022 | SB-016, SB-017, SB-018-B, SB-021 | SCR-REPORT-001, SCR-REPORT-002, SCR-DATA-002, SCR-REPORT-003 | v | v | v | v |

## O. 설정/환경설정 UI

| ID | 기능명 | 시나리오 | 스토리보드 | 화면 | 구현 | 단위테스트 | 시나리오테스트 | 통합테스트 |
|---|---|---|---|---|---|---|---|---|
| F064 | 전역 설정 화면 | SC-012 | SB-022 | SCR-SETTINGS-001 | v | v | v | v |
| F065 | Part별 정책 설정 | SC-012 | SB-023 | SCR-SETTINGS-002 | v | v | v | v |

## P. 검색/필터링

| ID | 기능명 | 시나리오 | 스토리보드 | 화면 | 구현 | 단위테스트 | 시나리오테스트 | 통합테스트 |
|---|---|---|---|---|---|---|---|---|
| F066 | 이력 검색/필터 | SC-014 | SB-018-B | SCR-DATA-002 | v | v | v | v |
| F067 | 로그 검색 | SC-014 | SB-014, SB-018-B | SCR-AGENT-003, SCR-DATA-002 | v | v | v | v |

## Q. 데이터 백업/복원

| ID | 기능명 | 시나리오 | 스토리보드 | 화면 | 구현 | 단위테스트 | 시나리오테스트 | 통합테스트 |
|---|---|---|---|---|---|---|---|---|
| F068 | ~~자동 백업~~ | ~~SC-015~~ | ~~SB-025~~ | ~~SCR-SETTINGS-004~~ | ! | ! | 삭제 | 삭제 |
| F069 | ~~수동 백업/복원~~ | ~~SC-015~~ | ~~SB-025~~ | ~~SCR-SETTINGS-004~~ | ! | ! | 삭제 | 삭제 |

## R. 동시 에이전트 리소스 관리

| ID | 기능명 | 시나리오 | 스토리보드 | 화면 | 구현 | 단위테스트 | 시나리오테스트 | 통합테스트 |
|---|---|---|---|---|---|---|---|---|
| F070 | 동시 실행 상한 설정 | SC-016 | SB-022 | SCR-SETTINGS-001 | v | ! | v | v |
| F071 | 에이전트 큐잉 | SC-016 | SB-004, SB-007 | SCR-OFFICE-002, SCR-CHAT-001 | v | ! | v | v |
| F072 | 리소스 기반 자동 제한 | SC-016 | SB-007, SB-019, SB-022 | SCR-CHAT-001, SCR-SYSTEM-001, SCR-SETTINGS-001 | v | ! | v | v |

## S. 인프라/배포

| ID | 기능명 | 시나리오 | 스토리보드 | 화면 | 구현 | 단위테스트 | 시나리오테스트 | 통합테스트 |
|---|---|---|---|---|---|---|---|---|
| F073 | Vercel 배포 설정 | SC-021 | SB-007 | SCR-CHAT-001 | v | v | v | v |
| F074 | PM2+launchd 설정 | SC-010, SC-021 | SB-006, SB-007 | SCR-OFFICE-004, SCR-CHAT-001 | v | v | v | v |
| F075 | 개발 환경 구성 | SC-021 | SB-007 | SCR-CHAT-001 | v | v | v | v |

## T. Phase 2 기능

| ID | 기능명 | 시나리오 | 스토리보드 | 화면 | 구현 | 단위테스트 | 시나리오테스트 | 통합테스트 |
|---|---|---|---|---|---|---|---|---|
| F076 | 인스턴스 모델 자동 선택 | Phase 2 | Phase 2 | Phase 2 | | | | |
| F077 | AI 모델 성능 비교 | Phase 2 | Phase 2 | Phase 2 | | | | |
| F078 | 스케줄링/자동 실행 | Phase 2 | Phase 2 | Phase 2 | | | | |
| F079 | 상세 분석 리포트 | Phase 2 | Phase 2 | Phase 2 | | | | |
| F080 | 알림 채널 확장 | Phase 2 | Phase 2 | Phase 2 | | | | |
| F081 | 프로젝트 템플릿 | Phase 2 | Phase 2 | Phase 2 | | | | |
| F082 | Agent SDK 전환 | Phase 2 | Phase 2 | Phase 2 | | | | |
| F083 | 온보딩/초기 설정 마법사 | Phase 2 | Phase 2 | Phase 2 | | | | |
