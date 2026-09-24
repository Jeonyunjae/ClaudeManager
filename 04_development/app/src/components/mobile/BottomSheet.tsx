'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** [확인] 버튼 라벨. 기본값 "확인" */
  confirmLabel?: string;
};

/**
 * 하단 시트 (MOD-M01·MOD-M02 공용) — DES-006 §모달 명세, DES-004 §오버레이.
 *
 * Radix Dialog를 기반으로 해 접근성(포커스 트랩·`role=dialog`·`aria-*`·Escape 닫기)을 그대로 얻고,
 * 바깥 영역 탭(Overlay 클릭)으로도 닫힌다(Radix 기본 동작). 시트 자체는 화면 하단에 붙이고
 * 위쪽만 둥글게 처리해 "하단 시트" 형태로 만든다.
 */
export function BottomSheet({ open, onClose, title, children, confirmLabel = '확인' }: BottomSheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[var(--bg-overlay)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 w-full rounded-t-[var(--radius-xl)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-xl)]',
            'pb-[calc(1.25rem+env(safe-area-inset-bottom))]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom'
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <DialogPrimitive.Title className="text-base font-semibold text-[var(--text-primary)]">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="닫기"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-500)]"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>

          <div className="text-sm text-[var(--text-secondary)] space-y-2">{children}</div>

          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full min-h-[44px] rounded-[var(--radius-md)] bg-[var(--primary-500)] text-white text-sm font-medium hover:bg-[var(--primary-600)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-500)] focus-visible:ring-offset-2"
          >
            {confirmLabel}
          </button>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

type GuideSheetProps = {
  open: boolean;
  onClose: () => void;
};

/** MOD-M01 홈 화면에 추가하기 — EVT-M01-4·EVT-M03-5, DES-006/DES-004 */
export function InstallGuideSheet({ open, onClose }: GuideSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="홈 화면에 추가하기">
      <ol className="list-decimal list-inside space-y-1">
        <li>아래 공유 버튼(⬆)을 누르세요</li>
        <li>&quot;홈 화면에 추가&quot;를 선택하세요</li>
        <li>홈 화면에 생긴 아이콘으로 여세요</li>
      </ol>
      <p>푸시 알림은 이렇게 설치한 앱에서만 받을 수 있습니다.</p>
    </BottomSheet>
  );
}

/** MOD-M02 알림이 꺼져 있습니다 — EVT-M03-6, DES-006/DES-004 */
export function PermissionGuideSheet({ open, onClose }: GuideSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="알림이 꺼져 있습니다">
      <p>설정 &gt; 알림 &gt; ClaudeManager에서 &quot;알림 허용&quot;을 켜 주세요.</p>
    </BottomSheet>
  );
}
