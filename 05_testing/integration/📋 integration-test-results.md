# 통합 테스트 결과 (Phase 2 갱신)
> 작성: tester | 일시: 2026-04-16 | 상태: FAIL (1건)

## 요약

| 항목 | 값 |
|---|---|
| 총 테스트 파일 | 14 (헬퍼 1 + 테스트 13) |
| 총 테스트 케이스 | 150 |
| PASS | 149 |
| FAIL | 1 |
| 실행 시간 | ~5.3s |
| Phase 2 신규 통합 테스트 | 0 (미작성) |

## Phase 1 기존 통합 테스트 실행 결과

### 실행 결과

```
 Test Files  1 failed | 13 passed (14)
      Tests  1 failed | 149 passed (150)
   Duration  5.26s
```

### FAIL 상세 (1건)

**파일**: `src/__tests__/integration/system-health.test.ts`
**테스트**: `I5-009: Health record with zero active agents is valid`
**결과**: `expected 2 to be 0`

**원인 분석**:
- I5-001에서 `activeAgents: 2` 레코드를 `createdAt` 지정 없이 삽입 → SQLite `datetime('now')` 사용 → 현재 시간(2026-04-16)
- I5-009에서 `activeAgents: 0` 레코드를 `createdAt: '2026-04-15T10:15:00Z'` 하드코딩으로 삽입
- `ORDER BY created_at DESC LIMIT 1` 쿼리 시 I5-001의 레코드(현재 시간)가 I5-009 레코드(어제)보다 최신 → `activeAgents: 2` 반환
- **분류**: 테스트 코드 버그 (프로덕션 코드 버그 아님)
- **수정 방향**: I5-009의 `createdAt`을 미래 시간(예: '2099-01-01T00:00:00Z')으로 변경하거나, I5-001에도 명시적 `createdAt`을 지정해야 함

### PASS 상세 (149건)

모든 기존 통합 테스트 (Phase 1)는 DB 스키마 변경(agent_checkpoints, message_queue, execution_queue 테이블 추가) 후에도 정상 동작. 회귀 없음.

## Phase 2 신규 모듈 통합 테스트 커버리지 분석

### 1. 통합 테스트 미작성 모듈 (Critical)

| 모듈 | 파일 | 단위 테스트 | 통합 테스트 | 비고 |
|---|---|---|---|---|
| checkpoint-manager | src/lib/checkpoint-manager.ts | 없음 | 없음 | DB 직접 접근, 프루닝 로직 |
| execution-queue | src/lib/execution-queue.ts | 없음 | 없음 | DB 직접 접근, 우선순위 정렬 |
| agent-manager | src/lib/agent-manager.ts | 없음 | 없음 | child_process.spawn, EventEmitter |
| priorityStore | src/stores/priorityStore.ts | 없음 | 없음 | API 호출 + 상태 관리 |
| workspaceStore | src/stores/workspaceStore.ts | 없음 | 없음 | 순수 UI 상태 (순수 함수) |

### 2. 통합 테스트 미작성 API 엔드포인트 (Critical)

| 엔드포인트 | 파일 | 통합 테스트 | 비고 |
|---|---|---|---|
| GET /api/projects | src/app/api/projects/route.ts | 없음 | priority 기반 정렬 |
| PUT /api/projects/:id/priority | src/app/api/projects/[id]/priority/route.ts | 없음 | 감사 로그 미기록 (버그) |
| PUT /api/projects/reorder | src/app/api/projects/reorder/route.ts | 없음 | updatedAt 기반 순서 |
| GET /api/agents/:id/checkpoints | src/app/api/agents/[id]/checkpoints/route.ts | 없음 | checkpoint-manager 연동 |
| POST /api/agents/:id/checkpoints | 동일 | 없음 | checkpoint-manager 연동 |
| GET /api/execution/status | src/app/api/execution/status/route.ts | 없음 | execution-queue 연동 |

### 3. 통합 테스트 미작성 연동 시나리오

| 연동 흐름 | 설명 | 상태 |
|---|---|---|
| agent-manager → execution-queue | 에이전트 스폰 시 큐에서 dequeue → 완료 시 markCompleted | 미테스트 |
| checkpoint-manager → DB | 체크포인트 저장 → 복원 → 프루닝(최대 3개) | 미테스트 |
| execution-queue → 우선순위 정렬 | urgent > high > normal > low FIFO | 미테스트 |
| priority 변경 → execution-queue 선점 | 프로젝트 우선순위 변경 → 큐 재정렬 | 미구현 |
| priority 변경 → 감사 로그 | PUT /api/projects/:id/priority → audit_logs | 미구현 (버그) |
| message_queue | 에이전트 간 메시지 큐 | 스키마만 존재, 코드 없음 |

## 발견된 버그

### BUG-INT-001: I5-009 테스트 FAIL (테스트 코드 버그)
- **위치**: `src/__tests__/integration/system-health.test.ts:177`
- **심각도**: Low (테스트 코드)
- **증상**: `expected 2 to be 0`
- **원인**: I5-001의 `createdAt`이 `datetime('now')` (현재 시간)이고, I5-009의 `createdAt`이 '2026-04-15T10:15:00Z' (어제)로 하드코딩. 최신 레코드 쿼리 시 I5-001이 반환됨.
- **수정**: I5-009의 createdAt을 미래 시간으로 변경 필요

### BUG-INT-002: priority 변경 API에 감사 로그 누락 (코드 버그)
- **위치**: `src/app/api/projects/[id]/priority/route.ts`
- **심각도**: Medium
- **증상**: PUT /api/projects/:id/priority 호출 시 `audit_logs` 테이블에 기록 없음
- **기대**: F021(우선순위 변경) + F061(감사 로그)에 따라 priority_change 감사 로그 기록 필요
- **참고**: 감사 로그 통합 테스트(I6)의 priority_change는 DB에 직접 삽입하는 방식이라 이 API 버그를 잡지 못함

### BUG-INT-003: execution-queue.ts에 미사용 import (코드 품질)
- **위치**: `src/lib/execution-queue.ts:17`
- **심각도**: Low
- **증상**: `import { DEFAULT_MAX_CONCURRENT_AGENTS } from './constants'`가 import되었으나 파일 내에서 사용되지 않음
- **의미**: execution-queue가 자체적으로 동시 실행 제한을 강제하지 않음. 외부 호출자가 `getRunningCount()`로 확인해야 함.

## 기존 통합 테스트 상세 (Phase 1, 변경 없음)

### A. 기존 통합 테스트 (86 tests) - ALL PASS

1. 인증 흐름 (db-api-auth.test.ts, 10 tests) - PASS
2. 에이전트 CRUD + 트리 (db-api-agents.test.ts, 10 tests) - PASS
3. 승인 워크플로우 (db-api-approvals.test.ts, 10 tests) - PASS
4. API 키 관리 (db-api-apikeys.test.ts, 10 tests) - PASS
5. 비용 집계 (db-api-cost.test.ts, 10 tests) - PASS
6. 설정 + Part 정책 (db-api-settings.test.ts, 10 tests) - PASS
7. Store-API 연동 (store-api-integration.test.ts, 10 tests) - PASS
8. 크로스커팅 (cross-cutting.test.ts, 16 tests) - PASS

### B. 신규 통합 테스트 (64 tests) - 63 PASS / 1 FAIL

1. 전체 오케스트레이션 흐름 (orchestration-full-flow.test.ts, 12 tests) - PASS
2. 이중 저장 일관성 (dual-storage-consistency.test.ts, 10 tests) - PASS
3. 알림 시스템 통합 (notification-system.test.ts, 10 tests) - PASS
4. 설정 -> 동작 반영 (settings-propagation.test.ts, 10 tests) - PASS
5. 시스템 헬스 통합 (system-health.test.ts, 10 tests) - 9 PASS / 1 FAIL (I5-009)
6. 감사 로그 무결성 (audit-log-integrity.test.ts, 12 tests) - PASS

## Phase 2 필요 통합 테스트 목록 (미작성)

아래 통합 테스트가 작성되어야 Phase 2 통합 테스트가 완료됨:

### P2-INT-1: checkpoint-manager + DB 통합
- 체크포인트 저장 → DB 조회 (agent_checkpoints)
- 프루닝: 4개 이상 저장 시 최신 3개만 유지
- buildRecoveryPrompt: 체크포인트 → 복구 프롬프트 생성
- computeOutputHash: SHA-256 해시 일관성
- agent FK 참조 무결성

### P2-INT-2: execution-queue + DB 통합
- enqueue → dequeueNext (우선순위 정렬 검증)
- urgent 태스크가 normal보다 먼저 dequeue
- 동일 우선순위 내 FIFO 순서
- markRunning → markCompleted 상태 전이
- markFailed → getQueueStatus 카운트
- cancelTask: queued만 취소 가능

### P2-INT-3: projects API + DB 통합
- GET /api/projects: priority 기반 정렬
- PUT /api/projects/:id/priority: 변경 → DB 반영 + 감사 로그
- PUT /api/projects/reorder: 순서 변경 → updatedAt 기반
- 존재하지 않는 프로젝트 priority 변경 → 404
- 유효하지 않은 priority 값 → 400

### P2-INT-4: checkpoints API + DB 통합
- POST /api/agents/:id/checkpoints → checkpoint-manager → DB
- GET /api/agents/:id/checkpoints → 최신순 조회

### P2-INT-5: execution status API + DB 통합
- GET /api/execution/status → getQueueStatus → DB

### P2-INT-6: agent-manager + execution-queue 연동
- agent-manager.spawnAgent → execution-queue.dequeueNext 연동
- (현재는 두 모듈이 독립적 - 연동 코드 미구현)

### P2-INT-7: 회귀 + 스키마 호환성
- 기존 14개 통합 테스트 전체 PASS 확인 (I5-009 제외) ← 완료

## 테스트 방법론

- **인메모리 SQLite**: 각 테스트 스위트가 독립된 인메모리 DB를 생성하여 격리된 환경에서 실행
- **Drizzle ORM**: 실제 프로덕션과 동일한 ORM을 사용하여 스키마 정합성 검증
- **test-db.ts**: Phase 2 테이블(agent_checkpoints, message_queue, execution_queue) 포함 확인됨
- **파일 시스템 격리**: 이중 저장 테스트는 /tmp 하위 임시 디렉토리를 사용하여 격리
