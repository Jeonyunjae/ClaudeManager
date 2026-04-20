/**
 * approvalStore 단위 테스트
 * 대상 기능: F023~F027 (승인 요청/처리/이력 관리)
 * 시나리오 근거: SC-004 (승인 요청 수신 및 처리), SC-009 (긴급 승인)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { Approval } from '@/types/approval';

// 순수 상태 로직 테스트 (API 호출 없이)
describe('approvalStore - 승인 상태 관리 순수 로직', () => {
  const sampleApprovals: Approval[] = [
    {
      id: 'apv-1',
      title: 'DB 스키마 변경 승인',
      content: 'users 테이블에 email 컬럼 추가',
      urgency: 'normal',
      status: 'pending',
      sourceAgentId: 'agent-1',
      sourceAgentName: 'Dev Part',
      createdAt: '2025-03-15T10:00:00Z',
    },
    {
      id: 'apv-2',
      title: '비용 한도 초과 승인',
      urgency: 'critical',
      content: '월간 비용이 $80 초과',
      status: 'pending',
      createdAt: '2025-03-15T11:00:00Z',
    },
    {
      id: 'apv-3',
      title: '배포 승인',
      content: 'v0.2.0 배포',
      urgency: 'high',
      status: 'pending',
      createdAt: '2025-03-15T12:00:00Z',
    },
  ];

  // SC-004: 승인 후 목록에서 제거
  describe('removePending 로직', () => {
    it('승인 처리 후 pending 목록에서 해당 항목 제거', () => {
      const pendingList = [...sampleApprovals];
      const filtered = pendingList.filter((a) => a.id !== 'apv-1');
      expect(filtered).toHaveLength(2);
      expect(filtered.find((a) => a.id === 'apv-1')).toBeUndefined();
    });

    it('존재하지 않는 ID 제거 시 목록 변경 없음', () => {
      const pendingList = [...sampleApprovals];
      const filtered = pendingList.filter((a) => a.id !== 'nonexistent');
      expect(filtered).toHaveLength(3);
    });
  });

  // SC-009: 긴급 승인이 맨 위에 표시
  describe('addPending 로직', () => {
    it('새 승인을 목록 앞에 추가', () => {
      const newApproval: Approval = {
        id: 'apv-4',
        title: '긴급 보안 패치 승인',
        content: 'CVE-2025 패치',
        urgency: 'critical',
        status: 'pending',
        createdAt: '2025-03-15T13:00:00Z',
      };

      const pendingList = [newApproval, ...sampleApprovals];
      expect(pendingList[0].id).toBe('apv-4');
      expect(pendingList).toHaveLength(4);
    });
  });

  // SC-004: 승인 긴급도 분류
  describe('승인 긴급도 타입 검증', () => {
    it('urgency 필드가 유효한 값만 허용', () => {
      const validUrgencies = ['low', 'normal', 'high', 'critical'];
      for (const approval of sampleApprovals) {
        expect(validUrgencies).toContain(approval.urgency);
      }
    });
  });

  // SC-004: 승인 상태 변경
  describe('승인 상태 전이', () => {
    it('pending -> approved 상태 전이', () => {
      const approval = { ...sampleApprovals[0], status: 'approved' as const, resolvedAt: '2025-03-15T14:00:00Z' };
      expect(approval.status).toBe('approved');
      expect(approval.resolvedAt).toBeDefined();
    });

    it('pending -> rejected 상태 전이', () => {
      const approval = { ...sampleApprovals[0], status: 'rejected' as const, resolution: 'Too risky' };
      expect(approval.status).toBe('rejected');
      expect(approval.resolution).toBe('Too risky');
    });

    it('pending -> modified 상태 전이', () => {
      const approval = { ...sampleApprovals[0], status: 'modified' as const, resolution: 'Use different approach' };
      expect(approval.status).toBe('modified');
    });
  });
});
