# ClaudeManager — 포트폴리오 & 이력서 정리

## 1. 이력서 항목 요약

### 한 줄 요약
> AI 에이전트 다수를 4계층 조직 구조로 편성하고, 웹 대시보드에서 실시간 감독·지시·승인하는 1인 CEO용 AI 조직 운영 플랫폼

### 이력서 기재용

**ClaudeManager** | 개인 프로젝트 | 2026.03 ~ 현재
- AI 에이전트 오케스트레이션 플랫폼 (Next.js 16 / PostgreSQL / WebSocket)
- Main → Part → Sub → Instance 4계층 에이전트 조직 구조 설계 및 구현
- Claude Code CLI를 child_process.spawn으로 래핑하여 멀티 에이전트 동시 운용
- WebSocket 기반 실시간 채팅·스트리밍·상태 브로드캐스트 구현
- Human-in-the-Loop 의사결정 승인 시스템 (Sub → Main → 대표)
- JWT 인증 + AES-256-GCM API 키 암호화 + 감사 로그
- 44개 REST API 엔드포인트, 21개 DB 테이블, 120+ 테스트 케이스
- PM2 + launchd 기반 자동 복구, 스케줄러 자동 리포트 생성

---

## 2. 포트폴리오 상세

### 2-1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 프로젝트명 | ClaudeManager |
| 유형 | 개인 프로젝트 (1인 풀스택) |
| 기간 | 2026.03 ~ 현재 |
| 목적 | 1인 CEO가 다수의 AI 에이전트를 하나의 조직처럼 운영·감독하는 통합 관리 플랫폼 |
| 핵심 가치 | "나를 관리하는 AI 조직을 만든다" — AI가 기획·설계·개발·테스트·배포를 수행하고, 사람은 의사결정에 집중 |
| 운영 환경 | Mac Mini 상시 운영 + 웹 브라우저 원격 감독 |

### 2-2. 핵심 기능

#### A. 4계층 에이전트 오케스트레이션
```
사용자(대표) → Main (PMO, 조직 관리)
                → Part (Skill 구성자, 프로젝트별 업무 그룹)
                   → Sub (프로젝트 관리 + 실제 수행, 사용자와 직접 대화)
                      → Instance (Sub의 하위 전문 태스크)
```
- Main은 직접 코드 작성 금지, Skill 작성·보고서 전달만 수행
- Sub가 사용자의 주 접점, CLAUDE.md 스타일 Skill 주입으로 역할 부여
- Part는 Skill 생성자가 아닌 구성자 — dev-skills 패키지에서 필요한 Skill 선별·할당

#### B. 실시간 대시보드 (SugarCRM 4컬럼 스타일)
- 프로젝트별 에이전트 카드 배치, 상태 실시간 반영
- 에이전트 클릭 시 팝업 — 정보/CLI/대화/로그/노트 5탭
- 비용 모니터링 (모델별·키별·일별 추이)
- 시스템 헬스 (CPU/메모리/디스크)

#### C. 비동기 채팅 & 스트리밍
- 사용자 메시지 → API Route → WS Bridge → CLI Executor → Claude CLI
- 에이전트별 독립 CLI 세션, 동시 다중 에이전트 대화 가능
- stream-json 형식 실시간 응답 스트리밍
- 이미지 첨부 분석 지원 (파일 업로드 → Read 도구 자동 호출)

#### D. Human-in-the-Loop 승인 시스템
- Sub가 의사결정 필요 시 Main을 통해 대표에게 승인 요청
- 승인/반려/수정 3가지 응답
- 승인 이력 전체 저장, 감사 추적 가능

#### E. 자동 스케줄링
- 보고서 자동 생성 (평일 18:30 PM 마감 리포트)
- API 키 만료 알림
- 자동 백업 (24시간 주기)
- 브라우저/모바일 푸시 알림

#### F. 에이전트 세션 관리
- CLI 세션 ID를 DB에 저장, 서버 재시작 시 자동 복구
- `--continue` 플래그로 대화 컨텍스트 유지
- 터미널 연결 시 활성 CLI 프로세스 자동 종료 (세션 충돌 방지)

### 2-3. 시스템 아키텍처

```
┌─────────────────────────────────────────────────┐
│                  Client (Browser)                │
│  Next.js React App + Zustand + WebSocket Client  │
└──────────────┬──────────────────┬────────────────┘
               │ HTTP (REST)      │ WS (ws://)
┌──────────────▼──────────┐ ┌────▼─────────────────┐
│   Next.js API Routes    │ │   WebSocket Server    │
│   (44 endpoints)        │ │   (ws, port 3001)     │
│   JWT Auth              │ │   CLI Executor        │
│   WS Bridge (HTTP→WS)  │ │   Real-time Broadcast │
└──────────────┬──────────┘ └────┬─────────────────┘
               │                 │
┌──────────────▼─────────────────▼─────────────────┐
│              PostgreSQL (Drizzle ORM)             │
│              21 tables, port 5434                 │
└──────────────────────────┬───────────────────────┘
                           │
┌──────────────────────────▼───────────────────────┐
│           Claude Code CLI (child_process)         │
│  --print --verbose --output-format stream-json    │
│  --permission-mode bypassPermissions              │
│  --continue <session_id>                          │
└──────────────────────────────────────────────────┘
```

### 2-4. 화면 구성 (10개 페이지)

| 페이지 | 설명 |
|--------|------|
| 로그인 | JWT 기반 단일 사용자 인증 |
| 초기 설정 | 비밀번호·API 키 최초 등록 |
| 대시보드 | 4컬럼 메인 화면, 에이전트 상태·비용·알림 |
| 워크스페이스 | 에이전트 카드 그리드, 상세 팝업 |
| 리소스 관리 | 승인 이력·오류 로그·감사 로그 |
| 설정 | API 키·백업·Part 정책·시스템 |
| 모바일 채팅 | 반응형 채팅 전용 |
| 모바일 알림 | 반응형 알림 전용 |
| 모바일 상태 | 반응형 상태 전용 |

---

## 3. 기술 스택 상세

### 3-1. Frontend
| 기술 | 버전 | 선택 이유 |
|------|------|-----------|
| Next.js | 16.2.3 | App Router + API Routes 풀스택, SSR/SSG 지원 |
| React | 19.2.4 | 컴포넌트 기반 UI, 대규모 상태 관리 |
| TypeScript | 5 | 타입 안전성, 리팩토링 용이 |
| Zustand | 5.0.12 | Redux 대비 보일러플레이트 최소, 15개 스토어 운용 |
| Tailwind CSS | 4 | 유틸리티 기반 빠른 스타일링, CSS 변수 토큰 시스템 |
| WebSocket (ws) | - | 실시간 양방향 통신, 자동 재연결 + 지수 백오프 |
| react-markdown | - | 에이전트 응답 마크다운 렌더링 |

### 3-2. Backend
| 기술 | 버전 | 선택 이유 |
|------|------|-----------|
| Node.js | - | Next.js 런타임, child_process 네이티브 지원 |
| PostgreSQL | 17 | SQLite에서 마이그레이션, 동시 접근·트랜잭션 안정성 |
| Drizzle ORM | 0.45.2 | 타입 안전 쿼리 빌더, 마이그레이션 자동 생성 |
| ws | 8.20.0 | 경량 WebSocket 서버, Next.js와 같은 프로세스 |
| JWT | 9.0.3 | 무상태 인증, 7일 만료 + 자동 갱신 |
| bcryptjs | 3.0.3 | 비밀번호 해싱 |
| AES-256-GCM | - | API 키 암호화, Node.js crypto 내장 |
| child_process | - | Claude CLI 프로세스 관리 |

### 3-3. Infrastructure
| 기술 | 용도 |
|------|------|
| PM2 | Node.js 프로세스 매니저, 자동 재시작 |
| launchd | macOS 부팅 시 자동 실행 |
| tmux | 에이전트별 터미널 세션 격리 |
| Vitest | 테스트 프레임워크 (120+ 케이스) |

### 3-4. 주요 설계 패턴
| 패턴 | 적용 위치 |
|------|-----------|
| Singleton | AgentManager (전역 인스턴스) |
| Observer/EventEmitter | 에이전트 이벤트 (started/response/error) |
| Bridge | WS Bridge — API Route ↔ WS 서버 HTTP 릴레이 |
| Queue | ExecutionQueue, AgentQueue — 태스크 순서 보장 |
| Strategy | Skill Engine — schema/execute 모드 전환 |
| Middleware | JWT 인증 미들웨어, WS 시크릿 검증 |

---

## 4. 기술적 도전과 해결

### 4-1. Next.js API Route와 WebSocket 서버의 모듈 격리 문제
**문제:** Next.js는 API Route를 별도 번들로 패키징하여, 같은 프로세스 내 WS 서버와 직접 import 시 다른 모듈 인스턴스를 참조
**해결:** HTTP 기반 WS Bridge 패턴 도입 — API Route에서 localhost HTTP 요청으로 WS 서버의 내부 엔드포인트 호출. `x-ws-secret` 헤더로 내부 통신 인증

### 4-2. CLI 세션 컨텍스트 오염
**문제:** 에이전트가 이전 실패 응답의 패턴을 학습하여 후속 메시지에서도 동일 오류 반복 (예: UUID를 모두 "에러"로 인식)
**해결:** 세션 ID 초기화 메커니즘 구현 + 시스템 프롬프트에 컨텍스트 활용 원칙 명시. `--continue` 시 `--system-prompt` 중복 전송 제거로 성능 최적화

### 4-3. 동시 다중 에이전트 세션 관리
**문제:** 여러 에이전트가 같은 프로젝트 디렉토리에서 CLI를 실행하면 세션 간 간섭 발생
**해결:** 에이전트별 격리된 임시 CWD (`/tmp/cm-agent-{id}`) 할당 + `CLAUDECODE`, `AI_AGENT` 등 환경변수 제거로 부모 세션 오염 방지

### 4-4. 대화탭/터미널탭 세션 충돌
**문제:** 웹 대화탭(백그라운드 CLI)과 터미널탭(인터랙티브 CLI)이 같은 세션 ID를 공유하여 충돌
**해결:** 터미널 연결(`terminal:connect`) 이벤트 발생 시 해당 에이전트의 활성 CLI 프로세스 자동 종료 후 터미널 세션 연결

### 4-5. SQLite → PostgreSQL 마이그레이션
**문제:** SQLite의 동시 쓰기 제한으로 다중 에이전트 환경에서 DB 잠금 발생
**해결:** PostgreSQL(port 5434)로 마이그레이션, Drizzle ORM 스키마 재정의, node-postgres Pool 기반 커넥션 관리

### 4-6. 응답 속도 최적화
**문제:** 24KB 시스템 프롬프트가 `--continue` 세션에서도 매번 재전송되어 불필요한 지연
**해결:** `--continue` 시 `--system-prompt` 생략 (세션 컨텍스트에 이미 포함), `--verbose` 플래그 버전 호환성 처리

---

## 5. 공부한 내용 & 성장 포인트

### 5-1. AI 에이전트 오케스트레이션
- Claude Code CLI의 `--print`, `--output-format stream-json`, `--continue` 등 프로그래매틱 제어
- 멀티 에이전트 세션 관리 — 세션 ID 영속화, 컨텍스트 복구, 프로세스 라이프사이클
- 프롬프트 엔지니어링 — 시스템 프롬프트 설계, 컨텍스트 오염 방지, 역할 경계 설정
- Human-in-the-Loop 패턴 — 자동화와 사람의 의사결정 사이의 균형점

### 5-2. 풀스택 웹 개발
- **Next.js App Router**: 서버/클라이언트 컴포넌트 분리, 동적 라우팅, API Routes
- **Zustand 상태 관리**: 15개 독립 스토어 설계, 구독 최적화
- **WebSocket 실시간 통신**: 커스텀 프로토콜 설계, 자동 재연결, 이벤트 기반 아키텍처
- **TypeScript 전면 적용**: 프론트엔드/백엔드/DB 스키마 전체 타입 안전성

### 5-3. 데이터베이스 & ORM
- **Drizzle ORM**: 타입 안전 스키마 정의, 마이그레이션 자동화, 관계 매핑
- **SQLite → PostgreSQL 마이그레이션**: 실 운영 환경 DB 전환 경험
- **21개 테이블 설계**: 에이전트·채팅·승인·비용·알림·감사 도메인 모델링

### 5-4. 보안
- **JWT 인증 플로우**: 토큰 발급·검증·갱신·만료 전체 사이클
- **AES-256-GCM 암호화**: API 키 안전 저장, 마스터 키 관리
- **감사 로그**: 모든 시스템 액션 추적, 보안 감사 대응

### 5-5. 인프라 & DevOps
- **PM2 + launchd**: Node.js 프로세스 관리, macOS 부팅 시 자동 시작
- **tmux 세션 관리**: 에이전트별 격리 터미널, 프로그래매틱 제어
- **프로세스 간 통신**: HTTP Bridge, WebSocket, child_process spawn/kill

### 5-6. 프로젝트 방법론
- **12단계 워크플로우**: 요구사항 → 기획 → 컨셉 → 설계 → 시나리오 → 스토리보드 → UI 설계 → 개발 → 테스트 → 배포
- **AI 주도 개발**: AI가 코드를 작성하고 사람이 검토·승인하는 새로운 개발 프로세스 경험
- **Obsidian 기반 문서 관리**: 프로젝트 산출물을 마크다운 노트로 체계적 관리

---

## 6. 프로젝트 규모

| 지표 | 수치 |
|------|------|
| 소스 코드 파일 | 100+ |
| React 컴포넌트 | 70+ (14개 카테고리) |
| API 엔드포인트 | 44개 |
| DB 테이블 | 21개 |
| Zustand 스토어 | 15개 |
| 테스트 케이스 | 120+ |
| 사용 시나리오 | 29개 |
| 커스텀 훅 | 4개 |
| 라이브러리 모듈 | 25+ |
| 자동화 스크립트 | 4개 |

---

## 7. GitHub

- **Repository:** [github.com/Jeonyunjae/ClaudeManager](https://github.com/Jeonyunjae/ClaudeManager)
- **Tech:** Next.js 16 / TypeScript / PostgreSQL / Drizzle ORM / WebSocket / Claude Code CLI
- **License:** Private (개인 프로젝트)
