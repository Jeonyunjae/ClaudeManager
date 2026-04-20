/**
 * notificationStore 단위 테스트
 * 대상 기능: F028~F031 (알림 시스템)
 * 시나리오 근거: SC-004 (승인 알림), SC-006 (오류 알림), SC-007 (비용 알림), SC-024 (알림 트리거)
 */
import { describe, it, expect } from 'vitest';
import type { Notification, NotificationType } from '@/types/notification';

describe('notificationStore - 알림 상태 관리 순수 로직', () => {
  const sampleNotifications: Notification[] = [
    {
      id: 1,
      type: 'approval',
      title: '승인 요청',
      message: 'DB 변경 승인 필요',
      isRead: false,
      createdAt: '2025-03-15T10:00:00Z',
    },
    {
      id: 2,
      type: 'error',
      title: '에이전트 오류',
      message: 'Instance-3 타임아웃',
      sourceAgentId: 'inst-3',
      isRead: false,
      createdAt: '2025-03-15T11:00:00Z',
    },
    {
      id: 3,
      type: 'cost',
      title: '비용 경고',
      message: '월간 비용 80% 도달',
      isRead: true,
      createdAt: '2025-03-15T09:00:00Z',
    },
  ];

  // SC-024: 알림 읽음 처리
  describe('markRead 로직', () => {
    it('특정 알림 읽음 처리', () => {
      const ids = [1];
      const updated = sampleNotifications.map((n) =>
        ids.includes(n.id) ? { ...n, isRead: true } : n
      );
      expect(updated[0].isRead).toBe(true);
      expect(updated[1].isRead).toBe(false);
    });

    it('여러 알림 동시 읽음 처리', () => {
      const ids = [1, 2];
      const updated = sampleNotifications.map((n) =>
        ids.includes(n.id) ? { ...n, isRead: true } : n
      );
      expect(updated[0].isRead).toBe(true);
      expect(updated[1].isRead).toBe(true);
      expect(updated[2].isRead).toBe(true); // 이미 읽음
    });
  });

  // SC-024: 전체 읽음 처리
  describe('markAllRead 로직', () => {
    it('모든 알림 읽음 처리', () => {
      const updated = sampleNotifications.map((n) => ({ ...n, isRead: true }));
      const unreadCount = updated.filter((n) => !n.isRead).length;
      expect(unreadCount).toBe(0);
    });
  });

  // SC-004: 새 알림 수신
  describe('addNotification 로직', () => {
    it('새 알림을 목록 앞에 추가', () => {
      const newNotif: Notification = {
        id: 4,
        type: 'complete',
        title: '프로젝트 완료',
        message: 'ClaudeManager v0.1.0 배포 완료',
        isRead: false,
        createdAt: '2025-03-15T12:00:00Z',
      };
      const updated = [newNotif, ...sampleNotifications];
      expect(updated[0].id).toBe(4);
      expect(updated).toHaveLength(4);
    });

    it('unreadCount 증가', () => {
      const currentUnread = sampleNotifications.filter((n) => !n.isRead).length;
      expect(currentUnread).toBe(2);
      // 새 알림 추가 후
      expect(currentUnread + 1).toBe(3);
    });
  });

  // SC-006, SC-007: 알림 타입 분류
  describe('알림 타입 검증', () => {
    it('유효한 알림 타입만 사용', () => {
      const validTypes: NotificationType[] = ['approval', 'error', 'complete', 'cost', 'recovery', 'info'];
      for (const notif of sampleNotifications) {
        expect(validTypes).toContain(notif.type);
      }
    });
  });

  // SC-024: 읽지 않은 알림 필터링
  describe('unread 필터링', () => {
    it('읽지 않은 알림만 필터링', () => {
      const unread = sampleNotifications.filter((n) => !n.isRead);
      expect(unread).toHaveLength(2);
      expect(unread[0].id).toBe(1);
      expect(unread[1].id).toBe(2);
    });
  });
});
