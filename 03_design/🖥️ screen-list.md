# 화면 정의서 (Screen List)
> 작성: designer | 상태: 작성 완료
> 스토리보드(SB-001~SB-028) 기반 도메인별 화면 정의

---

## 1. 인증 도메인

### SCR-AUTH-001. 로그인 화면
- **스토리보드**: SB-001
- **URL**: `/login`
- **관련 기능**: F059
- **컴포넌트**:
  - `LoginForm`: 비밀번호 입력 필드 + 로그인 버튼
  - `LoginBackground`: 3D 워크스페이스 흐릿한 실루엣 (보케 효과, Canvas)
  - `ErrorMessage`: 비밀번호 오류/잠금 메시지
  - `Logo`: ClaudeManager 로고 + 서브텍스트
- **데이터 소스**: `POST /api/auth/login`
- **상태 관리**: `useAuthStore` (token, isAuthenticated)
- **반응형**:
  - 데스크톱: 중앙 로그인 카드 + 3D 배경
  - 모바일: 로그인 카드만 (3D 배경 없음, 그라데이션 배경)
- **접근 권한**: 비인증 상태에서만 접근

### SCR-AUTH-002. 최초 비밀번호 설정
- **스토리보드**: SB-002
- **URL**: `/setup`
- **관련 기능**: F059
- **컴포넌트**:
  - `SetupForm`: 비밀번호 + 확인 입력 + 설정 완료 버튼
  - `PasswordStrength`: 비밀번호 강도 표시
- **데이터 소스**: `POST /api/auth/setup`
- **상태 관리**: `useAuthStore`
- **반응형**: 데스크톱/모바일 동일 (중앙 카드)
- **접근 권한**: 시스템 최초 실행 시에만 접근

---

## 2. 대시보드 도메인 (메인 화면)

> **변경 이력**: Phase 2(2026-04-16)에서 3D 워크스페이스(SCR-OFFICE-001~005)를 폐기하고 SugarCRM 4컬럼 대시보드로 교체.

### SCR-DASH-001. 4컬럼 대시보드 (메인 화면)
- **스토리보드**: SB-003, SB-004 대체
- **URL**: `/dashboard`
- **관련 기능**: F008, F009~F014, F018~F020, F023, F026, F028, F029, F040, F044, F046, F059~F062
- **컴포넌트**:
  - `WorkspaceLayout`: 4컬럼 레이아웃 컨테이너
    - `ProjectColumn`: 프로젝트 카드 목록 + 우선순위 배지 + 드래그 재정렬
    - `AgentColumn`: 에이전트 트리 (Main → Part → Sub → Instance) + 상태 배지
    - `ActivityColumn`: 실시간 활동 피드 + 승인 요청 카드
    - `ChatColumn`: Main과 실시간 대화 (프로젝트 구성 단계)
  - `TopNav`: 상단 내비게이션 (Dashboard / Resources / Settings)
  - 공용 카드 컴포넌트 (`cards.tsx`): MainAgentCard, PartCard, AgentCard, TaskCard, StatusDot, ColumnHeader, ColumnEmpty
- **데이터 소스**:
  - `GET /api/agents/tree` (에이전트 트리)
  - `GET /api/parts` (Part 목록)
  - `GET /api/chat/messages` (Main 대화)
  - WebSocket: `agent:status`, `agent:message`, `project:progress`, `approval:request`, `chat:message`, `chat:stream`
- **상태 관리**: `useWorkspaceStore`, `useAgentStore`, `usePartStore`, `useChatStore`, `useApprovalStore`
- **반응형**: 데스크톱 전용 (1024px 이상, 태블릿은 2컬럼 반응형)
- **접근 권한**: 인증 필수
- **인터랙션**:
  - Projects 컬럼: 프로젝트 카드 클릭 → 상세 모달, 우선순위 드래그 재정렬
  - Agents 컬럼: 에이전트 카드 클릭 → AgentModal (대화/노트/로그/CLI 탭)
  - Activity 컬럼: 실시간 피드 자동 스크롤, 승인 요청 인라인 처리
  - Chat 컬럼: Main과 직접 대화, Skill 실행 트리거

---

## 3. 채팅 도메인 (대시보드 Chat 컬럼 + 에이전트 팝업 대화 탭)

### SCR-CHAT-001. Main 대화 (Chat 컬럼)
- **스토리보드**: SB-007
- **URL**: `/dashboard` (Chat 컬럼 내장)
- **관련 기능**: F008, F059~F061
- **컴포넌트**:
  - `ChatColumn`: 대시보드 4번째 컬럼
    - `MessageList`: 메시지 목록 (무한 스크롤)
      - `UserMessage`: 대표 메시지 말풍선 (우측, 퍼플)
      - `MainMessage`: Main 메시지 말풍선 (좌측, 흰색)
      - `MarkdownRenderer`: 마크다운 렌더링 (테이블, 코드블록)
      - `TypingIndicator`: 타이핑 인디케이터 (3도트)
    - `ChatInput`: 메시지 입력창 + 전송 버튼
    - `InlineProgressCard`: 진행률 카드 (인라인)
- **데이터 소스**:
  - `GET /api/chat/messages?page=N`
  - WebSocket: `chat:message`, `chat:typing`, `chat:stream`
  - `POST /api/chat/send`
- **상태 관리**: `useChatStore` (메시지 목록, 입력 상태)
- **반응형**:
  - 데스크톱: 대시보드 4번째 컬럼 (고정)
  - 모바일: 전체 너비 (별도 화면)

### SCR-CHAT-002. 승인 요청 채팅 (Chat 컬럼 내)
- **스토리보드**: SB-008
- **URL**: `/dashboard` (Chat 컬럼 내 승인 요청 수신 시 상태)
- **관련 기능**: F023~F030, F059, F061
- **컴포넌트**:
  - SB-007 기반 + 추가:
    - `ApprovalRequestCard`: 승인 요청 인라인 카드 (노란 좌측 보더)
      - 요청 상세 내용 (PRD 요약, 기능 수, 예상 기간)
      - `ApprovalButton`: 승인 (초록), 반려 (빨간), 수정 지시 (주황)
      - `ModificationInput`: 수정 지시 시 코멘트 입력 확장
    - `PendingBanner`: 상단 "승인 대기 N건" 노란 배너
- **데이터 소스**:
  - `GET /api/approvals/pending`
  - `POST /api/approvals/:id/approve`
  - `POST /api/approvals/:id/reject`
  - `POST /api/approvals/:id/modify`
- **상태 관리**: `useApprovalStore`

---

## 4. Skill 도메인

### SCR-SKILL-001. Skill 라이브러리
- **스토리보드**: SB-009
- **URL**: 모달 (별도 URL 없음)
- **관련 기능**: F001~F004, F006, F007
- **컴포넌트**:
  - `SkillLibraryModal`: 모달 컨테이너
  - `SkillTree`: 상속 관계 트리 표시
    - `SkillCard`: 개별 Skill (이름, 설명, 버전, 상속 관계)
    - `SkillDetail`: Skill 상세 (스키마, 버전 이력)
  - `NewSkillButton`: 새 Skill 작성 버튼 (채팅 연결)
  - `ExecuteButton`: Skill 실행 버튼
- **데이터 소스**: `GET /api/skills`
- **상태 관리**: `useSkillStore` (목록, 선택된 Skill)

### SCR-SKILL-002. Skill 입력 폼
- **스토리보드**: SB-010
- **URL**: 모달 (별도 URL 없음)
- **관련 기능**: F001, F005, F006, F009
- **컴포넌트**:
  - `SkillFormModal`: 모달 컨테이너
  - `DynamicForm`: 스키마 기반 자동 생성 폼
    - `TextInput`: 텍스트 필드
    - `SelectInput`: 셀렉트 필드
    - `NumberInput`: 숫자 필드
  - `ValidationErrors`: 유효성 검증 에러 표시
  - `FormActions`: 취소 + 실행 버튼
- **데이터 소스**:
  - `GET /api/skills/:name/schema`
  - `POST /api/skills/:name/execute`
- **상태 관리**: `useSkillStore` (폼 데이터, 유효성)

---

## 5. 에이전트 상세 도메인 (Sub CLI 주 대화 접점)

> **DR001 반영 (참조: [02_concept/📌 DR001-yj-manager-hierarchy.md](../02_concept/📌%20DR001-yj-manager-hierarchy.md))**
> 이 도메인의 4개 탭(대화/노트/로그/터미널)은 **"팝업 부가 정보"가 아니라 프로젝트 수행 중 사용자가 Sub CLI와 직접 상호작용하는 주 창구**다. Main CLI(채팅 컬럼)는 초기 프로젝트 구성 단계에서만 사용되고, 일단 Sub가 생성된 이후에는 사용자는 **이 에이전트 상세 모달을 통해 해당 Sub CLI와 직접 대화·관찰·개입**한다. 웹 대시보드 본체는 여러 Sub의 상태를 감독·집계하는 뷰일 뿐이다.

### SCR-AGENT-001. 에이전트 팝업 - 대화 탭 (Sub CLI 주 대화 접점)
- **성격**: **프로젝트 수행 중 사용자의 주 대화 접점**. DR001 §3/§4에 따라 Main은 초기 구성만 담당하고, 구성 이후 사용자는 이 탭을 통해 해당 Sub CLI와 직접 대화한다. (참조: [DR001](../02_concept/📌%20DR001-yj-manager-hierarchy.md) §4 사용 흐름 2단계)
- **스토리보드**: SB-012
- **URL**: 모달 (별도 URL 없음)
- **관련 기능**: F012, F014, F015, F040, F057, F062, F063
- **컴포넌트**:
  - `AgentModal`: 80% 크기 팝업 모달
    - `AgentHeader`: 캐릭터 아이콘 + 이름 + 역할 + 상태 배지 + 가동 시간
    - `TabBar`: 대화 / 노트 / 로그 / 터미널 탭
  - `ConversationTab`:
    - `ConversationTimeline`: 시간순 대화 이력 (사용자 ↔ Sub CLI)
    - `ConversationItem`: 시각 + 보낸이 -> 받는이 + 내용 + 유형 아이콘
    - `UserInputArea`: 사용자가 Sub CLI에 직접 메시지를 보낼 수 있는 입력 영역
- **데이터 소스**:
  - `GET /api/agents/:id`
  - `GET /api/agents/:id/conversations`
  - `POST /api/agents/:id/messages` (사용자 ↔ Sub 직접 대화)
  - WebSocket: `agent:message`
- **상태 관리**: `useAgentDetailStore` (선택된 에이전트, 활성 탭)
- **반응형**: 데스크톱 전용

### SCR-AGENT-002. 에이전트 팝업 - 노트 탭 (Sub 상태·진실 소스 열람)
- **성격**: **Sub CLI의 진실 소스(`.orchestrator/*.md`)를 그대로 열람**하는 뷰. 대화 탭(SCR-AGENT-001)과 함께 Sub와의 주 접점 한 축을 담당한다. DR001 §5에 따라 Sub의 `data(파일)`가 진실 소스이므로, 이 탭의 내용이 곧 Sub의 현재 사고 맥락이다. (참조: [DR001](../02_concept/📌%20DR001-yj-manager-hierarchy.md) §5)
- **스토리보드**: SB-013
- **URL**: 모달 내 탭
- **관련 기능**: F040, F041, F062
- **컴포넌트**:
  - `NoteTab`:
    - `NoteRenderer`: react-markdown + remark-gfm 렌더링
    - `ProgressTimeline`: 단계별 타임라인 (색상 코딩)
    - `DecisionCards`: 의사결정 카드 (아코디언)
    - `NoteFileList`: 노트 파일 목록 (Sub의 `.orchestrator/` 구조)
- **데이터 소스**:
  - `GET /api/agents/:id/notes`
  - WebSocket: `note:updated`
- **상태 관리**: `useAgentDetailStore`

### SCR-AGENT-003. 에이전트 팝업 - 로그 탭 (Sub 이벤트 흐름 추적)
- **성격**: Sub CLI가 생성한 **이벤트 로그 시계열** 뷰. 대화 탭이 "주 대화"라면 이 탭은 "주 관찰" 창구다. Sub 실행 중 발생한 Hook 이벤트·툴 호출·오류가 시간순으로 흐른다. (참조: [DR001](../02_concept/📌%20DR001-yj-manager-hierarchy.md) §4 사용 흐름 2단계)
- **스토리보드**: SB-014
- **URL**: 모달 내 탭
- **관련 기능**: F034, F062, F063
- **컴포넌트**:
  - `LogTab`:
    - `LogSearch`: 키워드 검색창
    - `LogTimeline`: 이벤트 로그 시간순 목록
    - `LogEntry`: 시각 + 유형 배지(색상) + 내용 + 토큰/비용
    - `LogDetail`: 클릭 시 상세 펼침
- **데이터 소스**:
  - `GET /api/agents/:id/logs?search=&page=`
  - WebSocket: `log:new`

### SCR-AGENT-004. 에이전트 팝업 - 터미널 탭 (Terminal.app으로 CLI 세션 열기)
- **성격**: Sub CLI(`claude` 프로세스)의 **세션을 macOS Terminal.app에서 직접 여는** 탭. 대화 탭이 구조화된 메시지라면, 이 탭은 **원시 CLI 레벨의 직접 접점**이다. 오류 진단·세션 개입이 필요할 때 쓰는 최말단 채널. (참조: [DR001](../02_concept/📌%20DR001-yj-manager-hierarchy.md) §3 Sub 행)
- **스토리보드**: SB-015
- **URL**: 모달 내 탭
- **관련 기능**: F015, F057, F058
- **컴포넌트**:
  - `TerminalTab`:
    - "터미널 열기" 버튼: 클릭 시 `POST /api/agents/:id/open-terminal` 호출
    - `SessionStatus`: cliSessionId 존재 여부, 프로젝트 루트 경로 표시
- **데이터 소스**:
  - `POST /api/agents/:id/open-terminal` (osascript로 Terminal.app 실행)
- **상태 관리**: `useAgentDetailStore` (선택된 에이전트의 cliSessionId, projectRoot)

---

## 6. 리포트 도메인

### SCR-REPORT-001. 프로젝트 진행 보고서
- **스토리보드**: SB-016
- **URL**: `/reports`
- **관련 기능**: F013, F014, F025, F040, F041, F061, F063
- **컴포넌트**:
  - `ReportNav`: Part 탭 + 리포트 유형 필터 (좌측 사이드바)
  - `ReportGrid`: 리포트 카드 그리드 (2~3열)
    - `ProgressReport`: 단계별 타임라인 바 + 전체 진행률
    - `RecentActivity`: 최근 활동 목록
    - `DateFilter`: 날짜 필터
- **데이터 소스**:
  - `GET /api/reports/progress?part=&date=`
  - `GET /api/parts`
- **상태 관리**: `useReportStore`
- **반응형**: 데스크톱: 좌측 사이드바 + 우측 그리드, 모바일: 카드형

### SCR-REPORT-002. 의사결정 이력
- **스토리보드**: SB-017
- **URL**: `/reports` (리포트 유형 전환)
- **관련 기능**: F025, F040, F061, F063
- **컴포넌트**:
  - `DecisionHistory`: 시간순 카드 목록 (아코디언)
  - `DecisionDetail`: A/B안 비교, 근거, 결정 시각
  - `ConversationFlowTree`: 대화 흐름 트리
- **데이터 소스**: `GET /api/reports/decisions?part=&date=`

### SCR-REPORT-003. 대화 흐름 트리 뷰
- **스토리보드**: SB-021
- **URL**: `/reports/flow`
- **관련 기능**: F012, F014, F040, F062, F063
- **컴포넌트**:
  - `FlowTreeView`: Main -> Part -> Sub -> 인스턴스 트리형 타임라인
  - `FlowNode`: 시각 + 행위자 + 내용
  - `NodeSidePanel`: 산출물, 소요 시간, 토큰/비용
  - `FlowFilter`: 기간/에이전트 필터
- **데이터 소스**: `GET /api/reports/flow?project=&date=`
- **반응형**: 데스크톱 전용

---

## 7. 데이터 뷰 도메인

### SCR-DATA-001. 비용 대시보드
- **스토리보드**: SB-018
- **URL**: `/data/cost`
- **관련 기능**: F016, F022, F031, F037, F044~F046
- **컴포넌트**:
  - `DataViewTabs`: 비용 / 승인 이력 / 오류 로그 / 감사 로그
  - `CostSummaryBar`: 월간 비용 요약 바
  - `ModelUsageChart`: 모델별 도넛 차트
  - `CostTrendChart`: 비용 추이 선 그래프
  - `ApiKeyUsageTable`: API 키별 사용량
  - `ProjectCostTable`: 프로젝트별 비용
  - `PeriodFilter`: 기간 필터
- **데이터 소스**:
  - `GET /api/cost/summary?period=`
  - `GET /api/cost/by-model?period=`
  - `GET /api/cost/trend?period=`
  - WebSocket: `cost:updated`
- **상태 관리**: `useCostStore`
- **반응형**: 데스크톱 전용

### SCR-DATA-002. 검색/필터링 데이터 뷰
- **스토리보드**: SB-018-B
- **URL**: `/data/approvals`, `/data/errors`, `/data/audit`
- **관련 기능**: F025, F034, F063, F066, F067
- **컴포넌트**:
  - `FilterPanel`: 기간, Part, 상태, 키워드 검색
  - `DataTable`: shadcn/ui 데이터 테이블
  - `RowDetail`: 아코디언 상세
  - `Pagination`: 20건/페이지
  - `ExportButton`: CSV 내보내기
- **데이터 소스**:
  - `GET /api/approvals?page=&filter=`
  - `GET /api/logs/errors?page=&filter=`
  - `GET /api/audit?page=&filter=`
- **반응형**: 데스크톱 전용

---

## 8. 시스템 모니터링 도메인

### SCR-SYSTEM-001. 시스템 헬스 패널
- **스토리보드**: SB-019
- **URL**: 슬라이드업 패널
- **관련 기능**: F017, F028, F030
- **컴포넌트**:
  - `HealthPanel`: 하단 슬라이드업 패널 (화면 40%)
  - `ResourceGauge`: CPU/메모리/디스크 게이지
  - `NetworkStatus`: 네트워크 상태
  - `HealthTrendChart`: 추이 그래프
  - `PeriodTabs`: 1시간 / 24시간 / 7일
- **데이터 소스**:
  - `GET /api/system/health`
  - `GET /api/system/health/history?period=`
  - WebSocket: `system:health`
- **상태 관리**: `useSystemStore`
- **반응형**: 데스크톱 전용

### SCR-SYSTEM-002. 알림 센터
- **스토리보드**: SB-020
- **URL**: 드롭다운
- **관련 기능**: F028~F031, F043
- **컴포넌트**:
  - `NotificationDropdown`: 알림 드롭다운 패널
  - `NotificationItem`: 유형별 색상 배지 + 메시지
  - `NotificationGroup`: 그룹핑 (5분 내 동일 유형 3건 이상)
  - `MarkAllReadButton`: 모두 읽음 처리
- **데이터 소스**:
  - `GET /api/notifications?unread=true`
  - `POST /api/notifications/mark-read`
  - WebSocket: `notification:new`
- **상태 관리**: `useNotificationStore`

---

## 9. 설정 도메인

### SCR-SETTINGS-001. 전역 설정
- **스토리보드**: SB-022
- **URL**: 풀스크린 모달
- **관련 기능**: F027, F035, F064, F065, F070~F072
- **컴포넌트**:
  - `SettingsModal`: 풀스크린 모달 (좌측 메뉴 240px + 우측 내용)
  - `GlobalSettingsForm`: 재시도, 비용 한도, 알림 임계값, 에이전트 상한
  - `SaveButton`: 저장 + 토스트
- **데이터 소스**: `GET /api/settings`, `PUT /api/settings`
- **상태 관리**: `useSettingsStore`
- **반응형**: 데스크톱 전용

### SCR-SETTINGS-002. Part별 정책
- **스토리보드**: SB-023
- **URL**: 설정 모달 내 메뉴
- **관련 기능**: F027, F035, F065
- **컴포넌트**:
  - `PartPolicyForm`: Part 선택, 재시도, 승인, 민감도, 기본 모델
- **데이터 소스**: `GET /api/parts/:id/policy`, `PUT /api/parts/:id/policy`

### SCR-SETTINGS-003. API 키 관리
- **스토리보드**: SB-024
- **URL**: 설정 모달 내 메뉴
- **관련 기능**: F036~F039
- **컴포넌트**:
  - `ApiKeyTable`: 키 목록 테이블
  - `ApiKeyForm`: 등록/갱신 폼
  - `DeleteConfirmModal`: 삭제 확인
- **데이터 소스**: `GET /api/apikeys`, `POST /api/apikeys`, `PUT /api/apikeys/:id`, `DELETE /api/apikeys/:id`

### SCR-SETTINGS-004. 백업/복원
- **스토리보드**: SB-025
- **URL**: 설정 모달 내 메뉴
- **관련 기능**: F068, F069
- **컴포넌트**:
  - `BackupStatus`: 현황
  - `BackupHistory`: 히스토리 목록
  - `ManualBackupButton`: 수동 백업
  - `RestoreButton`: 복원 + 경고 모달
- **데이터 소스**: `GET /api/backups`, `POST /api/backups/manual`, `POST /api/backups/:id/restore`

---

## 10. 노트 뷰 도메인

### SCR-NOTE-001. 노트 전체 화면 (새 탭)
- **스토리보드**: SB-013 확장
- **URL**: `/workspace/notes/:id`
- **관련 기능**: F040, F041, F062
- **프로토타입**: `page-note-view.html`
- **컴포넌트**:
  - `TopNav`: 상단 네비게이션 (Dashboard/Resources/Settings)
  - `NoteBreadcrumb`: 경로 표시 (Dashboard / Notes / Agent / file.md)
  - `NoteHeader`: 제목 + 편집/닫기 버튼
  - `NoteMeta`: 수정 시각, 작성자, 파일 경로
  - `NoteTags`: 태그 뱃지 (현황/결정/할일/오류 등)
  - `NoteBody`: 마크다운 렌더링 (h2~h4, ul/ol, code, pre, blockquote, checkbox, img, pdf embed)
  - `NoteFooter`: 마지막 편집자 + URL 표시
- **데이터 소스**:
  - `GET /api/agents/:agentId/notes/:noteId`
  - WebSocket: `note:updated`
- **상태 관리**: `useAgentDetailStore`
- **반응형**: 데스크톱 전용 (900px max-width 콘텐츠 영역)
- **접근 권한**: 인증 필수
- **특이사항**:
  - 팝업 노트 탭(SCR-AGENT-002)에서 "새 탭에서 열기" 버튼으로 진입
  - URL 기반이므로 북마크, 공유, 브라우저 히스토리 지원
  - 이미지 렌더링 지원 (Phase 1), PDF 인라인 뷰 지원 (Phase 2)

---

## 11. 모바일 도메인

### SCR-MOBILE-001. 모바일 채팅 화면
- **스토리보드**: SB-026
- **URL**: `/m/chat`
- **관련 기능**: F013, F023, F024, F028, F029, F059
- **컴포넌트**:
  - `MobileChatHeader`: Main 아이콘 + 이름 + 연결 상태
  - `MobileMessageList`: 메시지 UI
  - `MobileApprovalBanner`: 승인 대기 배너
  - `MobileApprovalButtons`: 인라인 승인/반려
  - `MobileChatInput`: 입력창
  - `MobileBottomNav`: 채팅/알림/상태 하단 탭
  - `ConnectionBanner`: 연결 끊김 시 노란 바
- **데이터 소스**: SCR-CHAT-001과 동일
- **상태 관리**: `useChatStore`, `useApprovalStore`
- **반응형**: 모바일 전용 (768px 미만)

### SCR-MOBILE-002. 모바일 알림 목록
- **스토리보드**: SB-027
- **URL**: `/m/notifications`
- **관련 기능**: F028~F030
- **컴포넌트**:
  - `MobileNotificationList`: 시간순 전체 화면 리스트
  - `MobileNotificationItem`: 유형별 색상 배지 + 메시지
  - `MobileBottomNav`
- **데이터 소스**: `GET /api/notifications`

### SCR-MOBILE-003. 모바일 상태 카드
- **스토리보드**: SB-028
- **URL**: `/m/status`
- **관련 기능**: F013
- **컴포넌트**:
  - `MobileStatusList`: Part/Sub별 카드 세로 목록
  - `MobileStatusCard`: Part 이름 + 상태 + 진행률 + 에이전트 수
  - `SubAccordion`: Sub/인스턴스 펼침
  - `DesktopLink`: "데스크톱에서 자세히 보기"
  - `MobileBottomNav`
- **데이터 소스**: `GET /api/agents/tree`
- **상태 관리**: `useAgentStore`

---

## 화면 총계

| 도메인 | 화면 수 | 화면 ID |
|---|---|---|
| 인증 | 2 | SCR-AUTH-001~002 |
| 대시보드 | 1 | SCR-DASH-001 |
| 채팅 (대시보드 Chat 컬럼) | 2 | SCR-CHAT-001~002 |
| Skill | 2 | SCR-SKILL-001~002 |
| 에이전트 상세 | 4 | SCR-AGENT-001~004 |
| 리포트 | 3 | SCR-REPORT-001~003 |
| 데이터 뷰 | 2 | SCR-DATA-001~002 |
| 시스템 | 2 | SCR-SYSTEM-001~002 |
| 설정 | 4 | SCR-SETTINGS-001~004 |
| 노트 뷰 | 1 | SCR-NOTE-001 |
| 모바일 | 3 | SCR-MOBILE-001~003 |
| **합계** | **26** | |
