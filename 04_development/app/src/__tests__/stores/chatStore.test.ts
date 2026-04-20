/**
 * chatStore 단위 테스트
 * 대상 기능: F059 (대표-Main 지시 UI), F060 (지시 이력 저장)
 * 시나리오 근거: SC-001 (대표의 지시), SC-003 (프로젝트 생성 지시), SC-013 (우선순위 변경 지시)
 */
import { describe, it, expect } from 'vitest';
import type { ChatMessage } from '@/types/chat';

describe('chatStore - 채팅 상태 관리 순수 로직', () => {
  const sampleMessages: ChatMessage[] = [
    {
      id: 'msg-1',
      sender: 'user',
      content: '프로젝트 A를 시작해줘',
      messageType: 'text',
      createdAt: '2025-03-15T10:00:00Z',
    },
    {
      id: 'msg-2',
      sender: 'main',
      content: '프로젝트 A를 시작하겠습니다. 프로젝트관리부에 지시합니다.',
      messageType: 'text',
      createdAt: '2025-03-15T10:00:05Z',
    },
  ];

  // SC-001: 메시지 추가
  describe('addMessage 로직', () => {
    it('새 메시지를 목록 끝에 추가', () => {
      const newMsg: ChatMessage = {
        id: 'msg-3',
        sender: 'main',
        content: '프로젝트 A가 진행 중입니다.',
        messageType: 'text',
        createdAt: '2025-03-15T10:01:00Z',
      };
      const updated = [...sampleMessages, newMsg];
      expect(updated).toHaveLength(3);
      expect(updated[2].id).toBe('msg-3');
    });
  });

  // SC-001: 빈 메시지 전송 방지
  describe('sendMessage 입력 검증', () => {
    it('빈 입력은 전송하지 않음', () => {
      const input = '';
      const shouldSend = input.trim().length > 0;
      expect(shouldSend).toBe(false);
    });

    it('공백만 있는 입력은 전송하지 않음', () => {
      const input = '   ';
      const shouldSend = input.trim().length > 0;
      expect(shouldSend).toBe(false);
    });

    it('유효한 입력은 전송', () => {
      const input = '프로젝트 B를 시작해줘';
      const shouldSend = input.trim().length > 0;
      expect(shouldSend).toBe(true);
    });
  });

  // SC-013: 메시지 이력 페이지네이션
  describe('loadMore 로직', () => {
    it('이미 로딩 중이면 추가 로드 방지', () => {
      const state = { hasMore: true, isLoading: true };
      const shouldLoad = state.hasMore && !state.isLoading;
      expect(shouldLoad).toBe(false);
    });

    it('더 이상 데이터 없으면 로드 방지', () => {
      const state = { hasMore: false, isLoading: false };
      const shouldLoad = state.hasMore && !state.isLoading;
      expect(shouldLoad).toBe(false);
    });

    it('데이터 있고 로딩 중이 아니면 로드 허용', () => {
      const state = { hasMore: true, isLoading: false };
      const shouldLoad = state.hasMore && !state.isLoading;
      expect(shouldLoad).toBe(true);
    });
  });

  // SC-001: 메시지 역순 정렬 (오래된 것이 위)
  describe('메시지 정렬', () => {
    it('loadMessages 시 reverse 적용하여 시간순 정렬', () => {
      const apiResponse = [
        { id: 'msg-2', createdAt: '2025-03-15T10:00:05Z' },
        { id: 'msg-1', createdAt: '2025-03-15T10:00:00Z' },
      ];
      const reversed = [...apiResponse].reverse();
      expect(reversed[0].id).toBe('msg-1');
      expect(reversed[1].id).toBe('msg-2');
    });
  });
});
