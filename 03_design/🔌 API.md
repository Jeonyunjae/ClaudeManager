# API 설계
> 작성: designer | 상태: 작성 완료
> REST API + WebSocket 이벤트 명세

---

## 1. 공통 규칙

### 인증
- 방식: JWT Bearer Token
- 헤더: `Authorization: Bearer <token>`
- 토큰 만료: 7일 (자동 갱신)
- 비인증 요청: 401 Unauthorized

### 응답 포맷

```typescript
// 성공
{ data: T }

// 목록 (페이지네이션)
{ data: T[], pagination: { page: number, limit: number, total: number, hasMore: boolean } }

// 에러
{ error: { code: string, message: string, details?: unknown } }
```

### 에러 코드 체계

| 접두사 | 도메인 | 예시 |
|---|---|---|
| `AUTH_` | 인증 | `AUTH_INVALID_PASSWORD`, `AUTH_TOKEN_EXPIRED`, `AUTH_LOCKED` |
| `AGENT_` | 에이전트 | `AGENT_NOT_FOUND`, `AGENT_ALREADY_STOPPED` |
| `SKILL_` | Skill | `SKILL_NOT_FOUND`, `SKILL_SCHEMA_INVALID`, `SKILL_EXECUTION_FAILED` |
| `PART_` | Part | `PART_NOT_FOUND`, `PART_ALREADY_EXISTS` |
| `APPROVAL_` | 승인 | `APPROVAL_NOT_FOUND`, `APPROVAL_ALREADY_RESOLVED` |
| `CHAT_` | 채팅 | `CHAT_SEND_FAILED` |
| `COST_` | 비용 | `COST_LIMIT_EXCEEDED` |
| `SYSTEM_` | 시스템 | `SYSTEM_BACKUP_FAILED`, `SYSTEM_RESTORE_FAILED` |
| `VALIDATION_` | 유효성 | `VALIDATION_REQUIRED`, `VALIDATION_INVALID_FORMAT` |

---

## 2. Auth API

### POST /api/auth/setup
> 최초 비밀번호 설정 (F059)

```
Request:  { password: string, confirmPassword: string }
Response: { data: { token: string } }
Errors:   AUTH_ALREADY_SETUP, VALIDATION_PASSWORD_MISMATCH
```

### POST /api/auth/login
> 로그인 (F059)

```
Request:  { password: string }
Response: { data: { token: string, expiresAt: string } }
Errors:   AUTH_INVALID_PASSWORD, AUTH_LOCKED (5회 실패 시 30초 잠금)
```

### POST /api/auth/refresh
> 토큰 갱신

```
Request:  (Authorization 헤더)
Response: { data: { token: string, expiresAt: string } }
Errors:   AUTH_TOKEN_EXPIRED
```

---

## 3. Agents API

### GET /api/agents/tree
> 에이전트 트리 구조 조회 (F012, F013)

```
Response: { data: AgentTreeNode[] }

AgentTreeNode = {
  id: string
  name: string
  role: 'main' | 'part' | 'sub' | 'instance'
  status: 'active' | 'idle' | 'pending' | 'error' | 'stopped' | 'retrying'
  statusMessage?: string
  partId?: string
  children: AgentTreeNode[]
}
```

### GET /api/agents/:id
> 에이전트 상세 조회 (F014, F015)

```
Response: {
  data: {
    id, name, role, status, statusMessage,
    partId, parentId, tmuxSession,
    modelName, modelProvider, taskType,
    startedAt, stoppedAt, uptimeSeconds
  }
}
Errors: AGENT_NOT_FOUND
```

### GET /api/agents/:id/conversations
> 에이전트 대화 이력 (F062)

```
Query:    ?page=1&limit=50
Response: {
  data: [{
    id, timestamp, fromAgent, toAgent,
    content, type: 'instruction' | 'report' | 'question' | 'approval'
  }],
  pagination
}
```

### GET /api/agents/:id/notes
> 에이전트 노트 (.orchestrator/) (F040)

```
Response: {
  data: [{
    file: string,      // "context.md", "progress/stage-1.md"
    content: string,    // 마크다운 내용
    updatedAt: string
  }]
}
```

### GET /api/agents/:id/logs
> 에이전트 이벤트 로그 (F034, F062)

```
Query:    ?page=1&limit=50&search=keyword&eventType=error
Response: {
  data: [{
    id, eventType, message, detail,
    inputTokens?, outputTokens?, cost?,
    createdAt
  }],
  pagination
}
```

---

## 4. Parts API

### GET /api/parts
> Part 목록 조회 (F013)

```
Response: {
  data: [{
    id, name, description, skillName, skillVersion,
    sensitivityLevel, color, status,
    agentCount, projectCount, createdAt
  }]
}
```

### POST /api/parts
> Part 생성 (Skill 실행 후 내부 호출) (F009)

```
Request:  { skillName, inputJson }
Response: { data: { id, name, status } }
```

### GET /api/parts/:id/policy
> Part별 정책 조회 (F027, F035, F065)

```
Response: {
  data: {
    retryCount, retryStrategy, retryIntervalBase,
    approvalStages, defaultModel, sensitivityLevel
  }
}
```

### PUT /api/parts/:id/policy
> Part별 정책 수정 (F027, F035, F065)

```
Request: {
  retryCount?, retryStrategy?, retryIntervalBase?,
  approvalStages?, defaultModel?, sensitivityLevel?
}
Response: { data: { updated: true } }
```

---

## 5. Skills API

### GET /api/skills
> Skill 라이브러리 목록 (F004)

```
Response: {
  data: [{
    name, displayName, description, version,
    parentSkill, filePath, createdAt
  }]
}
```

### GET /api/skills/:name/schema
> Skill 스키마 조회 (F005)

```
Response: {
  data: {
    name, version,
    schema: {
      fields: [{
        key, label, type: 'text' | 'select' | 'number',
        required, default?, options?: string[]
      }]
    }
  }
}
Errors: SKILL_NOT_FOUND
```

### POST /api/skills/:name/execute
> Skill 실행 (F001)

```
Request:  { input: Record<string, unknown> }
Response: { data: { partId: string, status: 'created' } }
Errors:   SKILL_NOT_FOUND, SKILL_SCHEMA_INVALID, SKILL_EXECUTION_FAILED
```

---

## 6. Chat API

### GET /api/chat/messages
> 채팅 메시지 목록 (F059)

```
Query:    ?page=1&limit=50&before=timestamp
Response: {
  data: [{
    id, sender: 'user' | 'main',
    content, messageType: 'text' | 'approval_request' | 'progress' | 'system',
    metadata?, createdAt
  }],
  pagination
}
```

### POST /api/chat/send
> 메시지 전송 (F059, F060)

```
Request:  { content: string }
Response: { data: { id, createdAt } }
```

---

## 7. Approvals API

### GET /api/approvals/pending
> 대기 중인 승인 목록 (F023, F026)

```
Response: {
  data: [{
    id, title, content, urgency,
    sourceAgentId, sourceAgentName,
    projectId, projectName,
    createdAt
  }]
}
```

### GET /api/approvals
> 승인 이력 목록 (F025)

```
Query:    ?page=1&limit=20&status=approved&partId=xxx&from=date&to=date
Response: { data: [Approval], pagination }
```

### POST /api/approvals/:id/approve
> 승인 처리 (F024)

```
Request:  { comment?: string }
Response: { data: { id, status: 'approved', resolvedAt } }
Errors:   APPROVAL_NOT_FOUND, APPROVAL_ALREADY_RESOLVED
```

### POST /api/approvals/:id/reject
> 반려 처리 (F024)

```
Request:  { comment: string }
Response: { data: { id, status: 'rejected', resolvedAt } }
```

### POST /api/approvals/:id/modify
> 수정 지시 (F024)

```
Request:  { comment: string }
Response: { data: { id, status: 'modified', resolvedAt } }
```

---

## 8. Cost API

### GET /api/cost/summary
> 비용 요약 (F016)

```
Query:    ?period=month (day|week|month)
Response: {
  data: {
    totalCost, costLimit, percentage,
    modelBreakdown: [{ model, cost, percentage }],
    keyBreakdown: [{ provider, cost }]
  }
}
```

### GET /api/cost/by-model
> 모델별 비용 (F016)

```
Query:    ?period=month
Response: { data: [{ model, inputTokens, outputTokens, cost }] }
```

### GET /api/cost/trend
> 비용 추이 (F016)

```
Query:    ?period=month&granularity=day
Response: { data: [{ date, cost }] }
```

### GET /api/cost/by-key
> API 키별 사용량 (F037)

```
Query:    ?period=month
Response: { data: [{ provider, keyMasked, cost, callCount }] }
```

---

## 9. Reports API

### GET /api/reports/progress
> 프로젝트 진행 보고서 (F013, F040)

```
Query:    ?partId=xxx&from=date&to=date
Response: {
  data: [{
    projectId, projectName,
    stages: [{ name, status: 'completed' | 'active' | 'pending', percentage }],
    overallProgress, recentActivities: [{ date, description }]
  }]
}
```

### GET /api/reports/decisions
> 의사결정 이력 (F025, F040)

```
Query:    ?partId=xxx&from=date&to=date
Response: {
  data: [{
    id, date, question, decision, decidedBy,
    background?, optionA?, optionB?, rationale?
  }]
}
```

### GET /api/reports/flow
> 대화 흐름 트리 (F062)

```
Query:    ?projectId=xxx&from=date&to=date
Response: {
  data: {
    nodes: [{ id, agentId, agentName, action, timestamp, detail }],
    edges: [{ from, to, type: 'instruction' | 'report' }]
  }
}
```

---

## 10. Notifications API

### GET /api/notifications
> 알림 목록 (F028)

```
Query:    ?unread=true&page=1&limit=20
Response: {
  data: [{
    id, type, title, message,
    sourceAgentId?, targetUrl?,
    isRead, createdAt
  }],
  pagination,
  unreadCount: number
}
```

### POST /api/notifications/mark-read
> 알림 읽음 처리 (F028)

```
Request:  { ids: number[] } // 빈 배열이면 전체 읽음 처리
Response: { data: { updated: number } }
```

---

## 11. Settings API

### GET /api/settings
> 전역 설정 조회 (F064)

```
Response: {
  data: {
    retryCount: number,
    retryStrategy: 'exponential' | 'fixed',
    costLimit: number,
    alertThreshold: number,
    maxConcurrentAgents: number
  }
}
```

### PUT /api/settings
> 전역 설정 수정 (F064)

```
Request:  { retryCount?, retryStrategy?, costLimit?, alertThreshold?, maxConcurrentAgents? }
Response: { data: { updated: true } }
```

---

## 12. API Keys API

### GET /api/apikeys
> API 키 목록 (F036)

```
Response: {
  data: [{
    id, provider, keyMasked, status,
    expiresAt, monthlyUsage, createdAt
  }]
}
```

### POST /api/apikeys
> API 키 등록 (F036)

```
Request:  { provider, key, expiresAt? }
Response: { data: { id, provider, keyMasked, status } }
Errors:   VALIDATION_INVALID_KEY_FORMAT
```

### PUT /api/apikeys/:id
> API 키 갱신 (F036)

```
Request:  { key?, expiresAt? }
Response: { data: { id, updated: true } }
```

### DELETE /api/apikeys/:id
> API 키 삭제 (F036)

```
Response: { data: { deleted: true } }
Errors:   APIKEY_IN_USE (사용 중인 인스턴스가 있는 경우 경고)
```

---

## 13. Backups API

### GET /api/backups
> 백업 목록 (F068)

```
Response: {
  data: {
    latestBackup: { id, type, status, filePath, sizeBytes, createdAt },
    nextScheduled: string,
    totalSize: number,
    history: [{ id, type, status, sizeBytes, createdAt }]
  }
}
```

### POST /api/backups/manual
> 수동 백업 실행 (F069)

```
Response: { data: { id, status: 'in_progress' } }
```

### POST /api/backups/:id/restore
> 백업 복원 (F069)

```
Request:  { confirm: true }
Response: { data: { status: 'restoring' } }
Errors:   SYSTEM_RESTORE_FAILED
```

---

## 14. System API

### GET /api/system/health
> 현재 시스템 헬스 (F017)

```
Response: {
  data: {
    cpu: number,           // 퍼센트
    memory: number,
    disk: number,
    networkUp: number,     // Mbps
    networkDown: number,
    activeAgents: number,
    maxAgents: number,
    status: 'healthy' | 'warning' | 'critical'
  }
}
```

### GET /api/system/health/history
> 시스템 헬스 히스토리 (F017)

```
Query:    ?period=1h (1h|24h|7d)
Response: {
  data: [{
    timestamp, cpu, memory, disk,
    networkUp, networkDown, activeAgents
  }]
}
```

---

## 15. Audit API

### GET /api/audit
> 감사 로그 조회 (F063)

```
Query:    ?page=1&limit=20&actorType=user&action=approve&from=date&to=date&search=keyword
Response: {
  data: [{
    id, actorType, actorId, action,
    resource, resourceId, detail, createdAt
  }],
  pagination
}
```

---

## 16. Error Logs API

### GET /api/logs/errors
> 오류 로그 조회 (F034)

```
Query:    ?page=1&limit=20&partId=xxx&from=date&to=date&search=keyword
Response: {
  data: [{
    id, agentId, agentName,
    message, stackTrace,
    retryCount, finalStatus,
    createdAt
  }],
  pagination
}
```

---

## 17. Hooks API (내부용)

### POST /api/hooks/event
> Claude Code Hooks 이벤트 수신 (F041)

```
Request: {
  event: string,          // 'task_start' | 'task_complete' | 'error' | 'decision' | 'token_usage' 등
  agentId: string,
  data: Record<string, unknown>
}
Response: { data: { received: true } }
```

- 인증: Hooks 전용 시크릿 키 (JWT와 별도)
- 이벤트 수신 시 DB + 노트 이중 저장 + WebSocket 브로드캐스트

---

## 18. WebSocket 이벤트

### 연결

```
ws://localhost:3001/ws?token=<JWT>
```

### 서버 -> 클라이언트 (S->C)

| 이벤트 | payload | 관련 기능 |
|---|---|---|
| `agent:status` | `{ agentId, status, statusMessage? }` | F012, F013 |
| `agent:message` | `{ agentId, text }` | F013 (말풍선) |
| `agent:created` | `{ agent: AgentTreeNode }` | F009, F011 |
| `agent:removed` | `{ agentId }` | F010, F011 |
| `chat:message` | `{ id, sender, content, messageType, metadata? }` | F059 |
| `chat:typing` | `{ isTyping: boolean }` | F059 |
| `approval:request` | `{ id, title, content, urgency, sourceAgent }` | F023 |
| `approval:resolved` | `{ id, status, resolvedAt }` | F024 |
| `project:progress` | `{ projectId, stage, percentage }` | F013, F014 |
| `part:created` | `{ part: { id, name, color } }` | F009 |
| `notification:new` | `{ notification }` | F028, F029 |
| `cost:updated` | `{ totalCost, costLimit, percentage }` | F016, F031 |
| `system:health` | `{ cpu, memory, disk, networkUp, networkDown }` | F017 |
| `system:recovery` | `{ phase, progress, recoveredAgents[] }` | F042, F043 |
| `note:updated` | `{ agentId, file, content }` | F040, F041 |
| `log:new` | `{ agentId, entry }` | F034, F062 |
| `terminal:output` | `{ sessionId, data: string }` | F057 |

### 클라이언트 -> 서버 (C->S)

| 이벤트 | payload | 관련 기능 |
|---|---|---|
| `chat:send` | `{ content: string }` | F059 |
| `terminal:input` | `{ sessionId, data: string }` | F058 |
| `terminal:resize` | `{ sessionId, cols, rows }` | F057 |
| `terminal:connect` | `{ agentId }` | F057 |
| `terminal:disconnect` | `{ sessionId }` | F057 |

---

## 19. API 통계

| 그룹 | REST 엔드포인트 | WebSocket 이벤트 | 관련 기능 |
|---|---|---|---|
| Auth | 3 | - | F059 |
| Agents | 5 | 4 S->C | F012~F015, F040, F057, F062 |
| Parts | 4 | 1 S->C | F009, F027, F035, F065 |
| Skills | 3 | - | F001~F006 |
| Chat | 2 | 3 (2 S->C, 1 C->S) | F059~F061 |
| Approvals | 5 | 2 S->C | F023~F027 |
| Cost | 4 | 1 S->C | F016, F031, F037, F046 |
| Reports | 3 | - | F013, F025, F040, F062 |
| Notifications | 2 | 1 S->C | F028~F031 |
| Settings | 2 | - | F064, F065 |
| API Keys | 4 | - | F036~F039 |
| Backups | 3 | - | F068, F069 |
| System | 2 | 2 S->C | F017, F042, F043 |
| Audit | 1 | - | F063 |
| Error Logs | 1 | - | F034 |
| Hooks | 1 | - | F041 |
| Notes | - | 1 S->C | F040 |
| Logs | - | 1 S->C | F062 |
| Terminal | - | 4 (1 S->C, 3 C->S) | F057, F058 |
| **합계** | **45** | **20** | |
