# 단위 테스트 결과
> 작성: tester | 상태: 완료 (v4.0 -- SQLite->PostgreSQL 마이그레이션 후 재검증)
> 프레임워크: Vitest 4.1.4
> 실행: `pnpm vitest run`
> 실행일: 2026-04-23
> 결과: **61 파일, 647 테스트 (485 PASS / 54 FAIL / 108 SKIP)**

---

## 1. 테스트 요약

| 항목 | v3.0 (이전) | v4.0 (현재) | 변경 |
|---|---|---|---|
| 총 테스트 파일 | 61 | 61 | 동일 |
| 총 테스트 케이스 | 647 | 647 | 동일 |
| PASS | 646 | 485 | -161 |
| FAIL | 1 | 54 | +53 |
| SKIP | 0 | 108 | +108 (통합 테스트 환경 미구성) |
| 실행 시간 | ~7.6s | ~38s | 증가 |

### 전체 판정: FAIL

---

## 2. 실패 원인 분류

### [ROOT-CAUSE-1] PostgreSQL 마이그레이션 후 테스트 코드 미갱신 (주요 원인)

`schema.ts`가 `drizzle-orm/sqlite-core` -> `drizzle-orm/pg-core`로 마이그레이션되어 `pgTable`, `serial`, `pg-core` 타입을 사용하도록 변경되었다.

그러나 통합 테스트 헬퍼(`src/__tests__/integration/helpers/test-db.ts`)는 여전히 `better-sqlite3` + SQLite 인메모리 DB를 사용하며, drizzle-orm이 PostgreSQL 문법(`::`캐스트 연산자 등)을 SQLite에 대해 실행하려다 오류가 발생한다.

**에러 메시지 예시:**
```
SqliteError: unrecognized token: ":"
```

`schema.ts`의 `now()::text` 같은 PostgreSQL 전용 문법이 SQLite에서 파싱 불가.

영향 범위: 통합 테스트 전 파일 (db-api-auth, db-api-agents, db-api-apikeys, orchestration-full-flow 등)

---

### [ROOT-CAUSE-2] agent-queue.ts: 비동기(async) 함수를 동기 mock으로 테스트

`agent-queue.ts`의 모든 exported 함수(`getMaxConcurrentAgents`, `getActiveAgentCount`, `getQueuedAgents`, `tryActivateAgent`, `onAgentFinished`, `getQueueStatus`)가 `async` 함수로 변경되었으나 테스트 코드는 동기 호출로 mock하고 있다.

**에러 메시지 예시:**
```
AssertionError: expected 5 to be [object Promise]
```

또한 `onAgentFinished` 내부에서 `const [next] = await getQueuedAgents()`의 결과가 `undefined`일 때 `next.id` 접근으로 Unhandled Rejection 발생.

영향: `agent-queue.test.ts` 10/11 FAIL

---

### [ROOT-CAUSE-3] backup-scheduler.ts: PostgreSQL(pg_dump) 방식으로 변경, SQLite mock 불일치

`backup-scheduler.ts`가 SQLite `fs.copyFileSync` 방식에서 `pg_dump` 명령 실행 방식으로 변경되었으나, 테스트 코드는 SQLite DB 파일 복사를 기대하는 mock 구조를 유지하고 있다.

`cleanupOldBackups` 내부에서 `await db.select()...orderBy()` 체인의 결과가 배열이 아닌 Promise를 반환하여 `allBackups.slice is not a function` 오류 발생.

영향: `backup-scheduler.test.ts` 4/6 FAIL

---

### [ROOT-CAUSE-4] key-expiry-checker.ts: async 함수, mock 체인 불일치

`checkKeyExpiry`가 async 함수이며 내부에서 `await db.select().from().where()` 체인을 사용한다. 테스트 mock은 동기 `.all()` 반환을 기대하지만 실제 코드는 Promise를 반환한다.

`mockUpdate`, `mockInsert` 체인이 실제 코드의 async 흐름과 맞지 않아 호출 횟수 검증 실패.

영향: `key-expiry-checker.test.ts` 3/5 FAIL

---

### [ROOT-CAUSE-5] error-logger.ts: broadcastLogNew 호출 타이밍

`logError`에서 `db.insert().values().then()` 비동기 패턴 사용 후 `broadcastLogNew`를 즉시 동기 호출하나, 테스트에서 `broadcastLogNew`가 `.then()` 콜백 밖에서 호출되기 때문에 mock 설정 순서 문제로 1건 FAIL.

영향: `error-logger.test.ts` 1/10 FAIL

---

## 3. 파일별 테스트 결과

### 3.1 lib 단위 테스트

| 테스트 파일 | 총 테스트 | PASS | FAIL | SKIP | 결과 | 비고 |
|---|---|---|---|---|---|---|
| auth.test.ts | 16 | 16 | 0 | 0 | PASS | |
| crypto.test.ts | 12 | 12 | 0 | 0 | PASS | |
| utils.test.ts | 17 | 17 | 0 | 0 | PASS | |
| constants.test.ts | 33 | 33 | 0 | 0 | PASS | |
| schema.test.ts | 17 | 17 | 0 | 0 | PASS | |
| api-client.test.ts | 3 | 3 | 0 | 0 | PASS | |
| orchestrator.test.ts | 20 | 20 | 0 | 0 | PASS | |
| skill-engine.test.ts | 14 | 14 | 0 | 0 | PASS | |
| ws-bridge.test.ts | 16 | 16 | 0 | 0 | PASS | |
| litellm.test.ts | 16 | 16 | 0 | 0 | PASS | |
| error-logger.test.ts | 10 | 9 | 1 | 0 | FAIL | broadcastLogNew 호출 타이밍 |
| agent-queue.test.ts | 11 | 1 | 10 | 0 | FAIL | async 함수 vs 동기 mock 불일치 |
| backup-scheduler.test.ts | 6 | 2 | 4 | 0 | FAIL | pg_dump 방식 변경, mock 불일치 |
| key-expiry-checker.test.ts | 5 | 2 | 3 | 0 | FAIL | async 흐름 mock 불일치 |

**lib 소계: 196 테스트 / 178 PASS / 18 FAIL**

### 3.2 Store 단위 테스트

| 테스트 파일 | 총 테스트 | PASS | FAIL | SKIP | 결과 |
|---|---|---|---|---|---|
| agentStore.test.ts | 12 | 12 | 0 | 0 | PASS |
| approvalStore.test.ts | 8 | 8 | 0 | 0 | PASS |
| notificationStore.test.ts | 7 | 7 | 0 | 0 | PASS |
| chatStore.test.ts | 7 | 7 | 0 | 0 | PASS |
| costStore.test.ts | 8 | 8 | 0 | 0 | PASS |
| settingsStore.test.ts | 9 | 9 | 0 | 0 | PASS |
| officeStore.test.ts | 8 | 8 | 0 | 0 | PASS |

**Store 소계: 59 테스트 / 59 PASS / 0 FAIL**

### 3.3 API 라우트 단위 테스트

| 테스트 파일 | 총 테스트 | PASS | FAIL | SKIP | 결과 |
|---|---|---|---|---|---|
| auth-routes.test.ts | 10 | 10 | 0 | 0 | PASS |
| agents-routes.test.ts | 6 | 6 | 0 | 0 | PASS |
| approvals-routes.test.ts | 8 | 8 | 0 | 0 | PASS |
| cost-routes.test.ts | 8 | 8 | 0 | 0 | PASS |
| settings-routes.test.ts | 6 | 6 | 0 | 0 | PASS |

**API 라우트 소계: 38 테스트 / 38 PASS / 0 FAIL**

### 3.4 시나리오 테스트 (src/__tests__/scenarios/)

모든 시나리오 테스트 파일은 vitest.config.ts `include` 경로에 포함되어 있으나, 실행 결과에서 별도 카운트되지 않음 (통합 테스트 파일로 분류된 것과 혼재). 별도 시나리오 테스트 파일 있으면 추후 확인 필요.

### 3.5 통합 테스트 (src/__tests__/integration/)

| 테스트 파일 | 총 테스트 | PASS | FAIL | SKIP | 결과 | 원인 |
|---|---|---|---|---|---|---|
| db-api-auth.test.ts | 10 | 5 | 5 | 0 | FAIL | SQLite/PG 스키마 불일치 |
| db-api-agents.test.ts | 10 | 0 | 10 | 0 | FAIL | SQLite/PG 스키마 불일치 |
| db-api-apikeys.test.ts | 10 | 1 | 9 | 0 | FAIL | SQLite/PG 스키마 불일치 |
| orchestration-full-flow.test.ts | 12 | 0 | 12 | 0 | FAIL | SQLite/PG 스키마 불일치 |
| system-health.test.ts | 10 | 0 | 0 | 10 | SKIP | 환경 미구성 |
| store-api-integration.test.ts | 10 | 0 | 0 | 10 | SKIP | 환경 미구성 |
| dual-storage-consistency.test.ts | 10 | 0 | 0 | 10 | SKIP | 환경 미구성 |
| notification-system.test.ts | 10 | 0 | 0 | 10 | SKIP | 환경 미구성 |
| settings-propagation.test.ts | 10 | 0 | 0 | 10 | SKIP | 환경 미구성 |
| audit-log-integrity.test.ts | 12 | 0 | 0 | 12 | SKIP | 환경 미구성 |
| cross-cutting.test.ts | 16 | 0 | 0 | 16 | SKIP | 환경 미구성 |
| db-api-cost.test.ts | 10 | 0 | 0 | 10 | SKIP | 환경 미구성 |
| db-api-approvals.test.ts | 10 | 0 | 0 | 10 | SKIP | 환경 미구성 |
| db-api-settings.test.ts | 10 | 0 | 0 | 10 | SKIP | 환경 미구성 |

**통합 테스트 소계: 150 테스트 / 6 PASS / 36 FAIL / 108 SKIP**

---

## 4. 발견된 버그 요약

| ID | 심각도 | 영역 | 설명 | 영향 기능 |
|---|---|---|---|---|
| BUG-UT-101 | Critical | 통합 테스트 전체 | test-db.ts 헬퍼가 SQLite(better-sqlite3)를 사용하나 schema.ts는 PostgreSQL(pg-core)로 마이그레이션됨. `now()::text` 등 PG 전용 문법이 SQLite에서 파싱 실패 | F001~F075 (통합) |
| BUG-UT-102 | High | agent-queue.ts | 소스 코드는 async 함수이나 테스트는 동기 mock. await 없이 Promise를 비교하여 모든 assert 실패. 추가로 onAgentFinished에서 next가 undefined일 때 next.id 접근으로 Unhandled Rejection | F070~F072 |
| BUG-UT-103 | High | backup-scheduler.ts | SQLite 파일 복사 방식에서 pg_dump 방식으로 변경되었으나 테스트 mock 미갱신. cleanupOldBackups에서 db.select() 반환값이 Promise인데 .slice()를 직접 호출하여 TypeError | F068~F069 |
| BUG-UT-104 | High | key-expiry-checker.ts | checkKeyExpiry가 async 함수이나 테스트에서 await 없이 호출. update/insert mock이 실제 async 체인과 불일치하여 호출 검증 실패 | F038 |
| BUG-UT-105 | Medium | error-logger.ts | broadcastLogNew가 db.insert().then() 체인 밖에서 동기 호출되나 테스트 mock 검증 타이밍 문제로 1건 FAIL | F034 |
| BUG-UT-001 | Low | schema.test.ts | Phase 2 신규 3개 테이블(agentCheckpoints, messageQueue, executionQueue) 테스트 누락 (기존 버그, 미해결) | F040~F043 |
| BUG-UT-002 | High | agent-manager.ts | 단위 테스트 파일 없음 (기존 버그, 미해결) | F008~F012 |

### 버그 분류 (v4.0)
- **코드 로직 버그**: 1건 (BUG-UT-102: onAgentFinished에서 undefined.id 접근 → Unhandled Rejection)
- **테스트 코드 미갱신**: 4건 (BUG-UT-101~104, PostgreSQL 마이그레이션 후 테스트 갱신 누락)
- **테스트 커버리지 누락**: 2건 (BUG-UT-001~002, 기존 미해결)

---

## 5. v3.0 대비 회귀 분석

v3.0에서 전부 통과하던 다음 테스트들이 v4.0에서 실패 전환:

| 테스트 파일 | v3.0 | v4.0 | 원인 |
|---|---|---|---|
| agent-queue.test.ts | 11 PASS | 1 PASS / 10 FAIL | async 함수 변경 |
| backup-scheduler.test.ts | 6 PASS | 2 PASS / 4 FAIL | pg_dump 방식 변경 |
| key-expiry-checker.test.ts | 5 PASS | 2 PASS / 3 FAIL | async 함수 변경 |
| error-logger.test.ts | 10 PASS | 9 PASS / 1 FAIL | 브로드캐스트 타이밍 |
| 통합 테스트 4개 파일 | 이전 pass | 36 FAIL | SQLite/PG 스키마 불일치 |

---

## 6. 권고 사항

### 즉시 수정 필요 (Critical/High)

1. **test-db.ts 헬퍼 재작성**: PostgreSQL + `pg` 드라이버 기반으로 인메모리/테스트 DB 환경 구성 필요. 또는 `@vercel/postgres` mock 활용.
   - 영향: 통합 테스트 36건 FAIL 전체 해소 예상

2. **agent-queue.test.ts 수정**: 모든 테스트 함수를 `async/await`로 변경하고 mock 반환값을 `Promise.resolve()`로 래핑.
   - `onAgentFinished` 소스에서 `next`가 undefined일 경우 early return 추가 필요 (코드 버그)

3. **backup-scheduler.test.ts 수정**: pg_dump 기반 mock으로 재작성. `db.select().from().where().orderBy()` 체인을 Promise 기반으로 mock.

4. **key-expiry-checker.test.ts 수정**: `checkKeyExpiry`를 `await`으로 호출하고, mock 체인을 Promise 반환으로 수정.

### 단기 수정 권고 (Medium)

5. **error-logger.test.ts**: `broadcastLogNew` 검증 방식을 비동기 flush 후 확인으로 변경.
