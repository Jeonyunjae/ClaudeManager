/**
 * 모바일 화면 전용 표시 포맷 유틸 — DES-006, DES-009.
 *
 * 데스크톱 `lib/utils.ts`의 `formatRelativeTime`과 별도로 둔다 (모바일 화면
 * 전용 도메인 — 상태 표시명 등 데스크톱에는 없는 값도 함께 다룬다).
 */
import type { AgentRole, AgentStatus } from '@/types/agent';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Postgres `now()::text` 형식 — `YYYY-MM-DD HH:MM:SS[.ffffff][+HH[:MM]]` — 을 잡아낸다
 * (BUG-004). `T` 구분자를 쓰는 표준 ISO도 함께 매치되도록 구분자는 공백/`T` 모두 허용한다.
 */
const PG_TIMESTAMP_RE =
  /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/;

/**
 * 문자열을 안전하게 epoch ms로 파싱한다 (순수 함수, BUG-004).
 *
 * `new Date(iso)`에 그대로 맡기면 Postgres `now()::text` 출력(공백 구분자, 마이크로초 6자리,
 * `+09`처럼 분 없는 타임존 오프셋)을 iOS Safari(JavaScriptCore)가 Invalid Date로 파싱해
 * 화면에 "NaN"이 나올 수 있다 — V8(Node·Chrome)은 관대하게 받아들여 개발 중엔 드러나지 않았다.
 * 이 함수는 그 형식을 표준 ISO 8601로 정규화한 뒤 파싱한다:
 *   - 공백 구분자 → `T`
 *   - 마이크로초(6자리 등) → 밀리초 3자리로 절단
 *   - `+09`(시만) → `+09:00`, `+09:30` → 그대로, 오프셋 없음 → `Z`(UTC 가정)
 *
 * 파싱에 실패하면 `null`을 반환한다 — 호출부는 "NaN" 대신 빈 문자열을 표시해야 한다.
 */
export function parseFlexibleTimestamp(raw: string): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  const match = PG_TIMESTAMP_RE.exec(trimmed);
  let normalized = trimmed;
  if (match) {
    const [, datePart, timePart, fractionRaw, offsetRaw] = match;
    const fraction = fractionRaw ? `.${fractionRaw.slice(1, 4).padEnd(3, '0')}` : '';

    let offset = 'Z';
    if (offsetRaw && offsetRaw !== 'Z') {
      const offMatch = /^([+-]\d{2}):?(\d{2})?$/.exec(offsetRaw);
      if (offMatch) {
        offset = `${offMatch[1]}:${offMatch[2] ?? '00'}`;
      }
    }

    normalized = `${datePart}T${timePart}${fraction}${offset}`;
  }

  const time = new Date(normalized).getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * 상대 시각 문자열 — DES-006 "방금·n분 전·n시간 전·날짜".
 * `now`는 테스트 용이성을 위한 주입(기본값 `new Date()`).
 * 파싱할 수 없는 값(BUG-004)이면 "NaN" 대신 빈 문자열을 반환한다.
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const target = parseFlexibleTimestamp(iso);
  if (target === null) return '';
  const diff = now.getTime() - target;

  if (diff < MINUTE_MS) return '방금';
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)}분 전`;
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)}시간 전`;

  const date = new Date(target);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

/** AgentStatus -> 모바일 상태 표시명 (DES-009 §AgentStatus) */
export const AGENT_STATUS_LABELS: Record<AgentStatus, string> = {
  active: '작업 중',
  idle: '대기',
  pending: '보류',
  error: '오류',
  stopped: '정지',
  retrying: '재시도 중',
};

export function agentStatusLabel(status: string): string {
  return (AGENT_STATUS_LABELS as Record<string, string>)[status] ?? status;
}

/** AgentRole -> 모바일 역할 표시명 (DES-009 §AgentRole) */
export const AGENT_ROLE_LABELS: Record<AgentRole, string> = {
  main: 'Main',
  sub: 'Sub',
  part: 'Part',
  instance: 'Instance',
};

export function agentRoleLabel(role: string): string {
  return (AGENT_ROLE_LABELS as Record<string, string>)[role] ?? role;
}

/** 이니셜(아바타용) — 이름의 첫 글자 (DES-004 AgentAvatar) */
export function agentInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

/**
 * 서버가 `agent.statusMessage`에 실어 보내는 잘 알려진 영어 원문 -> 한국어 표시 (BUG-026).
 *
 * 매핑 대상은 서버 코드에서 실제로 리터럴로 설정하는 값만 포함한다:
 *   - src/app/api/hooks/event/route.ts: 'Working...' · 'Completed' · 'Error occurred'
 *   - src/app/api/agents/[id]/route.ts: 'Stopped by user' · 'Started' · 'Restarted'
 *   - src/app/api/agents/route.ts, src/server/cli-executor.ts: 'Skill assigned'
 *   - src/lib/agent-queue.ts: 'Promoted from queue'
 * (`Using tool: ...`처럼 동적으로 조합되는 문자열, 큐 대기 메시지처럼 숫자가 섞인 문자열은
 * 제외 — 모르는 값이면 원문을 그대로 보여준다.)
 */
export const STATUS_MESSAGE_LABELS: Record<string, string> = {
  'Working...': '작업 중...',
  Completed: '완료',
  'Error occurred': '오류 발생',
  'Stopped by user': '사용자가 중지함',
  Started: '시작됨',
  Restarted: '재시작됨',
  'Skill assigned': '스킬 지정됨',
  'Promoted from queue': '대기열에서 승격됨',
};

/** 알려진 영어 statusMessage 원문을 한국어로 바꾼다. 모르는 값은 원문 그대로 반환한다. */
export function statusMessageLabel(message: string): string {
  return STATUS_MESSAGE_LABELS[message] ?? message;
}
