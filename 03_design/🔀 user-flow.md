# 사용자 흐름도 (User Flow)
> 작성: designer | 상태: 작성 완료
> 전체 사용자 여정과 주요 태스크 플로우를 정의

---

## 1. 전체 사용자 여정

### 1.0 관리 책임 3계층 사용 흐름 (DR001 반영)

> 참조: [02_concept/📌 DR001-yj-manager-hierarchy.md](../02_concept/📌%20DR001-yj-manager-hierarchy.md) §4 사용 흐름

ClaudeManager는 **Main(초기 구성)** → **Sub(프로젝트 수행)** → **ClaudeManager 전체(감독)** 의 3단계 흐름으로 사용된다. 사용자가 각 단계에서 **누구와 대화하는가** 가 다르다.

```mermaid
flowchart LR
    S1[1단계: 프로젝트 구성<br>사용자 ↔ Main CLI] -->|Sub CLI 생성 완료| S2[2단계: 프로젝트 수행<br>사용자 ↔ Sub CLI 직접 대화]
    S2 -->|상태·비용·이력 적재| S3[3단계: 감독·집계<br>사용자 → 웹 대시보드 열람]
    S3 -.필요 시 상세 열람.-> S2
```

| 단계 | 무엇을 하는가 | 대화 상대 (저장소) |
|---|---|---|
| **1단계 · 프로젝트 구성** | 새 프로젝트 시작, Sub CLI 생성, Skill/문서 레이아웃 준비, `.orchestrator` 구조 생성 | **Main CLI** (파일) — 초기 구성 시에만 |
| **2단계 · 프로젝트 수행** | 프로젝트 진행 중 지시·질의·승인 처리 등 실무 대화 | **Sub CLI 직접 대화** (프로젝트 내 파일). Main은 개입 ✗ |
| **3단계 · 감독·비용·이력** | 여러 Sub의 상태·비용·이력·리포트 종합 감독, 필요 시 Sub 상세 팝업 열람 | **웹 대시보드** (PostgreSQL DB). 직접 CLI 대화 ✗ |

- **진실 소스는 파일(Main/Sub의 `.orchestrator/*.md`)**, DB는 감독용 파생 뷰. Hooks가 이중 기록.
- 아래 §1.1~§1.3 플로우는 위 3단계 중 어디에 해당하는지를 명시하는 형태로 읽으면 된다.

### 1.1 최초 접속 -> 온보딩 -> 일상 운영

```mermaid
flowchart TD
    START([브라우저 접속]) --> AUTH{최초 접속?}
    AUTH -->|Yes| SB002[SB-002 비밀번호 설정]
    AUTH -->|No| SB001[SB-001 로그인]
    
    SB002 --> DASH_EMPTY[대시보드 - 빈 상태]
    SB001 --> CHECK{부서 존재?}
    
    CHECK -->|No| DASH_EMPTY
    CHECK -->|Yes| DASH[대시보드 - 4컬럼 뷰]
    
    DASH_EMPTY --> CHAT_ONBOARD[채팅 컬럼 - 온보딩 대화]
    CHAT_ONBOARD --> SKILL_LIB[Skill 라이브러리 모달]
    SKILL_LIB --> SKILL_FORM[Skill 입력 폼]
    SKILL_FORM --> PART_CREATE[Part 생성 완료]
    PART_CREATE --> DASH
    
    DASH --> DAILY{일상 운영 루프}
    DAILY --> MONITOR[모니터링]
    DAILY --> COMMAND[지시/제어]
    DAILY --> APPROVE[승인 처리]
    DAILY --> RESOURCE[리소스 관리]
    DAILY --> SETTINGS[설정 관리]
    
    MONITOR --> DASH
    COMMAND --> CHAT_COL[채팅 컬럼]
    APPROVE --> APPROVAL[승인 처리 (Activity/Chat 컬럼)]
    RESOURCE --> RESOURCE_PAGE[Resources 페이지]
    SETTINGS --> SETTINGS_PAGE[Settings 페이지]
```

### 1.2 데스크톱 메인 뷰 전환 흐름

```mermaid
flowchart LR
    DASHBOARD[Dashboard<br>4컬럼 대시보드] <-->|상단 탭 전환| RESOURCES[Resources<br>리포트·비용·로그]
    DASHBOARD <-->|상단 탭 전환| SETTINGS[Settings<br>설정 관리]
    RESOURCES <-->|상단 탭 전환| SETTINGS
    
    DASHBOARD -->|에이전트 카드 클릭| AGENT_MODAL[에이전트 상세 모달<br>대화/노트/로그/CLI<br>= Sub CLI 주 접점]
    DASHBOARD -->|채팅 컬럼 · 초기 구성 시| CHAT[Main과 실시간 대화<br>프로젝트 구성 단계]
    DASHBOARD -->|프로젝트 카드 클릭| PROJECT_DETAIL[프로젝트 상세]
```

> DR001 적용 포인트: **채팅 컬럼(Main 대화)** 은 1단계(프로젝트 구성)의 창구이고, **에이전트 상세 모달의 대화 탭(SCR-AGENT-001)** 은 2단계(프로젝트 수행)에서 Sub CLI와 직접 대화하는 주 접점이다. Dashboard 자체는 3단계(감독) 뷰다.

### 1.3 모바일 뷰 전환 흐름

```mermaid
flowchart LR
    M_CHAT[채팅<br>SB-026] <-->|하단 탭| M_ALERT[알림<br>SB-027]
    M_CHAT <-->|하단 탭| M_STATUS[상태<br>SB-028]
    M_ALERT <-->|하단 탭| M_STATUS
```

---

## 2. 주요 태스크 플로우

### 2.1 Part(부서) 생성 플로우

```mermaid
flowchart TD
    A[대표: 채팅 컬럼에서 부서 생성 요청] --> B[Main: Skill 라이브러리 안내]
    B --> C[Skill 라이브러리 모달 표시]
    C --> D[대표: Skill 선택 + 실행]
    D --> E[스키마 기반 입력 폼]
    E --> F[대표: 폼 작성 + 실행 클릭]
    F --> G[Main: 입력 확인 요약 채팅]
    G --> H[대표: 확인]
    H --> I[agent-manager: CLI spawn으로 Part 생성]
    I --> J[DB에 Part 정보 저장]
    J --> K[.orchestrator/parts/ 폴더 생성]
    K --> L[대시보드 Agents 컬럼에 새 Part 표시]
    L --> M[Main: 부서 설립 완료 채팅 보고]
```

### 2.2 프로젝트 실행 플로우

```mermaid
flowchart TD
    A[대표: 채팅에서 프로젝트 지시] --> B[Main: 프로젝트 내용 확인]
    B --> C[Main -> Part: 프로젝트 전달]
    C --> D[Part: Sub 오케스트레이터 생성]
    D --> E[대시보드 Agents 컬럼에 Sub 표시]
    E --> F[Sub: Instance 생성 + 태스크 분배]
    F --> G[Instance: 작업 수행<br>상태 배지 active]
    
    G --> H{승인 필요?}
    H -->|Yes| I[Sub -> Main: 승인 요청]
    I --> J[Activity 컬럼: 승인 대기 카드]
    J --> K[Chat 컬럼에서 승인 처리]
    K --> L[Main -> Part -> Sub: 승인 전달]
    L --> G
    
    H -->|No| M{단계 완료?}
    M -->|No| G
    M -->|Yes| N[상태 배지 idle로 변경]
    N --> O{프로젝트 완료?}
    O -->|No| F
    O -->|Yes| P[Main: 프로젝트 완료 보고]
```

### 2.3 승인 처리 플로우

```mermaid
flowchart TD
    A[Sub: 의사결정 필요] --> B[Sub -> Main: 승인 요청 전달]
    B --> C[Hook HTTP POST -> 웹앱]
    C --> D[DB에 승인 요청 저장]
    D --> E1[Activity 컬럼: 승인 요청 카드 표시]
    D --> E2[TopNav 알림 배지 업데이트]
    D --> E3[브라우저 푸시 알림 발송]
    
    E1 --> F[대표: 알림 확인]
    E2 --> F
    E3 --> F
    
    F --> G[Chat 컬럼 - 승인 카드]
    
    G --> H{대표 결정}
    H -->|승인| I[DB 승인 이력 저장]
    H -->|반려| J[DB 반려 이력 저장]
    H -->|수정 지시| K[코멘트 입력 -> DB 저장]
    
    I --> L[Main -> Part -> Sub: 승인 전달]
    J --> M[Main -> Part -> Sub: 반려 전달]
    K --> N[Main -> Part -> Sub: 수정 지시 전달]
    
    L --> O[대시보드 정상 상태 복귀]
    M --> P[Sub: 새 방향으로 재작업]
    N --> Q[Sub: 수정 후 재승인 요청]
```

### 2.4 오류 대응 플로우

```mermaid
flowchart TD
    A[인스턴스 오류 발생] --> B{자동 재시도}
    B -->|재시도 1~N| C[에이전트 상태: retrying]
    C --> D{성공?}
    D -->|Yes| E[정상 작업 복귀]
    D -->|No| F{재시도 남음?}
    F -->|Yes| B
    F -->|No| G[에이전트 상태: error]
    G --> H[Agents 컬럼: 빨간 error 배지]
    H --> I[Chat 컬럼: 오류 보고 + 재시도 실패 안내]
    I --> J[브라우저 푸시 알림]
    
    J --> K{대표 판단}
    K -->|터미널 확인| L[AgentModal CLI 탭]
    K -->|재시작 지시| M[Main -> Part -> Sub: 재시작]
    K -->|모델 변경| N[Main: 다른 모델로 재시도]
    K -->|프로젝트 중단| O[Main -> Part: 프로젝트 중단]
```

### 2.5 서버 복구 플로우

```mermaid
flowchart TD
    A[서버 재시작] --> B[PM2 자동 시작]
    B --> C[백엔드 서버 기동]
    C --> D[.orchestrator/ 스캔 + 체크포인트 로드]
    D --> E[tmux 세션 재생성]
    E --> F[agent-manager: 체크포인트 기반 CLI 재시작]
    F --> G[CLAUDE.md + checkpoint + DB 이력 컨텍스트 주입]
    G --> H[이전 작업 이어서 진행]
    
    H --> I{전체 복구 완료?}
    I -->|Yes| J[대시보드: 모든 에이전트 active/idle]
    I -->|일부 실패| K[Agents 컬럼: 실패 에이전트 error 배지]
    
    J --> L[Chat 컬럼: 복구 완료 보고]
    K --> L
    L --> M[브라우저 푸시 알림: 서버 복구 완료]
```

### 2.6 모바일 승인 처리 플로우

```mermaid
flowchart TD
    A[푸시 알림 수신] --> B[알림 탭 -> SB-026 모바일 채팅]
    B --> C[승인 대기 배너 표시]
    C --> D[Main: 승인 요청 상세 메시지]
    D --> E{대표 결정}
    E -->|승인 버튼| F[승인 처리]
    E -->|반려 버튼| G[반려 처리]
    E -->|채팅 응답| H[수정 지시/질문]
    
    F --> I[Main: 승인 전달 확인 메시지]
    G --> J[Main: 반려 전달 확인 메시지]
    H --> K[Main: 추가 대화]
```

### 2.7 비용 모니터링 플로우

```mermaid
flowchart TD
    A[Resources 페이지 - 비용 탭] --> B[월간 비용 바 + 차트 확인]
    B --> C{비용 이상?}
    C -->|정상| D[모델별/프로젝트별 분석]
    C -->|임계값 초과| E[Chat 컬럼: 비용 경고 보고]
    
    E --> F{대표 판단}
    F -->|에이전트 수 조절| G[Main: 동시 실행 수 축소]
    F -->|한도 조정| H[Settings -> 비용 한도 변경]
    F -->|프로젝트 조정| I[Main: 우선순위 변경/일시정지]
    
    G --> J[실행 큐 동시 실행 수 변경]
    H --> K[새 임계값 즉시 반영]
```

### 2.8 설정 변경 플로우

```mermaid
flowchart TD
    A[Settings 페이지 열기] --> B{설정 유형}
    B -->|전역 설정| C[재시도/비용/알림/동시 실행 상한]
    B -->|Part별 정책| D[Part 선택 -> 정책 변경]
    B -->|API 키| E[키 등록/갱신/삭제]
    B -->|백업/복원| F[백업 현황/수동 백업/복원]
    
    C --> G[저장 클릭]
    D --> G
    E --> G
    
    G --> H[설정 즉시 반영]
    H --> I[감사 로그에 변경 이력 기록]
    I --> J[초록 토스트: 저장 완료]
```

---

## 3. 화면 접근 맵

### 3.1 Dashboard에서 접근 가능한 화면

```mermaid
flowchart TD
    DASH[Dashboard 4컬럼] -->|에이전트 카드 클릭| MODAL[AgentModal]
    DASH -->|프로젝트 카드 클릭| PROJECT[프로젝트 상세]
    DASH -->|TopNav 알림| NOTIF[알림 드롭다운]
    DASH -->|TopNav Resources| RESOURCES[Resources 페이지]
    DASH -->|TopNav Settings| SETTINGS[Settings 페이지]
    
    MODAL -->|대화 탭| CONV[대화 이력]
    MODAL -->|노트 탭| NOTE[Obsidian 스타일 노트 뷰어]
    MODAL -->|로그 탭| LOG[이벤트 로그]
    MODAL -->|CLI 탭| CLI[Terminal.app 열기]
    
    NOTE -->|새 탭 열기| NOTE_PAGE[노트 전체 화면 뷰]
```

### 3.2 Chat 컬럼에서 접근 가능한 화면

```mermaid
flowchart TD
    CHAT[Chat 컬럼] -->|Skill 실행| SKILL_LIB[Skill 라이브러리 모달]
    SKILL_LIB --> SKILL_FORM[Skill 입력 폼]
    SKILL_FORM --> PART_CREATE[Part 생성 완료]
    
    CHAT -->|승인 요청 수신| APPROVAL[승인 카드 처리]
    CHAT -->|오류 발생 시| AGENT_MODAL[AgentModal CLI 탭]
```

---

## 4. 데스크톱 / 모바일 분기

```mermaid
flowchart TD
    ACCESS[브라우저 접속] --> DETECT{화면 너비}
    
    DETECT -->|1024px 이상| DESKTOP[데스크톱 모드]
    DETECT -->|768~1023px| TABLET[태블릿 모드]
    DETECT -->|768px 미만| MOBILE[모바일 모드]
    
    DESKTOP --> D_NAV[상단 내비 3탭: Dashboard / Resources / Settings]
    D_NAV --> D_DASHBOARD[4컬럼 대시보드 + Chat 컬럼]
    D_NAV --> D_RESOURCE[리소스 관리]
    D_NAV --> D_SETTINGS[설정]
    
    TABLET --> T_NAV[상단 내비 3탭: Dashboard / Resources / Settings]
    T_NAV --> T_ALL[2컬럼 반응형 레이아웃]
    
    MOBILE --> M_NAV[하단 내비 3탭: 채팅/알림/상태]
    M_NAV --> M_CHAT[채팅]
    M_NAV --> M_ALERT[알림 목록]
    M_NAV --> M_STATUS[상태 카드]
```

### 데스크톱 전용 기능
- 4컬럼 SugarCRM 대시보드 (Projects / Agents / Activity / Chat)
- AgentModal (에이전트 카드 클릭 - 대화/노트/로그/CLI)
- Obsidian 스타일 노트 뷰어 (새 탭 열기 지원)
- Resources 페이지 (리포트 + 비용/로그/감사이력)
- 시스템 헬스 패널
- Settings 페이지
- 대화 흐름 트리 뷰
- 프로젝트 우선순위 드래그 재정렬

### 모바일 전용 기능
- 하단 3탭 내비게이션 (채팅/알림/상태)
- 상태 카드 뷰 (Part/Sub별 요약 카드)
- 인라인 승인 버튼 (채팅 내)
- 간소화된 알림 목록

### 공통 기능
- 로그인/비밀번호 설정
- 채팅 (Main과 대화 — 데스크톱: Chat 컬럼, 모바일: 별도 화면)
- 승인 처리 (채팅 내 버튼)
- 푸시 알림 수신

---

## 5. 시나리오별 화면 흐름 매핑

| 시나리오 | 주요 화면 흐름 | 분기 |
|---|---|---|
| SC-001 온보딩 | Login → Setup → Dashboard(빈) → Chat 컬럼 | 최초만 Setup |
| SC-002 Part 생성 | Chat 컬럼 → Skill 라이브러리 → 입력 폼 → Dashboard | |
| SC-003 프로젝트 진행 | Chat 컬럼 → Dashboard (Projects/Agents 컬럼 업데이트) | |
| SC-004 승인 처리 | Activity 컬럼 → Chat 컬럼 (승인 카드) | |
| SC-005 활동 열람 | Agents 컬럼 → AgentModal (대화/노트/로그/CLI 탭) | 탭 선택 |
| SC-006 오류/재시도 | Agents 컬럼 (error 배지) → Chat 컬럼 → AgentModal CLI 탭 | |
| SC-007 비용 모니터링 | Resources (비용 탭) → Chat 컬럼 (조절 대화) | |
| SC-008 리포트 열람 | Resources (리포트 탭) → Chat 컬럼 | |
| SC-009 모바일 승인 | 모바일 채팅 (승인 처리) | 모바일 전용 |
| SC-010 서버 복구 | PM2 자동 → 체크포인트 복원 → Dashboard | |
| SC-011 API 키 관리 | Chat 컬럼 (대화) + Settings (API 키) | |
| SC-012 설정 변경 | Settings 페이지 → Part 정책 | |
| SC-013 능동적 지시 | Chat 컬럼 | |
| SC-014 검색/필터링 | Resources 페이지 | |
| SC-015 백업/복원 | Settings (백업 섹션) | |
| SC-016 리소스 관리 | Chat 컬럼 + Settings | |
| SC-017 시스템 헬스 | Resources (헬스 탭) | |
| SC-018 Skill 작성 | Chat 컬럼 → Skill 라이브러리 → 입력 폼 → Part 생성 | |
| SC-019 생명주기 관리 | Chat 컬럼 → Dashboard | |
| SC-020 마이그레이션 | Chat 컬럼 (대화) + CLI | |
| SC-021 인프라 배포 | CLI → Login → Dashboard | |
| SC-022 대화 흐름 추적 | Resources (흐름 트리) → AgentModal (대화 탭) | |
| SC-023 이중 저장 | Dashboard + Resources (실시간 반영) | |
| SC-024 알림 트리거 | 알림 드롭다운 → 각 상세 화면 | |
| SC-025 뷰 전환 | Dashboard ↔ Resources ↔ Settings | |
| SC-026 에이전트 실행 | Chat 컬럼 (CLI spawn) → Dashboard (상태 반영) | |
| SC-027 모바일 뷰 | 모바일 채팅 → 알림 → 상태 | 모바일 전용 |
| SC-028 민감도 관리 | Settings (Part 정책) + Chat 컬럼 | |
| SC-029 노트 구조 | AgentModal (노트 탭) → 새 탭 노트 뷰 | |
| SC-030 우선순위 관리 | Projects 컬럼 (드래그 재정렬/드롭다운) → 실행 큐 반영 | |
