/**
 * 답변 대기(Inbox) 판정 — DES-007 §1, FR-006·FR-007.
 *
 * 순수 함수로 분리해 DB 접근 없이 테스트한다.
 * 판정식: `last = 에이전트별 최신 메시지(queued·cancelled 제외)`.
 * `waiting = last.sender ≠ 'user' AND (ack 없음 OR last.createdAt > ack)`.
 */

/** 미리보기 길이 (DES-009 `INBOX_PREVIEW_CHARS`) */
export const INBOX_PREVIEW_CHARS = 120;

/** `settings.key` — 대기 "확인함" 시각 맵 (DES-002 §POST /api/inbox/{agentId}/ack) */
export const INBOX_ACK_SETTINGS_KEY = 'inbox_ack';

export type InboxMessage = {
  id: string;
  sender: string;
  content: string;
  /** ISO 8601 문자열 */
  createdAt: string;
  /** `chat_messages.metadata.agentId` — 없으면(파싱 실패 포함) null */
  agentId: string | null;
  queued?: boolean;
  cancelled?: boolean;
};

export type InboxAgent = {
  id: string;
  name: string;
  role: string;
  status: string;
};

export type InboxItem = {
  agentId: string;
  agentName: string;
  role: string;
  agentStatus: string;
  lastMessageId: string;
  preview: string;
  lastMessageAt: string;
};

export type ComputeInboxInput = {
  messages: InboxMessage[];
  agents: InboxAgent[];
  /** `settings.inbox_ack` JSON 맵 — agentId -> 확인함 시각(ISO) */
  ack: Record<string, string>;
  /** 테스트 용이성을 위한 현재 시각 주입 (판정식 자체에는 쓰이지 않음) */
  now?: Date;
};

/** 줄바꿈을 공백으로 바꾸고 120자로 자른다 (DES-002 §GET /api/inbox) */
export function buildPreview(content: string, maxChars: number = INBOX_PREVIEW_CHARS): string {
  const flattened = content.replace(/\r\n|\r|\n/g, ' ');
  return flattened.slice(0, maxChars);
}

/** 에이전트별 최신 메시지(queued·cancelled 제외)를 찾는다 */
function latestByAgent(messages: InboxMessage[]): Map<string, InboxMessage> {
  const latest = new Map<string, InboxMessage>();
  for (const msg of messages) {
    if (msg.agentId === null) continue;
    if (msg.queued === true || msg.cancelled === true) continue;

    const current = latest.get(msg.agentId);
    if (!current || new Date(msg.createdAt).getTime() > new Date(current.createdAt).getTime()) {
      latest.set(msg.agentId, msg);
    }
  }
  return latest;
}

export function computeInbox({ messages, agents, ack }: ComputeInboxInput): InboxItem[] {
  const agentMap = new Map(agents.map((a) => [a.id, a] as const));
  const latest = latestByAgent(messages);

  const items: InboxItem[] = [];

  for (const [agentId, msg] of latest) {
    const agent = agentMap.get(agentId);
    if (!agent) continue; // agents에 없는 agentId 제외
    if (agent.role === 'instance') continue; // instance는 대기 목록에 노출하지 않는다

    if (msg.sender === 'user') continue; // 마지막이 대표 답장 -> None

    const ackAt = ack[agentId];
    const waiting = !ackAt || new Date(msg.createdAt).getTime() > new Date(ackAt).getTime();
    if (!waiting) continue;

    items.push({
      agentId,
      agentName: agent.name,
      role: agent.role,
      agentStatus: agent.status,
      lastMessageId: msg.id,
      preview: buildPreview(msg.content),
      lastMessageAt: msg.createdAt,
    });
  }

  items.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

  return items;
}
