# 요구사항 정의서
> ✏️ ClaudeManager — Skill-driven 멀티 AI 오케스트레이션 통합 관리 웹앱
> 작성 완료 후 CLI에서 **"요구사항 작성 완료"** 입력

---

## 0. 최종 비전 — Skill-driven 개인 AI 비서 시스템

**이 MVP는 장기적으로 대표의 삶 전반을 관리하는 개인 AI 비서 시스템(ClaudeManager)으로 확장된다.**

**핵심 전환**: Part를 미리 고정 목록으로 박제하지 않고, 대표가 **Part Skill(bash 스크립트)** 을 작성·실행하여 **동적으로 Part를 생성**한다. MVP는 Skill 엔진 + 프로젝트 Part Skill 하나로 시작.

### Skill-driven 동적 Part 모델
- Part Skill = Part 생성 bash 스크립트 (메타데이터 + 입력 스키마 + 실행 로직)
- **Skill : Part = 1 : 1** (같은 Skill로 여러 Part 생성 금지)
- **단일 상속만 허용** (`source`로 부모 Skill 로드)
- **Skill 작성 흐름**: 대표 ↔ Main 오케스트레이터 대화 → bash 파일 생성 → 라이브러리 등록
- **Skill 실행 흐름**: UI에서 Skill 선택 → 스키마 기반 입력 폼 표시 → 대표가 기준 정보 입력 → Skill이 Part 생성 (폴더, 에이전트 팀, Hooks, 승인 정책 자동 설정)

### 예시 Skill (고정 아님 — 실제로 어떤 Skill을 만들지는 대표가 결정)
- `project-part.sh` → MVP 기본 제공
- `personal-part.sh`, `finance-part.sh`, `investment-part.sh`, `work-part.sh`, `video-project-part.sh` 등은 추후 대표가 작성

### MVP 설계 시 반드시 반영할 확장 요소
- **Part Skill 엔진 구현** (MVP 핵심, 하드코딩 Part 금지)
- **기본 Skill 2개**: `base-part.sh`, `project-part.sh`
- **단일 상속 메커니즘** (`source` 기반)
- **Skill 라이브러리**: `~/.claudemanager/skills/`
- **Skill 실행 엔진**: schema / execute 모드
- **기준 정보 입력 폼 UI 자동 생성** (스키마 기반)
- **웹앱 → Claude CLI 양방향 제어**: tmux + node-pty + Hooks (stdin/stdout 완전 제어)
- **4계층 아키텍처**: Main → **Part** → Sub → 인스턴스
- **폴더 구조**: `.orchestrator/parts/project/` (Skill 실행 결과)
- **재현성**: `skill-version.lock`, `input.json` 필수 기록
- **DB 스키마**: `part_id`, `sensitivity_level`, `skill_name`, `skill_version` 컬럼
- **데이터 민감도 3단계**: 극민감(암호화 필수) / 민감(로컬 전용) / 일반(기본 저장)
- **승인 정책 Part별 분리** (전역 하드코딩 금지)
- **외부 연동은 MCP 커넥터 레이어 경유**
- **금융 쓰기 API 영구 차단** (구조적 불가능)
- **UI 네비게이션 Part 탭 구조** (탭 1개라도 탭 구조 사용)

### 장기 — 로컬 LLM 전환 (Gemma 4)
- **동기**: 개인 데이터의 외부 서버 노출 완전 차단
- MVP에서는 Claude Code 사용, 장기적으로 **Gemma 4(오픈 웨이트, 함수 호출 내장)로 Main 오케스트레이터까지 로컬 전환**
- Phase B: 극민감 Part를 Gemma 4(Ollama 로컬)로 전환, Main은 Claude Code 유지
- Phase C: Main 포함 전체 시스템 로컬화, 외부 API는 대표 명시적 허용 시에만
- **MVP에서 미리 박아둘 것**: 모든 모델 호출 LiteLLM 경유 (직접 API 호출 금지), Part Skill에 `MODEL_ROUTING` 필드, DB에 `model_provider` 컬럼

---

## 1. 프로젝트 목적

### 핵심 미션 (한 줄)
**"나(대표)를 위한, 나를 관리하는 AI 조직을 만든다."**

ClaudeManager는 **1인 CEO를 위한 AI 기반 전용 조직 운영 시스템**이다. Mac Mini에서 AI 오케스트레이터들이 하나의 조직처럼 동작하고, 대표는 웹 대시보드(=대표실)에서 어디서든 이 조직을 감독·지시·승인한다.

### 조직 구조 (비유)
- **Main 오케스트레이터** = 비서실장
- **Part** = 부서 (재정부, 일상부, 프로젝트부 등)
- **Sub 오케스트레이터** = 부서 팀장
- **인스턴스** = 외부 전문 인력
- **Part Skill** = 새 부서 설립 매뉴얼
- **웹 대시보드** = 대표실
- **Human-in-the-Loop** = 대표 결재
- **노트 기반 상태 관리 + 자동 복구** = 조직 인수인계 문서

### MVP 범위
프로젝트 Part Skill 하나부터 시작 — 대표의 아이디어를 AI 조직이 실제 개발 프로젝트로 수행하는 부서. 이후 대표가 필요한 부서(Skill)를 추가하며 조직을 확장한다.

### 핵심 가치
- 여러 AI 에이전트(=부서)를 **하나의 대시보드(대표실)에서 실시간으로 감독·지시**
- 모든 중요 결정은 **대표 결재 필수** (Human-in-the-Loop)
- 서버 재시작 시 **완전 자동 복구** — 조직 운영 연속성 보장
- **Skill 기반 확장성** — 새 부서는 Skill 작성으로 추가, 리팩토링 불필요

## 2. 핵심 사용자

대표 1인 (추후 팀 확장 가능성 열어둠)
- PC 데스크톱 브라우저가 주 사용 환경
- 모바일 브라우저에서 기본 모니터링 + 승인도 가능해야 함

## 3. 사용자가 겪는 문제

- 여러 Claude Code 에이전트를 동시에 실행하면 각각 터미널을 열어 수동 관리해야 함
- 에이전트 상태, 진행률, 오류를 한눈에 파악할 수 없음
- 의사결정이 필요할 때 즉시 알림을 받기 어렵고, 승인 프로세스가 없음
- 서버가 꺼지면 수동으로 모든 세션을 재구성해야 함
- AI 모델별 비용 추적, API 키 관리가 분산되어 있음

## 4. 핵심 기능 (Must Have)

### 아키텍처
- **4계층 구조**: Main 오케스트레이터(비서실장) → **Part 오케스트레이터(부서장, Skill로 생성)** → Sub 오케스트레이터들(팀장) → 인스턴스들(외주, LiteLLM 경유)
- 오케스트레이터(Main+Part+Sub)는 반드시 Claude Code (파일 시스템 접근, 도구 실행, Hooks 필수)
- **Part 오케스트레이터**: 도메인 내 복수 Sub 관리. 예) 프로젝트 Part 하나가 여러 개발 프로젝트를 Sub 단위로 운영
- 인스턴스는 Sub가 부분 태스크를 외주하는 용도 (리뷰, 분석, 요약 등)
- Part 내 Sub 간 독립 운영 (간섭 없음)

### 모니터링
- 전체 대시보드: 모든 프로젝트 목록, 진행 단계, 실시간 상태
- 프로젝트 상세: Sub 오케스트레이터 + 인스턴스 트리 구조, 승인 대기 강조
- 인스턴스 상세: 실시간 작업 내용, 터미널 화면(xterm.js), 작업 로그
- 비용 대시보드: 모델별 토큰 사용량, API 비용 (일/주/월/프로젝트별), 임계값 알림
- Mac Mini 헬스: CPU/메모리/디스크/네트워크 실시간 모니터링, 임계값 알림

### 제어
- 프로젝트 관리: 새 프로젝트 생성, 시작/일시정지/재시작/중단, 우선순위 변경
- 의사결정 승인 시스템: 승인/반려/수정 지시, 승인 이력 저장
- 인스턴스 모델 선택: 호출 전 모델 추천 카드(품질/속도/비용) → 내가 직접 선택 (Phase 1)

### 의사결정 흐름 (Human-in-the-Loop)
- Sub → Main에게 의사결정 전달 → Hook(HTTP POST) → 웹앱 → 나에게 알림
- 나는 Main에게만 지시, Sub에 직접 지시 안 함
- 승인 없이 다음 단계 진행 불가

### 알림
- 웹 대시보드: 승인 대기 배지, 실시간 알림
- 브라우저/모바일 푸시 알림
- 트리거: 승인 요청 발생, 에이전트 오류+재시도 실패, 프로젝트 단계 완료, 비용 임계값 초과, 서버 재시작 복구 완료

### 오류 처리
- 에이전트 실패 시 자동 N회 재시도 (횟수/간격 설정 가능)
- 모든 재시도 실패 시 에이전트 정지 + 나에게 알림
- 오류 로그 전체 저장

### API 키 관리 센터
- 여러 AI 제공사 API 키를 웹에서 안전하게 등록·갱신
- 키별 사용량 추적, 만료일 알림, 암호화 저장

### 노트 기반 상태 관리 + 자동 복구
- `.orchestrator/` 폴더에 main-context.md, sub-contexts/, decisions/, progress/ 관리
- Claude Code Hooks가 작업 시점마다 context.md 자동 업데이트
- 이중 저장: 노트(파일)는 오케스트레이터용, 로컬 DB는 대시보드용
- PM2 + macOS launchd로 서버 재시작 시 완전 자동 복구
- 복구 흐름: PM2 시작 → 백엔드 → .orchestrator/ 스캔 → tmux 재생성 → Claude Code가 context.md 읽고 이어서 → 푸시 알림

## 5. 선택 기능 (Nice to Have)

- 인스턴스 모델 자동 선택 — 축적 데이터 기반 태스크 유형별 최적 모델 자동 선택 + 비용/품질 리포트 (Phase 2)
- AI 모델 성능 비교 대시보드 (Phase 2)
- 스케줄링/자동 실행 — Cron 스타일 태스크 예약, 실행 이력 저장 (Phase 2)
- 상세 분석 리포트 — 비용, 생산성, 오류율 (Phase 2)
- 알림 채널 확장 — Slack/Discord (Phase 2)
- 프로젝트 템플릿 (Phase 2)
- Agent SDK 전환 — 프로그래매틱 제어, tmux는 디버깅용으로 남김 (Phase 2)

## 6. 제외 기능 (Out of Scope)

- 네이티브 모바일 앱 (Phase 3로 연기)
- 다중 사용자/팀 기능 (MVP 범위 밖)
- 자체 AI 모델 학습/파인튜닝

## 7. 참고할 서비스

- **mukul975/claude-team-dashboard** — 파일 기반 통신, 에이전트 트리 UI, WebSocket 실시간 업데이트
- **disler/claude-code-hooks-multi-agent-observability** — Hooks 이벤트 수집, 24개 이벤트 타입, 실시간 타임라인 UI
- **blog.marcnuri.com/ai-coding-agent-dashboard** — tmux 세션 관리, WebSocket 터미널 릴레이, heartbeat 패턴

## 8. 추가 요구사항

### 기술 스택 (확정)
| 구성 | 기술 |
|---|---|
| 프론트엔드 | Next.js (반응형 웹) |
| 백엔드 | Node.js + WebSocket |
| DB | SQLite (로컬, better-sqlite3) |
| AI Gateway | LiteLLM (100+ 모델 단일 인터페이스) |
| 태스크 관리 | 노트 기반 (.orchestrator/) + Hooks + PM2 |
| 파일 감시 | chokidar |
| 터미널 | xterm.js + node-pty |
| 이벤트 수집 | Claude Code Hooks (HTTP POST) |
| 세션 관리 | tmux |
| 프로세스 관리 | PM2 + macOS launchd |
| 상태 저장 | .orchestrator/*.md (노트 기반) |
| 로컬 LLM 런타임 | Ollama (Gemma 4 — Phase 확장) |
| 배포 | 로컬 (PM2 + Caddy + Cloudflare Tunnel) |

### 배포 단계 (2단계 전략)

- **Phase A — 개발·검증 (MacBook 로컬)**: MVP 구현 및 검증. 외부 접근 없이 단일 사용자 로컬 테스트. 24/7 상시 실행·외부 접근은 시도하지 않음 (MacBook 특성상 부적합)
- **Phase B — 본격 운영 (Mac Mini Pro로 이전)**: 24/7 상시 실행, 외부 접근 (Cloudflare Tunnel 등), PM2+launchd 자동 부팅, 여러 Part 동시 운영

### 이전 용이성 설계 원칙 (Phase A부터 박아둘 것)

- **절대 경로 하드코딩 금지** — 환경변수 기준 (`$CLAUDEMANAGER_HOME`, `$PROJECTS_ROOT`, `$SKILL_LIB`)
- **Skill 라이브러리 경로 고정**: `~/.claudemanager/skills/`
- **설정 외부화**: DB 경로, API 키, 경로는 `.env` 또는 config 파일
- **데이터 위치 추상화**: `.orchestrator/` 경로는 상대 경로 또는 환경변수
- **마이그레이션 스크립트**: `migrate-to-new-machine.sh` MVP 산출물에 포함
- **Claude Code 인증 이식**: `~/.claude/` 이전 절차 문서화

### DB 저장 데이터 및 역할 분담

#### 노트(파일) vs DB 역할 분담
| 저장소 | 역할 | 예시 |
|---|---|---|
| `.orchestrator/*.md` | 오케스트레이터가 읽고 이어서 작업하는 **컨텍스트** | context.md, decisions/, progress/ |
| **SQLite DB** | 대시보드가 빠르게 조회하는 **구조화된 상태** | 에이전트 트리, 승인 큐, 비용 집계, 알림 |

- 노트 = 에이전트의 "인수인계 문서", DB = 대시보드의 "조회용 데이터 소스"
- Hooks가 이벤트 발생 시 양쪽에 동시 기록

#### DB에 저장되는 데이터
1. **에이전트/세션 관리**: Part 정보(part_id, skill_name, skill_version, sensitivity_level, model_provider, 상태), Sub 오케스트레이터(sub_id, part_id, 프로젝트명, 진행 단계, 상태), 인스턴스(instance_id, sub_id, 모델명, 태스크 유형, 상태, tmux 세션 ID)
2. **의사결정/승인 (Human-in-the-Loop)**: 승인 요청(출처, 내용, 긴급도), 승인 이력(승인/반려/수정지시, 코멘트, 처리 시각)
3. **비용/토큰 추적**: API 호출 로그(instance_id, 모델명, 입력/출력 토큰, 비용, 타임스탬프), 일/주/월/프로젝트별 비용 집계
4. **알림**: 트리거 유형(승인요청/오류/완료/비용초과/복구), 대상, 읽음 여부, 발생 시각
5. **오류/재시도**: 오류 로그(에러 메시지, 스택 트레이스, 재시도 횟수, 최종 상태), Part별 재시도 정책(횟수/간격)
6. **API 키 관리**: 제공사, 키(암호화), 만료일, 사용량, 상태
7. **프로젝트 진행 상태**: 단계별 진행률, 시작/완료 시각
8. **Skill 메타데이터**: skill_name, 버전, 상속 관계, 스키마 정의, 등록일
9. **시스템 헬스 (시계열)**: CPU/메모리/디스크/네트워크, 타임스탬프

### 미결정 사항

- Mac Mini Pro 외부 접근 방식: Cloudflare Tunnel / VPS / 고정IP 중 미정 (Phase B에서 결정)
- 인증/보안 방식: 1인 사용이므로 간단하게 가능, 설계 단계에서 결정
- 재시도 횟수/간격 기본값: 설계 단계에서 결정

### 개발 로드맵
- **Phase 1 (MVP)**: 모니터링 + 제어 + 인프라 (tmux + CLI + Hooks 패턴)
- **Phase 2**: 고도화 — 자동 모델 선택, 분석 리포트, 스케줄링, Agent SDK 전환 검토
- **Phase 3**: 네이티브 모바일 앱

### 컨셉 논의 자료
상세한 기술 검토, 시스템 흐름도, 노트 기반 상태 관리 설계 등은 `ClaudeMonitor-컨셉정리/` 폴더에 보관되어 있음:
- 멀티AI-오케스트레이션-모니터링-웹앱.md (초기 컨텍스트)
- ClaudeMonitor-기술검토.md (기술 타당성 분석 + 참고 오픈소스)
- ClaudeMonitor-시스템-흐름도.md (시퀀스 다이어그램)
- ClaudeMonitor-노트기반-상태관리.md (상태 관리 + 자동 복구 설계)
- ClaudeMonitor-요구사항-정리.md (요구사항 반복 정리 과정)
