# 코딩 규칙
> 작성: developer | 상태: Phase 4 업데이트 완료

---

## 1. 프로젝트 구조

### 디렉토리 규칙
- Next.js App Router 기반: `src/app/` 하위에 라우트 배치
- 컴포넌트: `src/components/` 도메인별 폴더 분리
- 상태 관리: `src/stores/` Zustand Store 파일
- 유틸리티: `src/lib/` 서버/클라이언트 공통 유틸
- 타입: `src/types/` TypeScript 인터페이스/타입
- 훅: `src/hooks/` 커스텀 React 훅
- 스타일: `src/styles/` 글로벌 CSS + 디자인 토큰

### 파일 네이밍
- 컴포넌트: PascalCase (`AgentModal.tsx`)
- 유틸/훅/스토어: camelCase (`useAuth.ts`, `authStore.ts`)
- API 라우트: `route.ts` (Next.js 규칙)
- 타입 파일: camelCase (`agent.ts`)
- CSS: `globals.css`, `tokens.css`

## 2. TypeScript 규칙

- `strict: true` 활성화
- `any` 타입 사용 금지 (불가피한 경우 `unknown` 사용)
- 인터페이스 접두사 `I` 미사용 (예: `Agent`, `ChatMessage`)
- 컴포넌트 Props는 타입으로 정의: `type AgentModalProps = { ... }`
- Enum 대신 `as const` 객체 또는 유니온 타입 사용
- 모든 함수에 반환 타입 명시 (JSX 반환 함수 제외)

## 3. React / Next.js 규칙

### 컴포넌트
- 함수형 컴포넌트만 사용 (`function` 선언 또는 화살표 함수)
- `'use client'` 디렉티브: 클라이언트 컴포넌트에만 명시
- 서버 컴포넌트 우선: 가능하면 서버 컴포넌트로 작성
- `React.lazy` + `Suspense`: 터미널, 차트, 노트 뷰어 번들 지연 로딩

### 상태 관리 (Zustand)
- Store별 단일 책임 원칙
- Store 간 직접 참조 금지 (필요 시 컴포넌트에서 조합)
- `immer` 미들웨어 미사용 (상태가 단순하므로 직접 갱신)
- WebSocket 이벤트는 전용 핸들러에서 Store 업데이트

### 데이터 페칭
- 서버 컴포넌트: `fetch()` 직접 사용
- 클라이언트: `src/lib/api.ts`의 래퍼 함수 사용
- 에러 핸들링: try-catch + 공통 에러 타입

## 4. 스타일링 규칙

- Tailwind CSS 유틸리티 클래스 우선
- 커스텀 CSS는 `tokens.css`의 CSS Custom Properties만 사용
- shadcn/ui 컴포넌트 커스터마이징: `className` prop으로 오버라이드
- 인라인 스타일 금지 (동적 값 제외)
- 반응형: Tailwind 브레이크포인트 사용 (`md:`, `lg:`, `xl:`)
  - 모바일: < 768px
  - 데스크톱: >= 1024px

## 5. API 라우트 규칙

- 공통 응답 포맷: `{ data: T }` 또는 `{ error: { code, message } }`
- 페이지네이션: `{ data: T[], pagination: { page, limit, total, hasMore } }`
- JWT 인증: 미들웨어에서 처리 (`/api/auth/*` 제외)
- 에러 코드: `AUTH_`, `AGENT_`, `SKILL_`, `PART_`, `APPROVAL_`, `SYSTEM_`, `VALIDATION_` 접두사
- HTTP 상태 코드: 200 (성공), 201 (생성), 400 (유효성), 401 (인증), 404 (미발견), 500 (서버)

## 6. 데이터베이스 규칙

- Drizzle ORM 사용, raw SQL 금지
- 스키마: `src/lib/schema.ts`에 모든 테이블 정의
- 마이그레이션: Drizzle Kit으로 관리
- 날짜/시간: ISO 8601 문자열 (`datetime('now')`)
- ID: UUID (text 타입) 또는 auto-increment (integer)
- 인덱스: 자주 조회하는 컬럼에 반드시 인덱스 추가

## 7. WebSocket 규칙

- 메시지 포맷: `{ type: string, payload: unknown, timestamp: string }`
- 이벤트 타입: `도메인:액션` 형식 (예: `agent:status`, `chat:message`)
- 자동 재연결: exponential backoff (1초 ~ 30초)
- 클라이언트: `src/lib/ws.ts` 단일 인스턴스 사용

## 8. 보안 규칙

- API 키: AES-256-GCM 암호화 저장
- JWT: 7일 만료, 자동 갱신
- 비밀번호: bcrypt 해싱 (salt rounds: 12)
- 환경변수: `.env.local`에 민감 정보 저장
- CORS: localhost만 허용 (Phase A)

## 9. 성능 규칙

- 메인 번들: React, Zustand, Tailwind, shadcn/ui, 4-column dashboard, chat
- 터미널 번들: xterm.js + addons (AgentModal CLI tab lazy load)
- 차트 번들: 차트 라이브러리 (Resources 페이지 진입 시 lazy load)
- 노트 뷰어 번들: 마크다운 렌더러 (note tab/page lazy load)
- 코드 분할: `React.lazy` + `Suspense` 사용

## 10. 코드 품질

- ESLint + Prettier 적용
- import 정렬: 외부 패키지 > 내부 모듈 > 상대 경로
- 콘솔 로그: 개발 환경에서만 허용 (`console.error`는 예외)
- 주석: 복잡한 로직에만 Why 주석 작성
- 커밋 메시지: Conventional Commits 형식

## 11. Backend Engine Rules

### Agent Manager (child_process.spawn)
- 에이전트 실행: `child_process.spawn('claude', ['--print', '--output-format', 'stream-json', '-p', prompt])`
- 에이전트 통신: stdout JSON 라인 파싱, 구조화된 이벤트 처리
- node-pty: CLI 탭 (터미널 디버깅) 전용 -- 채팅/명령 통신에 사용하지 않음
- 타임아웃: 기본 10분, 장시간 작업은 checkpoint로 분할

### 에이전트 계층별 CLI 사용
- **Main**: CLI 대화 O — PMO (부서/프로젝트 구성, 일정/리포트)
- **Part**: CLI 대화 X — 스킬 그룹 (DB 레코드, 에이전트 아님)
- **Sub**: CLI 대화 O — 프로젝트 관리+수행 (사용자와 직접 대화)
- **Instance**: CLI 대화 X — Sub 내부 자동실행 (진행 상태, AI 모델 표시)
- Part 생성 시 에이전트 레코드 생성 금지 (parts 테이블만 사용)

### Orchestrator
- `.orchestrator/` folder structure: `{partId}/sub-contexts/`, `decisions/`, `progress/`, `main-context.md`
- Sub Skill 파일: `.orchestrator/{partId}/sub-contexts/{subId}.md`

### Checkpoint System
- 체크포인트 저장: 작업 단계 완료 시 자동 저장
- 에이전트당 최대 3개 유지, 오래된 것 자동 삭제
- 복구: 재시작 시 최신 체크포인트에서 컨텍스트 복원

### Execution Queue
- 4단계 우선순위: urgent > high > normal > low
- 동시 실행 제한: settings 테이블의 max_concurrent_agents 값 사용
- urgent 진입 시 low 작업 일시 중지 가능

### Message Queue
- 상태 흐름: created -> sent -> delivered -> processed
- 미전달 메시지 30초 후 자동 재전송 (최대 3회)
- processed/failed 상태 7일 후 자동 삭제

### Skill System
- Main Skill: `src/skills/main-agent.md` — Main 에이전트 시스템 프롬프트
- Sub Skill: CLAUDE.md 형식, Main과 사용자가 대화로 작성 → Sub 생성 시 주입
- Skill Loader: `src/lib/skill-loader.ts` — loadMainSkill(), parseActions()
- 액션 포맷: `<<ACTION:TYPE>>{ json }<<END_ACTION>>` — 채팅 응답에서 파싱 후 서버사이드 실행
- 지원 액션: CREATE_PART, CREATE_SUB

### Skill Engine (bash, legacy)
- Skills directory: `$CLAUDEMANAGER_HOME/skills/`
- Entry modes: `bash skill.sh schema` (JSON output) and `bash skill.sh execute '{json}'`
- SKILL_DIR env var for inheritance (`source "$SKILL_DIR/base-part.sh"`)
- Default skills: `base-part.sh`, `project-part.sh`
- Version lock: `skill-version.lock` per Part directory

### WebSocket Bridge
- WS server runs separately from Next.js on port 3001
- API routes broadcast via `src/lib/ws-bridge.ts` (HTTP POST to `/_broadcast`)
- Fire-and-forget: broadcast failures never break API routes
- Internal auth: `x-ws-secret` header
- All S-to-C events routed through `broadcast()` function

### Terminal
- node-pty preferred, child_process fallback when native build fails
- One terminal session per agent (disconnect old before connecting new)
- Terminal session IDs: `term-{agentId}-{timestamp}`
- CLI tab only -- not for agent communication

## 12. UI 컴포넌트 규칙

### 공용 카드 컴포넌트
- 카드 컴포넌트: `src/components/workspace/cards.tsx`에 모든 카드 정의
- 디자인 상수: `CARD_HEIGHT(96)`, `CARD_RADIUS(14)`, `CARD_PADDING(14)`, `ICON_SIZE(36)`
- CardShell: 모든 카드의 공통 래퍼 (높이, 패딩, 테두리, 그림자, 색상 바 통일)
- 인라인 카드 정의 금지 — 반드시 cards.tsx에서 import하여 사용
- 카드 종류: MainAgentCard(다크), PartCard, AgentCard(Sub/Instance), TaskCard

### 컬럼 레이아웃
- ColumnHeader: 고정 높이 36px (showAdd 버튼 유무와 무관)
- ColumnEmpty: 빈 상태 안내 (HTML dangerouslySetInnerHTML 사용)

### ApiClient HTTP 메서드
- `apiClient.get()` — GET
- `apiClient.post()` — POST
- `apiClient.put()` — PUT
- `apiClient.patch()` — PATCH
- `apiClient.del()` — DELETE (delete는 JS 예약어이므로 `del` 사용)
