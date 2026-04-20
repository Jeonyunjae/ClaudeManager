'use client';

import React, { useState } from 'react';
import { CheckCircle, XCircle, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApprovalStore } from '@/stores/approvalStore';
import type { Approval } from '@/types/approval';
import { cn } from '@/lib/utils';

type ApprovalRequestCardProps = {
  approval: Approval;
};

export function ApprovalRequestCard({ approval }: ApprovalRequestCardProps) {
  const { approve, reject, modify } = useApprovalStore();
  const [showModifyInput, setShowModifyInput] = useState(false);
  const [modifyComment, setModifyComment] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await approve(approval.id);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await reject(approval.id, '반려합니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleModify = async () => {
    if (!modifyComment.trim()) return;
    setIsProcessing(true);
    try {
      await modify(approval.id, modifyComment);
    } finally {
      setIsProcessing(false);
      setShowModifyInput(false);
    }
  };

  const urgencyColor = {
    low: 'border-l-[var(--status-idle)]',
    normal: 'border-l-[var(--status-pending)]',
    high: 'border-l-[var(--status-pending)]',
    critical: 'border-l-[var(--status-error)]',
  }[approval.urgency];

  return (
    <div className={cn(
      'mx-4 mb-3 rounded-[var(--radius-lg)] border border-[var(--primary-50)] bg-white shadow-[var(--shadow-sm)] border-l-4 overflow-hidden',
      urgencyColor
    )}>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--status-pending-bg)] text-[var(--status-pending-text)]">
            승인 요청
          </span>
          {approval.urgency !== 'normal' && (
            <span className="text-xs font-medium text-[var(--status-error-text)]">
              {approval.urgency === 'critical' ? '긴급' : '높음'}
            </span>
          )}
        </div>
        <h4 className="font-semibold text-sm text-[var(--text-primary)] mb-1">{approval.title}</h4>
        <p className="text-sm text-[var(--text-secondary)]">{approval.content}</p>
      </div>

      {approval.status === 'pending' && (
        <div className="px-4 pb-4">
          {showModifyInput ? (
            <div className="flex gap-2">
              <Input
                value={modifyComment}
                onChange={(e) => setModifyComment(e.target.value)}
                placeholder="수정 지시 입력..."
                className="flex-1"
              />
              <Button size="sm" onClick={handleModify} disabled={isProcessing}>
                전송
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowModifyInput(false)}>
                취소
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="success" onClick={handleApprove} disabled={isProcessing}>
                <CheckCircle className="h-3.5 w-3.5 mr-1" /> 승인
              </Button>
              <Button size="sm" variant="danger" onClick={handleReject} disabled={isProcessing}>
                <XCircle className="h-3.5 w-3.5 mr-1" /> 반려
              </Button>
              <Button size="sm" variant="warning" onClick={() => setShowModifyInput(true)} disabled={isProcessing}>
                <Edit3 className="h-3.5 w-3.5 mr-1" /> 수정 지시
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
