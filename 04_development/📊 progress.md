# 개발 현황
> 작성: developer | 상태: Phase 5 PostgreSQL 마이그레이션 + 비동기 채팅 + UI 개선 완료
> 빌드 결과: SUCCESS (Next.js 16.2.3, Turbopack)

---

## Phase 5 PostgreSQL 마이그레이션 + 비동기 채팅 아키텍처 (2026-04-27)

### 변경 요약
1. **SQLite → PostgreSQL 마이그레이션**: better-sqlite3 제거, node-postgres + Drizzle ORM pg-core 전환 (port 5433)
2. **비동기 채팅 아키텍처**: cli-executor.ts로 WS 서버 내 비동기 CLI 처리, 에이전트별 병렬 채팅 지원
3. **Terminal.app 연동**: node-pty/xterm.js 제거, osascript로 macOS Terminal.app에서 `claude --resume` 실행
4. **알림 드롭다운 구현**: TopNav 벨 아이콘에 읽지 않은 알림 드롭다운 연결 (미읽음만 표시, 전체 읽음, 클릭 시 이동)
5. **에이전트별 채팅 스트리밍**: `chat:stream` WebSocket 이벤트로 에이전트별 실시간 응답
6. **실시간 카드 상태 반영**: WebSocket으로 에이전트 상태 변경 시 카드 UI 즉시 업데이트
7. **Docker Compose 추가**: PostgreSQL 컨테이너 구성 (port 5433, volume 영속)

### 신규 파일
| 카테고리 | 파일 | 설명 |
|---|---|---|
| Core lib | src/lib/cli-executor.ts | 비동기 CLI 실행기 (WS 서버 프로세스 내) |
| Core lib | src/lib/ws-bridge.ts | WebSocket 서버 브릿지 |
| Server | src/server/ws-server.ts | WebSocket 서버 (custom server) |
| API route | src/app/api/agents/[id]/open-terminal/route.ts | Terminal.app 열기 (osascript) |
| Infra | docker-compose.yml | PostgreSQL 컨테이너 |

### 변경된 파일
| 파일 | 변경 내용 |
|---|---|
| src/lib/schema.ts | sqliteTable → pgTable, autoIncrement → serial, real → doublePrecision, integer(boolean) → boolean |
| src/lib/db.ts | better-sqlite3 → node-postgres (Pool, port 5433) |
| src/lib/agent-manager.ts | 비동기 채팅 로직 추가, cli-executor 연동 |
| src/stores/agentStore.ts | WebSocket 이벤트로 실시간 카드 상태 업데이트 |
| src/stores/agentDetailStore.ts | sendingAgents: Set<string> 추가 (에이전트별 병렬 전송) |
| src/hooks/useWebSocket.ts | chat:stream, notification:new 이벤트 핸들링 |
| src/components/layout/TopNav.tsx | 알림 드롭다운 구현 (미읽음만, markAllRead, 클릭 이동) |
| src/components/workspace/cards.tsx | 실시간 상태 배지 업데이트 |
| src/components/workspace/AgentDetailPopup.tsx | 에이전트별 채팅 탭 + Terminal.app 열기 버튼 |
| src/components/workspace/WorkspaceLayout.tsx | 실시간 카드 상태 연동 |
| src/app/globals.css | 신규 CSS 토큰 추가 |
| src/instrumentation.ts | PostgreSQL 연결 + WS 서버 초기화 |
| package.json | better-sqlite3 제거, pg + @types/pg 추가 |

### 삭제된 파일/의존성
| 항목 | 사유 |
|---|---|
| better-sqlite3, @types/better-sqlite3 | PostgreSQL로 마이그레이션 |
| drizzle-orm/better-sqlite3 | drizzle-orm/node-postgres로 전환 |
| node-pty (미사용) | Terminal.app 방식으로 전환 |
| xterm.js (미사용) | Terminal.app 방식으로 전환 |

### 검증 결과
- `pnpm build`: SUCCESS
- PostgreSQL 연결: docker-compose up → DB 정상 접속
- 알림 드롭다운: 미읽음 표시, 전체 읽음, 클릭 이동 정상
- Terminal.app: osascript로 Terminal.app 열기 정상

---

## Phase 4 UI 컴포넌트 리팩토링 + 액션 연결 (2026-04-18)

### 변경 요약
1. **공용 카드 컴포넌트 분리**: WorkspaceLayout 내 인라인 카드 정의 → `cards.tsx` 공용 컴포넌트로 추출
2. **카드 사이즈 통일**: 모든 카드 높이 96px, 패딩 14px, borderRadius 14px (디자인 상수 일원화)
3. **컬럼 헤더 높이 통일**: ColumnHeader에 `height: 36` 고정 (showAdd 버튼 유무와 무관하게 동일)
4. **에이전트 액션 버튼 연결**: 재시작/정지/삭제 버튼에 onClick 핸들러 연결 (API 호출 + 트리 갱신)
5. **ApiClient patch 메서드 추가**: PATCH HTTP 메서드 지원

### 신규 파일
| 카테고리 | 파일 | 설명 |
|---|---|---|
| Component | src/components/workspace/cards.tsx | 공용 카드 컴포넌트 (StatusDot, StatusBadge, CardShell, CardIcon, CardHeader, MainAgentCard, PartCard, AgentCard, TaskCard, ColumnHeader, ColumnEmpty) |

### 변경된 파일
| 파일 | 변경 내용 |
|---|---|
| src/components/workspace/WorkspaceLayout.tsx | 인라인 카드 컴포넌트 삭제 (~250줄), cards.tsx import 사용, Main/Part/Sub/Instance 카드 공용 컴포넌트로 교체 |
| src/components/workspace/AgentDetailPopup.tsx | 재시작/정지/삭제 버튼에 handleAction() 연결, 로딩 상태 표시, 삭제 시 confirm 확인 |
| src/lib/api.ts | ApiClient.patch() 메서드 추가 |

### 카드 컴포넌트 구조
```
cards.tsx
├── 디자인 상수: CARD_HEIGHT(96), CARD_RADIUS(14), CARD_PADDING(14), ICON_SIZE(36), FONT
├── 내부 컴포넌트: StatusBadge, CardShell, CardIcon, CardHeader
└── 공용 컴포넌트 (export):
    ├── StatusDot — 상태 표시 점
    ├── MainAgentCard — Main 에이전트 (다크 테마)
    ├── PartCard — Part 스킬 그룹
    ├── AgentCard — Sub/Instance 에이전트
    ├── TaskCard — 태스크 카드 (승인 배지 포함)
    ├── ColumnHeader — 컬럼 제목 + 카운트 + 추가 버튼
    └── ColumnEmpty — 빈 상태 안내
```

### 에이전트 액션 동작
| 버튼 | API | 동작 |
|------|-----|------|
| 재시작 | `PATCH /api/agents/{id}` `{ action: "restart" }` | tmux 세션 재생성 → DB status "active" → 트리 갱신 → 팝업 정보 새로고침 |
| 정지 | `PATCH /api/agents/{id}` `{ action: "stop" }` | tmux 종료 → DB status "stopped" → 트리 갱신 → 팝업 정보 새로고침 |
| 삭제 | `DELETE /api/agents/{id}` | confirm 확인 → tmux 종료 → DB 삭제 → 팝업 닫기 → 트리 갱신 |

### 검증 결과
- `pnpm build`: SUCCESS
- 서버 접속: http://localhost:3000 정상 동작
- 카드 사이즈: Main/Part/Sub/Instance 동일 높이 통일
- 컬럼 헤더: 4개 컬럼 동일 높이 정렬

---

## Phase 3 에이전트 역할 재정의 + 실데이터 전환 (2026-04-18)

### 변경 요약
1. **에이전트 4계층 역할 확정**: Main/Sub만 CLI 대화, Part는 스킬 그룹, Instance는 상태 표시 전용
2. **Part 에이전트 제거**: Part는 DB 레코드(스킬 그룹)일 뿐, 에이전트 아님. Part Agent 생성 코드 전면 삭제
3. **Mock 데이터 전면 제거**: agentStore, partStore, approvalStore, audit/errors/approvals 페이지의 목 데이터 삭제
4. **Main Skill 시스템**: main-agent.md 스킬 파일 + skill-loader.ts로 Main 에이전트에 시스템 프롬프트 주입
5. **채팅 기반 액션 실행**: `<<ACTION:CREATE_PART>>` / `<<ACTION:CREATE_SUB>>` 파싱 → 서버사이드 실행
6. **다크 테마 구현**: CSS 변수 + `[data-theme="dark"]` + useTheme 훅 (Light/Dark/System)
7. **백업/복구 기능 삭제**: Settings에서 Backup 탭 제거, API 라우트 삭제
8. **AgentDetailPopup 역할별 탭**: Part/Instance → info+log만, Main/Sub → 전체 탭(info/cli/chat/log/note)

### 에이전트 계층 구조 (확정)
| 레벨 | CLI 대화 | 용도 |
|------|---------|------|
| Main | O | PMO — 부서/프로젝트 구성, 일정/리포트 |
| Part | X | 스킬 그룹 — 스킬 정보, 업무 잔여량 표시 |
| Sub | O | 프로젝트 관리+수행 — 사용자와 직접 대화 |
| Instance | X | Sub 내부 자동실행 — 진행 상태, AI 모델 표시 |

### 신규 파일
| 카테고리 | 파일 | 설명 |
|---|---|---|
| Skill | src/skills/main-agent.md | Main 에이전트 시스템 프롬프트 (PMO 역할, 액션 포맷 정의) |
| Core lib | src/lib/skill-loader.ts | Skill 파일 로더 + 액션 파서 (`<<ACTION:TYPE>>`) |
| Hook | src/hooks/useTheme.ts | Light/Dark/System 테마 훅 (localStorage 영속) |
| API route | src/app/api/agents/init-main/route.ts | Main 에이전트 자동 등록 (없으면 생성) |

### 변경된 파일
| 파일 | 변경 내용 |
|---|---|
| src/app/api/agents/[id]/chat/route.ts | Main Skill 시스템 프롬프트 주입, 액션 파싱+실행 (CREATE_PART/CREATE_SUB) |
| src/app/api/parts/route.ts | Part 에이전트 생성 코드 삭제 (Part는 DB 레코드만) |
| src/app/api/skills/[name]/execute/route.ts | Part 에이전트 생성 코드 삭제 |
| src/stores/agentStore.ts | MOCK_TREE 삭제, initMain() 추가, 빈 배열 시작 |
| src/stores/partStore.ts | MOCK_PARTS 삭제, 빈 배열 시작 |
| src/stores/approvalStore.ts | MOCK_APPROVALS 삭제, 빈 배열 시작 |
| src/components/workspace/WorkspaceLayout.tsx | initMain()+fetchTree() 마운트 호출, Part 컬럼 partStore 사용, Sub 필터링 partId 기반 |
| src/components/workspace/AgentDetailPopup.tsx | 역할별 탭 필터링 (Part/Instance: info+log만) |
| src/app/(authenticated)/settings/page.tsx | 백업탭 삭제, 테마 선택기 연결, 하드코딩 색상→CSS 변수 |
| src/app/(authenticated)/resources/audit/page.tsx | Mock 데이터 → 빈 배열 시작 |
| src/app/(authenticated)/resources/errors/page.tsx | Mock 데이터 → 빈 배열 시작 |
| src/app/(authenticated)/resources/approvals/page.tsx | Mock 데이터 → 빈 배열 시작 |
| src/styles/tokens.css | `[data-theme="dark"]` 블록 추가 (전체 다크 테마 변수) |
| src/app/layout.tsx | suppressHydrationWarning + 인라인 테마 스크립트 |
| 10+ UI 파일 | 하드코딩 hex 색상 → CSS 변수 전환 |

### 삭제된 파일
| 파일 | 사유 |
|---|---|
| src/app/api/backups/route.ts | 백업 기능 삭제 |
| src/app/api/backups/manual/route.ts | 백업 기능 삭제 |
| src/app/api/backups/[id]/restore/route.ts | 백업 기능 삭제 |

### 검증 결과
- `pnpm build`: SUCCESS
- Main init-main API: 정상 동작 (기존 Main 존재 시 반환, 없으면 생성)
- Agent tree API: 정상 동작 (parentId 기반 계층 구조)
- Chat API: Main과 대화 → 액션 파싱 → Part 생성 정상 동작
- DB 테스트: "개발부" Part 생성 + audit log 기록 확인

---

## Phase 2 아키텍처 변경 (2026-04-16)

### 변경 요약
1. **3D 워크스페이스 삭제**: Three.js/R3F/drei 제거, SugarCRM 4컬럼 대시보드로 교체
2. **LiteLLM 삭제**: Claude Code CLI 직접 사용 (child_process.spawn)
3. **TopNav 3탭**: Dashboard / Resources / Settings
4. **우선순위 시스템**: projects.priority text('urgent'|'high'|'normal'|'low')
5. **안정성 인프라**: agent_checkpoints + message_queue + execution_queue 3개 테이블
6. **노트 뷰**: NoteViewer/FolderTree/NoteRenderer 컴포넌트

### 신규 파일
| 카테고리 | 파일 | 설명 |
|---|---|---|
| Core lib | src/lib/agent-manager.ts | child_process.spawn + CLI JSON 통신 |
| Core lib | src/lib/checkpoint-manager.ts | 에이전트 체크포인트 저장/복원 |
| Core lib | src/lib/execution-queue.ts | 우선순위 기반 실행 큐 |
| Store | src/stores/priorityStore.ts | 프로젝트 우선순위 관리 |
| Component | src/components/workspace/WorkspaceLayout.tsx | 4컬럼 레이아웃 |
| Component | src/components/workspace/ProjectColumn.tsx | 프로젝트 카드 목록 |
| Component | src/components/workspace/AgentColumn.tsx | 에이전트 트리 |
| Component | src/components/workspace/ActivityColumn.tsx | 실시간 활동 피드 |
| Component | src/components/workspace/ChatColumn.tsx | Main 채팅 영역 |
| Component | src/components/workspace/ProjectCard.tsx | 프로젝트 요약 카드 |
| Component | src/components/workspace/PriorityBadge.tsx | 우선순위 배지 |
| Component | src/components/workspace/ActivityItem.tsx | 활동 피드 아이템 |
| Component | src/components/note/NoteViewer.tsx | Obsidian 스타일 노트 뷰어 |
| Component | src/components/note/FolderTree.tsx | 폴더 트리 네비게이션 |
| Component | src/components/note/NoteRenderer.tsx | 마크다운 렌더링 |
| API route | src/app/api/projects/route.ts | GET projects (priority sorted) |
| API route | src/app/api/projects/[id]/priority/route.ts | PUT priority |
| API route | src/app/api/projects/reorder/route.ts | PUT reorder |
| API route | src/app/api/agents/[id]/checkpoints/route.ts | GET/POST checkpoints |
| API route | src/app/api/execution/status/route.ts | GET execution queue status |

### 변경된 파일
| 파일 | 변경 내용 |
|---|---|
| src/lib/schema.ts | projects.priority integer->text, 3개 테이블 추가 |
| src/stores/workspaceStore.ts | 4컬럼 대시보드 상태 (officeStore 대체) |
| src/components/layout/TopNav.tsx | 3탭 pill-tab (Dashboard/Resources/Settings) |
| src/app/(authenticated)/layout.tsx | BottomBar 제거 |
| src/app/(authenticated)/dashboard/page.tsx | 4컬럼 SugarCRM 대시보드 (메인 화면) |
| src/app/(authenticated)/workspace/page.tsx | /dashboard로 리다이렉트 |
| src/app/page.tsx | /dashboard로 리다이렉트 |
| src/components/workspace/IconSidebar.tsx | viewMode 제거, chat toggle 추가 |
| package.json | @react-three/drei, @react-three/fiber, three, @types/three 제거 |
| src/__tests__/integration/helpers/test-db.ts | priority text + 3개 새 테이블 |

### 삭제된 파일
| 파일 | 사유 |
|---|---|
| litellm_config.yaml | Claude Code CLI 사용으로 불필요 |

---

## Phase 1 구현 상태 (기존 유지)

### API Routes (50 endpoints)
| 그룹 | 수 | 상태 |
|---|---|---|
| Auth | 3 | 유지 |
| Agents | 6 (+checkpoints) | 유지+추가 |
| Parts | 3 | 유지 |
| Skills | 3 | 유지 |
| Chat | 2 | 유지 |
| Approvals | 5 | 유지 |
| Cost | 4 | 유지 |
| Reports | 3 | 유지 |
| Notifications | 3 | 유지 |
| Settings | 2 | 유지 |
| API Keys | 4 | 유지 |
| ~~Backups~~ | ~~3~~ | 삭제 (Phase 3) |
| System | 2 | 유지 |
| Audit | 1 | 유지 |
| Error Logs | 1 | 유지 |
| Hooks | 1 | 유지 |
| Projects | 3 (신규) | 추가 |
| Execution | 1 (신규) | 추가 |
| ~~LiteLLM~~ | ~~1~~ | 삭제 (Phase 2) |

### Zustand Stores (16개)
| Store | 상태 |
|---|---|
| authStore | 유지 |
| agentStore | 유지 |
| chatStore | 유지 |
| approvalStore | 유지 |
| notificationStore | 유지 |
| ~~officeStore~~ | 삭제 (workspaceStore로 대체) |
| workspaceStore | 업데이트 |
| settingsStore | 유지 |
| costStore | 유지 |
| systemStore | 유지 |
| agentDetailStore | 유지 |
| partStore | 유지 |
| skillStore | 유지 |
| reportStore | 유지 |
| terminalStore | 유지 |
| priorityStore | 신규 |

### 빌드 검증
- `pnpm build`: SUCCESS
- TypeScript type check: PASSED

### Phase 1 기능 구현
- 총 기능: 75개 (F001~F075) -- 모두 구현 완료
- Phase 2 (F076~F083): 8개 (미구현, 설계상 Phase 2)
