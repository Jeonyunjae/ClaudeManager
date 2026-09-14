# 기술 결정 사항
> ✏️ 작성 완료 후 CLI에서 **"기술 결정 완료"** 입력

---

## 1. 플랫폼
- [x] 웹 (반응형 — 데스크톱 주, 모바일 보조)

## 2. 프로그래밍 언어
- 프론트엔드: TypeScript
- 백엔드: TypeScript (Node.js)
- Skill 스크립트: Bash

## 3. 프레임워크
- 프론트엔드: Next.js 14+ (App Router)
- 백엔드: Next.js API Routes + 별도 WebSocket 서버 (ws)
- 상태 관리: Zustand (가볍고 심플)
- CSS: Tailwind CSS + shadcn/ui (데이터 뷰, 설정 등 일반 UI)

## 4. 데이터베이스
- 종류: PostgreSQL (로컬 설치, port 5434)
- ORM: Drizzle ORM (drizzle-orm/pg-core, 타입 안전)
- 드라이버: node-postgres (pg)
- 호스팅: 로컬 PostgreSQL (`postgresql://claudemanager:claudemanager@localhost:5434/claudemanager`)
- 마이그레이션: Drizzle Kit

## 5. 서버 / 인프라
- [x] 직접 (MacBook → Mac Mini Pro)
- 프로세스 관리: PM2 + macOS launchd
- 리버스 프록시: Caddy (Phase B, 외부 접근 시)
- 외부 접근: Cloudflare Tunnel (Phase B에서 결정)

## 6. 인증
- [x] JWT (단순 토큰 기반)
- 1인 사용자이므로 간단하게:
  - 최초 설정 시 비밀번호 1개 등록
  - 로그인 → JWT 발급 → 이후 토큰 인증
  - 토큰 만료: 7일 (자동 갱신)
  - API 키 암호화: AES-256-GCM (환경변수로 마스터 키 관리)

## 7. 실시간 통신
- WebSocket: ws (Node.js 네이티브, Socket.io보다 가벼움)
- 용도: 에이전트 상태 업데이트, 터미널 릴레이, 알림, 채팅
- 재연결: 자동 재연결 (exponential backoff)
- 프로토콜: JSON 메시지 (type + payload 구조)

## 8. 대시보드 UI 스타일 (데스크톱 전용)

> ⚠️ **변경 이력 (2026-04-16):** 기존 3D 워크스페이스(Three.js + R3F) 방식은 **폐기**.
> SugarCRM Customer Journey 스타일 **플랫 대시보드**로 전환 확정.

### UI 패턴: SugarCRM 4컬럼 플로우
- **레이아웃**: Main → Part → Sub → Instance 4컬럼 카드 플로우
- **TopNav**: SugarCRM pill-tab 스타일 (active = #10141A 다크 필, inactive = 텍스트만)
- **콘텐츠 영역**: Content Card (#F3F5F7, border-radius 20px) on Page BG (#E8ECEF)
- **인터랙션**: Part 클릭 → Sub 필터링 → Instance 필터링 (계층적 드릴다운)
- **노트 탭**: 옵시디언 스타일 폴더 트리 + 마크다운 렌더링

### 디자인 토큰
- Page BG: `#E8ECEF`
- Content Card BG: `#F3F5F7`
- Dark elements: `#10141A`
- Accent Purple: `#7C5CFC`
- Border: `#E5E7EB`

### 레퍼런스
- **SugarCRM Customer Journey CRM Dashboard** — 컬럼 플로우, pill-tab 네비게이션
- **Obsidian** — 노트 탭 폴더 트리 + 마크다운 렌더링

## 9. 터미널 렌더링 (CLI 탭 전용)
- xterm.js + @xterm/addon-fit (터미널 크기 자동 조정)
- node-pty (서버 측 PTY 할당)
- WebSocket으로 stdin/stdout 양방향 릴레이
- 팝업 모달 내 CLI 탭에서 렌더링
- **용도:** 개발자용 디버깅 터미널 — 에이전트의 실제 CLI 화면을 직접 확인
- **주의:** 에이전트 통신(채팅/명령)은 node-pty가 아닌 `child_process.spawn` + JSON 모드 사용 (14번 참고)

## 10. 채팅 UI
- 직접 구현 (React 컴포넌트)
  - 외부 라이브러리 불필요한 수준의 심플한 채팅 구조
  - 메시지 목록 + 입력창 + 타이핑 인디케이터
- 메시지 저장: PostgreSQL (채팅 이력 DB 저장)
- 실시간: WebSocket으로 Main ↔ 웹앱 메시지 전달
- 마크다운 지원: 보고 내용에 코드블록, 테이블 등 포함 가능

## 11. 마크다운 렌더링 (리포트/노트 뷰)
- react-markdown + remark-gfm (GFM 테이블, 체크박스 지원)
- rehype-highlight (코드 구문 강조)
- `.orchestrator/` 노트를 파싱하여 리포트 뷰에 렌더링

## 12. 파일 감시
- chokidar: `.orchestrator/` 폴더 변경 감지
- 변경 감지 → DB 동기화 + WebSocket으로 클라이언트에 푸시

## 13. 태스크 관리
- 별도 작업 큐(BullMQ/Redis) 사용하지 않음
- 노트 기반 상태 관리 + Hooks + PM2로 대체:
  - 태스크 순서: 오케스트레이터가 `.orchestrator/` 노트를 읽고 판단
  - 재시도: Hooks 이벤트 + 노트 상태 기반으로 관리
  - 프로세스 복구: PM2 자동 재시작 + 노트 기반 컨텍스트 복구
- 에이전트 규모가 커지면 Phase 2에서 작업 큐 도입 검토

## 14. 에이전트 실행 모델 (핵심 아키텍처 결정)

> ⚠️ **최중요 결정 (2026-04-16 확정)**
> Claude API(토큰당 과금)는 사용하지 않는다. 비용 문제.
> 모든 에이전트는 **Claude Code CLI(구독제)** 로 실행한다.

### Claude API vs Claude Code CLI

| 구분 | Claude API | Claude Code CLI |
|------|-----------|-----------------|
| 과금 | 토큰당 과금 (input/output) | 월 구독 정액 (Pro/Max) |
| 실행 | HTTP API 호출 | 터미널 프로세스 (CLI) |
| 도구 | Tool Use 직접 정의 필요 | 파일 R/W, Bash, Agent 등 내장 |
| 에이전트 생성 | 직접 구현 필요 | `Agent` 도구로 서브에이전트 즉시 생성 |
| 비용 예측 | 사용량에 비례 (예측 어려움) | 월 고정 (예측 가능) |
| **판정** | **미채택** | **채택** |

### 웹 서버 ↔ CLI 통신 구조

> ⚠️ **핵심 결정 (2026-04-16 확정)**
> node-pty(터미널 에뮬레이션)는 CLI 탭 전용.
> 채팅/명령 통신은 **child_process.spawn + JSON 모드**로 처리한다.

#### 통신 방식 비교

| 방식 | 설명 | 문제점 | 판정 |
|------|------|--------|------|
| **node-pty** | 터미널 화면 재현 (ANSI 코드 포함) | 색상·커서 코드 파싱 필요, 비효율 | CLI 탭 전용 |
| **child_process.spawn** | Node.js 기본 내장 프로그램 실행기 | 없음 (설치 불필요) | **채택** |
| Claude Code SDK | Node.js 라이브러리 직접 호출 | API 과금 방식 | 미채택 |

#### 용도별 통신 분리

| 용도 | 방식 | 이유 |
|------|------|------|
| **사용자 ↔ Main 대화** | `child_process.spawn` + `--print --output-format stream-json` | 구조화된 JSON 응답, 파싱 쉬움 |
| **명령 실행 / 태스크** | `child_process.spawn` + `--print --output-format stream-json` | 결과를 JSON으로 받아 DB 저장 |
| **CLI 탭 (디버깅)** | `node-pty` + xterm.js | 실시간 터미널 직접 보기 (개발자용) |
| **서브에이전트 생성** | Main이 `--print` 모드로 서브 CLI 실행 | 에이전트 간 통신도 JSON |

#### 전체 통신 흐름

```
┌─────────────┐   WebSocket    ┌──────────────┐  child_process    ┌──────────────────────┐
│  브라우저    │ ◄───────────► │  Next.js     │ ◄───────────────► │  claude --print      │
│  (채팅 UI)  │  JSON 전달     │  서버        │  spawn + JSON     │  --output-format     │
└─────────────┘                └──────────────┘  stream            │  stream-json         │
                                                                   └──────────────────────┘
```

```
1. 사용자가 채팅에서 "개발 파트 만들어줘" 입력
         ↓
2. 브라우저 → WebSocket → Next.js 서버
         ↓
3. Next.js 서버 → child_process.spawn으로 CLI 실행
   spawn('claude', ['--print', '--output-format', 'stream-json'])
   stdin에 사용자 메시지 전달
         ↓
4. Claude Code CLI가 처리 → JSON 스트림으로 응답
   stdout: {"type":"assistant","message":"Dev Part를 생성합니다..."}
   stdout: {"type":"tool_use","tool":"Write","path":"skills/dev-part.md"}
   stdout: {"type":"result","content":"Dev Part 생성 완료"}
         ↓
5. Next.js 서버 → JSON 파싱 → WebSocket → 브라우저에 표시
```

#### child_process.spawn 설명

Node.js 기본 내장 기능으로, **코드 안에서 터미널 명령어를 실행**하는 것이다.
별도 설치 불필요 (Node.js 자체 제공).

```typescript
import { spawn } from 'child_process';  // Node.js 기본 모듈

// Claude Code CLI를 JSON 모드로 실행
const agent = spawn('claude', [
  '--print',
  '--output-format', 'stream-json'
]);

// 사용자 메시지 전달 (stdin)
agent.stdin.write('개발 파트 만들어줘\n');
agent.stdin.end();

// Claude 응답 수신 (stdout) — 순수 JSON, ANSI 코드 없음
agent.stdout.on('data', (data) => {
  const response = JSON.parse(data.toString());
  // → { type: "result", content: "Dev Part 생성 완료" }
  // → WebSocket으로 브라우저에 전달
});
```

### 에이전트 실행 구조

```
사용자 → YJ Manager (웹 UI)
              ↓ WebSocket
         Next.js 서버
              ↓ child_process.spawn (JSON 모드)
         Main (Claude Code CLI)
              ↓ Agent 도구 / 서브프로세스 생성
         Part (Claude Code 서브에이전트)
              ↓
         Sub / Instance (Claude Code 서브에이전트)
```

### 계층별 실행 방식

| 계층 | 실행 방식 | 생명 주기 |
|------|----------|-----------|
| **Main** | tmux 세션에서 Claude Code CLI 상시 실행 | 서버 시작 ~ 종료 (PM2 관리) |
| **Part** | Main이 Agent 도구로 생성하는 서브에이전트 | 태스크 단위 (생성 → 완료 → 종료) |
| **Sub** | Part가 Agent 도구로 생성하는 서브에이전트 | 프로젝트 단위 |
| **Instance** | Sub가 Agent 도구로 생성하는 서브에이전트 | 작업 단위 (가장 짧은 생명 주기) |

### Skill = 에이전트 지시서

Skill은 Claude Code CLI에 전달하는 **시스템 프롬프트 + 도구 권한 설정**이다:

```bash
# 예시: Dev Part Skill
claude --print --output-format stream-json \
       --system-prompt "$(cat skills/dev-part.md)" \
       --allowedTools "Read,Write,Edit,Bash,Agent" \
       --workdir "/project/workspace"
```

Skill 파일(`.md`)에 역할, 규칙, 사용 도구, 작업 범위를 정의.
Main과 대화를 통해 Skill을 생성/수정하고, 파일로 저장 후 에이전트에 적용.

### 비용 관리

- Claude API를 사용하지 않으므로 **토큰 비용 = 0**
- 비용 = Claude Code 구독료 (월 고정)
- Resources 페이지의 비용 대시보드는 **구독 플랜 대비 사용량** 모니터링 용도로 변경
- 과도한 사용 시 Rate Limit은 Anthropic 측에서 자동 관리

### 기존 LiteLLM (AI Gateway) — 폐기

> ~~LiteLLM: 프록시 모드로 실행 (localhost:4000)~~
> ~~모든 모델 호출은 LiteLLM 경유~~
>
> **폐기 사유:** Claude API를 사용하지 않으므로 API 프록시 불필요.
> Claude Code CLI가 직접 Anthropic 서버와 통신하며, 구독 요금 내에서 처리된다.

## 15. 안정성 설계 (Reliability)

> 멀티 에이전트 시스템에서 발생할 수 있는 7가지 불안정 포인트와 대응 방안.
> 모든 대응은 현재 기술 스택(Claude Code CLI + child_process.spawn + tmux + PostgreSQL) 내에서 구현.

### 15-1. 프로세스 장애 복구

**문제:** Main이 작업 중 갑자기 종료 → 하위 Part/Sub/Instance 전부 고아 상태

**대응:**

| 계층 | 보호 장치 | 동작 |
|------|----------|------|
| Main | PM2 프로세스 관리 | 비정상 종료 감지 → 자동 재시작 (max 5회/10분) |
| Main | tmux 세션 유지 | 프로세스 죽어도 세션은 살아있음 → 재연결 가능 |
| 전체 | 체크포인트 시스템 | 각 작업 단계 완료 시 `.orchestrator/checkpoint.json`에 상태 저장 |
| 전체 | DB 상태 동기화 | `agents` 테이블에 `last_checkpoint`, `last_active_at` 기록 |

**체크포인트 구조:**
```json
{
  "agent_id": "main",
  "timestamp": "2026-04-16T14:30:00Z",
  "state": "working",
  "current_task": "Dev Part 프론트엔드 작업 감독",
  "completed": ["Part 생성", "Skill 적용", "Sub 3개 생성"],
  "pending": ["프론트엔드 대시보드 검수", "백엔드 API 테스트"],
  "context_summary": "프로젝트 진행률 60%. Frontend Sub 작업 중..."
}
```

**재시작 시 복구 흐름:**
```
1. PM2가 Main 재시작
2. Main CLI 시작 시 --system-prompt에 체크포인트 내용 주입
3. "이전 작업 이어서 진행" 모드로 시작
4. 고아 상태 하위 에이전트 탐색 → 재연결 또는 정리
```

### 15-2. 메시지 유실 방지

**문제:** Main → Part로 지시를 보냈는데 Part가 못 받음

**대응:**
- 모든 지시/보고를 **DB에 먼저 저장** 후 전달 (Write-Ahead)
- 메시지 상태 추적:

```
messages 테이블:
┌────┬──────────┬──────────┬───────────┬───────────┐
│ id │ from     │ to       │ content   │ status    │
├────┼──────────┼──────────┼───────────┼───────────┤
│ 1  │ main     │ dev-part │ "FE 작업" │ delivered │
│ 2  │ main     │ qa-part  │ "테스트"  │ sent      │  ← 아직 미전달
│ 3  │ dev-part │ main     │ "완료"    │ processed │
└────┴──────────┴──────────┴───────────┴───────────┘
```

- 상태 흐름: `created → sent → delivered → processed`
- `sent` 상태에서 **30초 이내** `delivered` 안 되면 자동 재전송 (최대 3회)
- 웹 UI 대시보드에 "전달 실패" 표시 + 수동 재전송 버튼

### 15-3. 결과물 검증

**문제:** 에이전트가 엉뚱한 결과를 낸다 ("로그인 만들어줘" → 회원가입을 만듦)

**대응:**
- Skill에 **작업 범위 제한** 명시:

```markdown
# Skill: Frontend Developer
## 허용 범위
- 작업 디렉토리: src/components/, src/app/
- 허용 명령어: pnpm, next, tsc
- 금지: rm -rf, git push, DB 직접 접근

## 완료 조건
- 파일이 실제로 생성/수정되었는지 확인
- `pnpm build` 성공 여부 확인
- 변경 파일 목록 보고 필수
```

- 자동 검증 단계 (에이전트 작업 완료 시):

| 검증 항목 | 방법 | 실패 시 |
|-----------|------|---------|
| 파일 존재 확인 | `fs.existsSync()` | 재작업 지시 |
| 빌드 성공 | `pnpm build` 실행 | 에러 로그 포함 재작업 |
| 테스트 통과 | `pnpm test` 실행 | 실패 항목 포함 재작업 |
| Skill 범위 준수 | 변경 파일 경로 검증 | 범위 외 변경 롤백 |

- **Human-in-the-Loop**: 주요 결과물(Part 생성, 프로젝트 완료 등)은 사용자 승인 후 다음 단계 진행

### 15-4. 컨텍스트 보존

**문제:** CLI 재시작 → 이전 대화 내용 모두 소실 → 처음부터 다시

**대응:**
- 3중 컨텍스트 보존:

| 보존 방법 | 저장 위치 | 용도 |
|-----------|----------|------|
| **CLAUDE.md** | 프로젝트 루트 | 프로젝트 전체 맥락 (영구) |
| **체크포인트 노트** | `.orchestrator/checkpoint.json` | 현재 작업 상태 (작업 단위) |
| **DB 대화 이력** | `messages` 테이블 | 전체 대화 기록 (영구) |

- 재시작 시 주입 순서:
```
1. CLAUDE.md (프로젝트 맥락)
2. 체크포인트 (마지막 작업 상태)
3. 최근 대화 N건 (직전 컨텍스트)
→ --system-prompt에 통합하여 CLI에 전달
```

### 15-5. 파일 충돌 방지

**문제:** 여러 에이전트가 같은 파일을 동시에 수정 → 충돌

**대응:**
- **워크스페이스 분리 원칙:**

```
project/
├── workspace/           ← Main 관리 영역
│   ├── .orchestrator/   ← Main 전용 (노트, 체크포인트)
│   ├── src/
│   │   ├── frontend/    ← Frontend Sub 전용
│   │   ├── backend/     ← Backend Sub 전용
│   │   └── shared/      ← Main 경유로만 수정 가능
│   └── package.json     ← Main 경유로만 수정 가능
```

- **공유 파일 수정 규칙:**
  - 공유 파일(`package.json`, `tsconfig.json` 등)은 **Main/Part를 경유**해서만 수정
  - 하위 에이전트가 직접 수정 금지 → Skill에 제한 명시
  - 필요 시 Main에게 수정 요청 보고 → Main이 단일 지점에서 수정

- **git worktree 활용 (Phase 2):**
  - 각 Sub가 별도 브랜치에서 작업
  - 완료 시 Main이 merge 검토 → 충돌 해결 → 병합

### 15-6. 에러 격리 (연쇄 실패 방지)

**문제:** Instance 실패 → Sub 실패 → Part 실패 → Main 전체 중단

**대응:**
- **프로세스 수준 격리**: 각 에이전트가 독립 프로세스 → 하위 장애가 상위를 죽이지 않음
- **에러 처리 계층:**

```
Instance 실패
  → Sub가 받음: 재시도 (최대 3회)
    → 재시도 실패: Part에 에러 보고
      → Part가 판단: 다른 Instance로 재할당 or 우회
        → 우회 실패: Main에 에스컬레이션
          → Main: 사용자에게 알림 + 수동 개입 요청
```

- **에러 보고 구조:**
```json
{
  "error_id": "err-001",
  "agent": "frontend-instance-1",
  "type": "build_failure",
  "message": "pnpm build failed: Module not found",
  "retry_count": 3,
  "escalated_to": "dev-part",
  "user_action_required": false
}
```

- **차단벽 (Bulkhead) 패턴:**
  - Part 간 완전 독립: Dev Part 실패해도 QA Part는 영향 없음
  - Sub 간 독립: Frontend 실패해도 Backend는 계속 작업

### 15-7. Rate Limit 관리

**문제:** 에이전트 5개가 동시에 Claude 호출 → Rate Limit → 전부 멈춤

**대응:**
- **동시 실행 제한:**

| 설정 항목 | 기본값 | 설정 위치 |
|-----------|--------|----------|
| 동시 활성 에이전트 수 | 3개 | Settings > Global Settings |
| Part당 최대 Sub 수 | 3개 | Settings > Part Policies |
| 에이전트 간 실행 간격 | 5초 | Settings > Global Settings |

- **실행 큐 (우선순위 기반):**
```
실행 대기열:
┌──────────────────────────────────────────────────────┐
│ [실행 중] Agent-1 🔴, Agent-2 🟠, Agent-3 🔵        │
│ [대기]    Agent-4 🟠 (예상 대기: 2분)  ← 높은 순위  │
│ [대기]    Agent-5 🔵 (예상 대기: 5분)                │
│ [대기]    Agent-6 ⚪ (예상 대기: 10분) ← 낮은 순위  │
└──────────────────────────────────────────────────────┘
```
  - **우선순위 순서**로 실행: 🔴 Urgent > 🟠 High > 🔵 Normal > ⚪ Low
  - 동일 우선순위 내에서는 FIFO (먼저 요청한 순)
  - 🔴 Urgent 업무 진입 시 ⚪ Low 에이전트를 일시 중지하고 먼저 실행 가능
  - 대시보드에 실행/대기 상태 + 우선순위 실시간 표시

- **Rate Limit 감지 시:**
  - Claude Code CLI가 429 에러 반환 → 자동 대기
  - exponential backoff: 30초 → 60초 → 120초
  - 3회 연속 Rate Limit → 모든 에이전트 일시 정지 + 사용자 알림
  - 대시보드에 "Rate Limit 상태" 경고 표시

## 16. 세션 관리
- tmux: 에이전트별 세션 분리
- tmux 명령: Node.js child_process로 실행
- 세션 목록/상태: `tmux list-sessions` 파싱

## 16. 알림
- 브라우저 푸시: Web Push API (service worker)
- 모바일: 동일한 Web Push (PWA 지원)
- 대시보드 내 알림: WebSocket 실시간 전달

## 17. 재시도 정책 기본값
- 기본 재시도 횟수: 3회
- 재시도 간격: 지수 백오프 (10초, 30초, 90초)
- Part별 오버라이드 가능 (설정 UI에서 변경)
- 모든 재시도 실패 시: 에이전트 정지 + 대표 알림

## 18. 백업
- PostgreSQL: 일 1회 자동 백업 (`pg_dump` 사용)
- `.orchestrator/`: git 기반 자동 커밋 (일 1회) 또는 rsync
- 백업 경로: `$CLAUDEMANAGER_HOME/backups/`
- 보관 기간: 최근 30일

## 19. 배포
- Phase A: `npm run dev` 또는 `npm run build && npm start` (로컬)
- Phase B: PM2로 프로세스 관리 + Caddy 리버스 프록시 + Cloudflare Tunnel (외부 접근)
- Vercel 사용하지 않음 — 백엔드/DB/tmux 모두 로컬 필수이므로 로컬 배포 전용

## 20. 개발 환경
- Node.js: 20 LTS
- 패키지 매니저: pnpm
- 린터: ESLint + Prettier
- 테스트: Vitest (유닛) + Playwright (E2E)
- 모노레포: 단일 레포 (apps/ 분리 불필요, 규모가 작으므로)
