# DR003. Sub 에이전트 스킬 주입 방식 — Part 전용 인스턴스의 정체성 정착

> 상태: ⏳ 대표 결정 대기
> 유형: 내부 아키텍처 / 에이전트 런타임
> 작성: 2026-04-23
> 선행 문서: `02_concept/📌 DR001-yj-manager-hierarchy.md` (Main/Part/Sub 3계층), [Skill-driven Part 시스템 메모](../.claude)
> 관련 메모리: `project_skill_driven_part_system.md`, `project_agent_architecture.md`, `project_yj_manager_hierarchy.md`
> 트리거: "Finance Sub가 자기 스킬을 모른다"는 대표 지적 (2026-04-23)

---

## 0. 용어 정의

| 용어 | 정의 |
|---|---|
| **Part** | 부서 단위. Skill(bash schema/execute)로 동적 생성되며 `parts.skillName` + `parts.skillVersion`으로 스킬 바인딩을 기록한다. |
| **Sub** | Part 소속 수행 에이전트. 사용자와 직접 채팅하며 Part의 도메인 규칙·경계를 지켜야 한다 (메모 `project_agent_architecture.md`). |
| **스킬 주입** | Sub가 채팅 세션을 열 때, 자기 Part의 스킬이 정의한 역할·규칙·경계를 system prompt로 받는 절차. |
| **Part context** | Part 생성 시 스킬이 써 둔 도메인 지침 문서 (현재 `main-context.md` 뿐). |

---

## 1. 문제 (Context)

### 1-1. 발견된 누락
`04_development/app/src/app/api/agents/[id]/chat/route.ts:95-97`

```typescript
const systemPrompt = agent.role === 'main'
  ? loadMainSkill()
  : `You are ${agent.name}, an AI agent managed by YJ Manager. ...`;
```

- **Main**만 `loadMainSkill()` 호출 → 제대로 주입.
- **Sub / Instance**는 이름만 담긴 한 줄 제네릭 프롬프트. Part 도메인 지식 0.
- `parts.skillName` / `skills.filePath` / `parts.orchestratorPath` 전부 DB에 있는데 **아무도 안 읽음**.
- `orchestrator.ts`의 `startSub`도 폴더/tmux 세션만 만들고 스킬 주입 경로 없음.

### 1-2. 이게 왜 구조 실패인가
- Part를 **일부러 스킬별로** 분리한 이유: 부서마다 정체성·경계·금지선이 다르기 때문. (예: Finance는 실행 금지, Marketing은 외부 게시 제약 등)
- Sub가 그걸 모르면 **Part를 나눈 의미가 없음**. 어차피 이름만 다른 제네릭 Claude가 여러 개 도는 상태.
- 메모 `project_agent_architecture.md` 원칙 ("Sub=프로젝트 관리+수행(CLAUDE.md 스타일 Skill 주입)") 과도 어긋남.

### 1-3. 현재 실행 상태 (2026-04-23 시점)
- Postgres 컨테이너 OFF → Finance Part/Sub row 직접 확인 불가.
- 디스크: `~/.claudemanager/.orchestrator/` 에 Part 1개(`개발부`, `main-context.md`만) 존재. Finance 관련 폴더 없음.
- `~/.claudemanager/skills/` 디렉터리 자체 미생성. `installDefaultSkills()`가 한 번도 안 돌았거나 skills dir가 삭제된 상태.

---

## 2. 선택지 (Options)

### Option A. Part 폴더에 `sub-prompt.md`를 스킬이 생성 → 채팅 라우트가 파일로 읽어 주입

**흐름**
1. 스킬 bash (`finance-part.sh execute …`)가 실행 시 `main-context.md` 외에 **`sub-prompt.md`**도 써준다. 내용은 "너는 Finance Part 소속 Sub다. 금융 실행 금지. …" 같은 CLAUDE.md 스타일.
2. `parts.orchestratorPath`는 이미 Part 폴더 경로를 담고 있음.
3. `chat/route.ts`에서 `agent.role === 'sub' || agent.role === 'instance'`일 때 `partId` → `parts.orchestratorPath` → `{partDir}/sub-prompt.md` 읽어 system prompt로 주입.
4. 파일이 없으면 안전장치: 기본 제네릭 + 에러 로그 (사일런트 폴백 금지).

**장점**
- 정착성 ★★★ — 스킬 실행물이 파일로 남아 백업·Git·수동 편집 모두 가능.
- 런타임 비용 낮음 (매 채팅마다 파일 read 1회).
- Sub/Instance 계층 어디서든 같은 파일 사용 가능 → 일관성.
- 스킬 업그레이드 시 Part 재생성 안 해도 파일만 교체하면 됨.

**단점**
- 스킬 bash가 2개 파일을 만들어야 해서 템플릿이 살짝 두꺼워짐.

---

### Option B. 스킬 bash에 `prompt` 서브커맨드 추가 → 채팅 때마다 bash 실행해서 stdout 수신

**흐름**
1. `finance-part.sh prompt <partId>` → stdout으로 system prompt 텍스트 출력.
2. 채팅 라우트가 매 요청마다 bash 실행.

**장점**
- 프롬프트가 스킬 bash 안에 **그 자체로** 들어있어서 단일 소스.

**단점**
- 채팅 호출마다 bash `execFile` — 지연+부하 증가 (Sub가 많아지면 비용 선형 증가).
- Part 특수 설정(생성 시 입력한 값)을 반영하려면 bash가 매번 `input.json` 읽어 템플릿팅해야 함. 복잡도 상승.
- 파일 시스템에 "왜 이 Sub가 이 규칙을 쓰는가"의 스냅샷이 남지 않음 (Git diff, 백업에 안 잡힘).

---

### Option C. DB `skills.systemPromptMd` 컬럼 추가 → 채팅 시 DB 한 줄 조회

**흐름**
1. `skills` 테이블에 `system_prompt_md` 컬럼 신설.
2. 스킬 등록/업그레이드 시 값을 채워둠.
3. 채팅 라우트는 `agent.partId → parts.skillName → skills.systemPromptMd` 조회.

**장점**
- DB 한 번 read로 끝. 가장 빠름.
- 스킬 버전별로 DB에 히스토리 남기기 좋음.

**단점**
- Part 생성 시 입력값(예: "이 Finance Part는 실행금지 레벨=critical")이 프롬프트에 반영되지 않음. 모든 Finance Sub가 동일 프롬프트. → 메모리 `project_yj_manager_permission.md`의 "개별 예외 DR"과 궁합 안 맞음.
- 스키마 마이그레이션 필요.
- Git/수동 편집 자연성이 떨어짐 (DB row 편집).

---

## 3. 판단 기준

| 기준 | 가중치 | A (파일) | B (bash prompt) | C (DB 컬럼) |
|---|---|---|---|---|
| 정착성·Git 추적 가능성 | ★★★ | ◎ | △ | △ |
| Part별 입력값 반영 | ★★★ | ◎ | ◎ | ✗ |
| 런타임 비용 | ★★ | ◎ (파일 read) | △ (bash 실행) | ◎ (DB read) |
| 수동 편집·디버깅 용이성 | ★★ | ◎ | △ | △ |
| 구현 변경 범위 | ★ | 작음 (라우트+스킬 템플릿) | 작음 | 큼 (마이그레이션) |

---

## 4. 추천

**Option A (Part 폴더 `sub-prompt.md` 파일)**

이유:
1. 스킬 시스템 철학(메모 `project_skill_driven_part_system.md`: "Part는 bash Skill로 **동적 생성**") 과 가장 맞음 — 스킬의 **산출물**이 Part 정체성이 된다는 구조를 살린다.
2. 백업·복구 메커니즘(메모 `project_note_based_state.md`)과도 맞음 — `.orchestrator/` 폴더가 상태·복구 수단이고, 여기에 sub-prompt가 포함되면 복구 시 스킬도 살아남음.
3. Sub 권한 경계가 Part마다 다르다(DR002 메모 `project_yj_manager_permission.md`)는 원칙을 Part 폴더 단위 격리로 자연스럽게 반영.

---

## 5. 결정 시 후속 작업 (Option A 선택 가정)

1. **스킬 템플릿 보강**: `src/lib/skill-engine.ts`의 `BASE_PART_SCRIPT` / `PROJECT_PART_SCRIPT`가 `sub-prompt.md`도 쓰도록 수정. `finance-part.sh` 신규 작성 (금융 실행 금지 명시).
2. **채팅 라우트 주입 경로**: `04_development/app/src/app/api/agents/[id]/chat/route.ts:95` 분기를 Sub/Instance에서 `partId → orchestratorPath/sub-prompt.md` 로드하도록 교체. 파일 누락 시 에러 로그 후 제네릭 폴백.
3. **CLI 세션 캐시 무효화**: 기존 Sub의 `cli_session_id`는 구 프롬프트 문맥을 기억 중. 스킬을 다시 주입하려면 세션을 비워 새 대화로 시작해야 함 → Finance Sub는 `cli_session_id` NULL 처리 + 환영 메시지 재전송.
4. **Finance Sub 초기화 절차**:
   - DB: `agents` Finance Sub row 삭제 (또는 soft-reset: `cli_session_id=NULL`, `started_at=NULL`).
   - 디스크: `.orchestrator/{finance-part-id}/sub-contexts/{sub-id}.md` 삭제.
   - Finance Part 재생성 or 기존 Part에 `sub-prompt.md` 새로 써 넣기.
   - Sub 생성 API 재호출 → 첫 메시지로 `sub-prompt.md` 주입 확인.
5. **회귀 방지**: `installDefaultSkills()`에 `finance-part` 포함. `instrumentation.ts` 부팅 시 실행되는지 확인 후, 없으면 부팅 훅에 추가.
6. **문서 갱신**: `03_design/🏗️ architecture.md` 에이전트 런타임 절에 "Sub 시스템 프롬프트 = Part의 sub-prompt.md" 기재. 메모리 `project_skill_driven_part_system.md`에 "스킬은 main-context.md + sub-prompt.md 2개 산출"을 추가.

---

## 6. 미해결 이슈 (결정 후 별도 논의)

- Instance 계층(같은 Sub 아래 병렬 인스턴스)은 Sub와 **동일 프롬프트**로 시작하는가, 아니면 작업 지시 오버레이를 더 얹는가? → 현재는 동일로 가정. Instance 특화가 필요하면 `sub-prompt.md`에 더해 런타임 변수 섹션을 주입하는 방식 검토 (별 DR).
- 스킬 버전업 시 이미 생성된 Part의 `sub-prompt.md`를 자동 재생성할지, 명시적 `reinstall` 커맨드를 요구할지. → Option A 하에선 "수동 덮어쓰기 + `skill-version.lock` 갱신"이 기본. 자동 재생성은 Part 입력값 보존 이슈가 있어 별도 결정.

---

## 7. 🎯 대표 결정

> 여기에 A / B / C 중 선택과 이유를 한 줄로 적어주세요.
> 결정 시 본 DR 상태를 ✅ 로 바꾸고, 관련 메모리 (`project_skill_driven_part_system.md`, `project_agent_architecture.md`)를 갱신합니다.

**선택:**
**이유:**
**결정일:**
