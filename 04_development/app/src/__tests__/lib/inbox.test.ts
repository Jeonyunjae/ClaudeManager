/**
 * lib/inbox.ts 단위 테스트 — DES-007 §1 답변 대기 전이 전건 + FR-006 판정식
 */
import { describe, it, expect } from 'vitest';
import { computeInbox, buildPreview, INBOX_PREVIEW_CHARS, type InboxAgent, type InboxMessage } from '@/lib/inbox';

const AGENTS: InboxAgent[] = [
  { id: 'main-1', name: 'Main', role: 'main', status: 'idle' },
  { id: 'sub-1', name: 'ClaudeManagerMobile', role: 'sub', status: 'active' },
  { id: 'inst-1', name: 'Instance1', role: 'instance', status: 'active' },
];

function msg(partial: Partial<InboxMessage> & { agentId: string | null; createdAt: string }): InboxMessage {
  return {
    id: partial.id ?? `m-${partial.createdAt}`,
    sender: partial.sender ?? 'main-1',
    content: partial.content ?? 'hello',
    createdAt: partial.createdAt,
    agentId: partial.agentId,
    queued: partial.queued,
    cancelled: partial.cancelled,
  };
}

describe('inbox.ts - computeInbox (DES-007 §1)', () => {
  it('None -> Waiting: 에이전트 메시지가 저장되면 대기로 잡힌다', () => {
    const items = computeInbox({
      messages: [msg({ agentId: 'main-1', sender: 'main-1', createdAt: '2026-09-24T01:00:00.000Z' })],
      agents: AGENTS,
      ack: {},
    });
    expect(items).toHaveLength(1);
    expect(items[0].agentId).toBe('main-1');
  });

  it('Waiting -> Acknowledged: 확인함 시각이 마지막 메시지보다 나중이면 목록에서 빠진다', () => {
    const items = computeInbox({
      messages: [msg({ agentId: 'main-1', sender: 'main-1', createdAt: '2026-09-24T01:00:00.000Z' })],
      agents: AGENTS,
      ack: { 'main-1': '2026-09-24T02:00:00.000Z' },
    });
    expect(items).toHaveLength(0);
  });

  it('Waiting -> None: 대표 답장(sender=user)이 마지막이면 대기가 아니다', () => {
    const items = computeInbox({
      messages: [
        msg({ agentId: 'main-1', sender: 'main-1', createdAt: '2026-09-24T01:00:00.000Z' }),
        msg({ agentId: 'main-1', sender: 'user', createdAt: '2026-09-24T01:05:00.000Z' }),
      ],
      agents: AGENTS,
      ack: {},
    });
    expect(items).toHaveLength(0);
  });

  it('Acknowledged -> Waiting: 확인함 이후 새 에이전트 메시지가 오면 재등장한다', () => {
    const items = computeInbox({
      messages: [msg({ agentId: 'main-1', sender: 'main-1', createdAt: '2026-09-24T03:00:00.000Z' })],
      agents: AGENTS,
      ack: { 'main-1': '2026-09-24T02:00:00.000Z' },
    });
    expect(items).toHaveLength(1);
  });

  it('Acknowledged -> None: 확인함 이후에도 대표 답장이 마지막이면 대기가 아니다', () => {
    const items = computeInbox({
      messages: [
        msg({ agentId: 'main-1', sender: 'main-1', createdAt: '2026-09-24T01:00:00.000Z' }),
        msg({ agentId: 'main-1', sender: 'user', createdAt: '2026-09-24T03:00:00.000Z' }),
      ],
      agents: AGENTS,
      ack: { 'main-1': '2026-09-24T02:00:00.000Z' },
    });
    expect(items).toHaveLength(0);
  });

  it('ack 시각과 마지막 메시지 시각이 정확히 같으면 대기가 아니다 (> 비교, >= 아님)', () => {
    const items = computeInbox({
      messages: [msg({ agentId: 'main-1', sender: 'main-1', createdAt: '2026-09-24T02:00:00.000Z' })],
      agents: AGENTS,
      ack: { 'main-1': '2026-09-24T02:00:00.000Z' },
    });
    expect(items).toHaveLength(0);
  });

  it('role=instance는 최신 메시지가 대기 상태라도 목록에서 제외한다', () => {
    const items = computeInbox({
      messages: [msg({ agentId: 'inst-1', sender: 'inst-1', createdAt: '2026-09-24T01:00:00.000Z' })],
      agents: AGENTS,
      ack: {},
    });
    expect(items).toHaveLength(0);
  });

  it('agents에 없는 agentId는 제외한다', () => {
    const items = computeInbox({
      messages: [msg({ agentId: 'unknown-agent', sender: 'unknown-agent', createdAt: '2026-09-24T01:00:00.000Z' })],
      agents: AGENTS,
      ack: {},
    });
    expect(items).toHaveLength(0);
  });

  it('queued 메타 메시지는 최신 판정에서 제외한다 — 그 앞의 실제 메시지로 판정한다', () => {
    const items = computeInbox({
      messages: [
        msg({ agentId: 'main-1', sender: 'main-1', createdAt: '2026-09-24T01:00:00.000Z' }),
        msg({ agentId: 'main-1', sender: 'user', createdAt: '2026-09-24T01:05:00.000Z', queued: true }),
      ],
      agents: AGENTS,
      ack: {},
    });
    // queued 메시지가 제외되므로 마지막 유효 메시지는 main-1 발화 -> 대기
    expect(items).toHaveLength(1);
    expect(items[0].lastMessageAt).toBe('2026-09-24T01:00:00.000Z');
  });

  it('cancelled 메타 메시지는 최신 판정에서 제외한다', () => {
    const items = computeInbox({
      messages: [
        msg({ agentId: 'main-1', sender: 'user', createdAt: '2026-09-24T01:00:00.000Z' }),
        msg({ agentId: 'main-1', sender: 'main-1', createdAt: '2026-09-24T01:05:00.000Z', cancelled: true }),
      ],
      agents: AGENTS,
      ack: {},
    });
    // cancelled 메시지가 제외되므로 마지막 유효 메시지는 user 발화 -> 대기 아님
    expect(items).toHaveLength(0);
  });

  it('agentId가 없는(null) 메시지는 무시한다', () => {
    const items = computeInbox({
      messages: [msg({ agentId: null, sender: 'main-1', createdAt: '2026-09-24T01:00:00.000Z' })],
      agents: AGENTS,
      ack: {},
    });
    expect(items).toHaveLength(0);
  });

  it('lastMessageAt 내림차순으로 정렬한다', () => {
    const items = computeInbox({
      messages: [
        msg({ agentId: 'main-1', sender: 'main-1', createdAt: '2026-09-24T01:00:00.000Z' }),
        msg({ agentId: 'sub-1', sender: 'sub-1', createdAt: '2026-09-24T05:00:00.000Z' }),
      ],
      agents: AGENTS,
      ack: {},
    });
    expect(items.map((i) => i.agentId)).toEqual(['sub-1', 'main-1']);
  });

  it('필드가 DES-002 응답 스키마와 일치한다', () => {
    const items = computeInbox({
      messages: [
        msg({
          id: 'msg-1',
          agentId: 'sub-1',
          sender: 'sub-1',
          content: '분석을 마쳤습니다.',
          createdAt: '2026-09-24T01:00:00.000Z',
        }),
      ],
      agents: AGENTS,
      ack: {},
    });
    expect(items[0]).toEqual({
      agentId: 'sub-1',
      agentName: 'ClaudeManagerMobile',
      role: 'sub',
      agentStatus: 'active',
      lastMessageId: 'msg-1',
      preview: '분석을 마쳤습니다.',
      lastMessageAt: '2026-09-24T01:00:00.000Z',
    });
  });
});

describe('inbox.ts - buildPreview', () => {
  it('줄바꿈을 공백으로 바꾼다', () => {
    expect(buildPreview('첫줄\n둘째줄\r\n셋째줄')).toBe('첫줄 둘째줄 셋째줄');
  });

  it(`${INBOX_PREVIEW_CHARS}자를 넘으면 자른다`, () => {
    const long = 'a'.repeat(200);
    const preview = buildPreview(long);
    expect(preview).toHaveLength(INBOX_PREVIEW_CHARS);
    expect(preview).toBe('a'.repeat(INBOX_PREVIEW_CHARS));
  });

  it(`${INBOX_PREVIEW_CHARS}자 이하이면 그대로 반환한다`, () => {
    expect(buildPreview('짧은 내용')).toBe('짧은 내용');
  });
});
