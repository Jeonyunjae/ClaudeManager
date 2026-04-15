# 코딩 규칙
> 작성: developer | 상태: 작성 완료

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
- `React.lazy` + `Suspense`: 3D, 터미널, 차트 번들 지연 로딩

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

- 3D 번들: 데스크톱(1024px+)에서만 dynamic import
- 모바일: 3D 번들 로딩 자체를 하지 않음
- 이미지/모델: Draco 압축 `.glb` 사용
- GPU 인스턴싱: 동일 모델 에이전트는 `InstancedMesh`
- 코드 분할: 터미널(xterm.js), 차트 라이브러리 lazy load

## 10. 코드 품질

- ESLint + Prettier 적용
- import 정렬: 외부 패키지 > 내부 모듈 > 상대 경로
- 콘솔 로그: 개발 환경에서만 허용 (`console.error`는 예외)
- 주석: 복잡한 로직에만 Why 주석 작성
- 커밋 메시지: Conventional Commits 형식
