import type { AgentTreeNode } from '@/types/agent';

/** 완료된 Instance를 Sub 아래에 남겨 두는 시간 — 지나면 화면에서 숨긴다(이력은 DB에 유지) (BUG-034) */
export const INSTANCE_VISIBLE_AFTER_STOP_MS = 24 * 60 * 60 * 1000;
/** Sub를 눌렀을 때 보이는 최대 개수 (진행 중 + 최근 완료) */
export const INSTANCE_LIST_LIMIT = 20;

/** 트리에 넣을 Instance인가 — 진행 중이거나, 끝난 지 하루가 안 됐으면 */
export function isInstanceVisible(
  agent: { role: string; status: string; stoppedAt?: string | null },
  now: number = Date.now()
): boolean {
  if (agent.role !== 'instance') return true;
  if (agent.status === 'active') return true;
  if (!agent.stoppedAt) return true;
  const t = Date.parse(agent.stoppedAt);
  return Number.isNaN(t) || now - t < INSTANCE_VISIBLE_AFTER_STOP_MS;
}

/** 진행 중 먼저(오래 걸린 순), 그다음 최근에 끝난 순, 최대 20건 */
export function sortInstances(list: AgentTreeNode[], limit: number = INSTANCE_LIST_LIMIT): AgentTreeNode[] {
  const t = (s?: string) => (s ? Date.parse(s) || 0 : 0);
  return [...list]
    .sort((a, b) => {
      const aActive = a.status === 'active' ? 1 : 0;
      const bActive = b.status === 'active' ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      if (aActive) return t(a.startedAt) - t(b.startedAt);
      return t(b.stoppedAt ?? b.startedAt) - t(a.stoppedAt ?? a.startedAt);
    })
    .slice(0, limit);
}

/** 경과 시간 "45초", "3분 12초", "1시간 5분" */
export function formatElapsed(startedAt?: string, stoppedAt?: string, now: number = Date.now()): string {
  const start = startedAt ? Date.parse(startedAt) : NaN;
  if (Number.isNaN(start)) return '';
  const end = stoppedAt ? Date.parse(stoppedAt) : now;
  const sec = Math.max(0, Math.floor((end - start) / 1000));
  if (sec < 60) return `${sec}초`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 ${sec % 60}초`;
  return `${Math.floor(min / 60)}시간 ${min % 60}분`;
}

/** 카드 부제 한 줄: "하는 일 · 상태 · 경과" */
export function instanceSubtitle(node: AgentTreeNode, now: number = Date.now()): string {
  const state = node.status === 'active' ? '진행 중' : node.status === 'error' ? '오류' : node.status === 'stopped' ? '중단' : '완료';
  const elapsed = formatElapsed(node.startedAt, node.status === 'active' ? undefined : node.stoppedAt, now);
  return [node.statusMessage, state, elapsed].filter(Boolean).join(' · ');
}
