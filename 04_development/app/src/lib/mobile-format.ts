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
 * 상대 시각 문자열 — DES-006 "방금·n분 전·n시간 전·날짜".
 * `now`는 테스트 용이성을 위한 주입(기본값 `new Date()`).
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const target = new Date(iso).getTime();
  const diff = now.getTime() - target;

  if (diff < MINUTE_MS) return '방금';
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)}분 전`;
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)}시간 전`;

  const date = new Date(iso);
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
