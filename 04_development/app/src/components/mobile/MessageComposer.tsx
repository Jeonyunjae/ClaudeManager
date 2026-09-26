'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { decideEnterAction } from '@/lib/composer-keys';
import { MAX_CHAT_ATTACHMENTS } from '@/lib/constants';
import type { ChatAttachment } from '@/stores/mobileChatStore';

type MessageComposerProps = {
  sending: boolean;
  /** 성공 시 true, 실패 시 false를 돌려준다 — DF-009: 실패하면 입력 내용을 복원한다 */
  onSend: (content: string, attachments: ChatAttachment[]) => Promise<boolean>;
  /** 사진 1장 업로드 (FEAT-001). 실패하면 throw */
  onUpload: (file: File) => Promise<ChatAttachment>;
};

/** 입력창 위 미리보기 1칸 */
type PendingImage = {
  key: string;
  previewUrl: string;
  status: 'uploading' | 'done' | 'error';
  attachment?: ChatAttachment;
};

const MIN_ROWS = 1;
const MAX_ROWS = 6;

/** SCR-M02 입력창 — DES-006 §MessageComposer (1~6줄 자동 높이, trim 1자 이상) */
export function MessageComposer({ sending, onSend, onUpload }: MessageComposerProps) {
  const [value, setValue] = useState('');
  const [images, setImages] = useState<PendingImage[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploading = images.some((img) => img.status === 'uploading');
  const ready = images.filter((img) => img.status === 'done' && img.attachment);
  const canSend = (value.trim().length >= 1 || ready.length > 0) && !sending && !uploading;
  const canAttach = images.length < MAX_CHAT_ATTACHMENTS && !sending;

  // 화면을 떠날 때 미리보기 URL을 해제한다
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  useEffect(() => () => imagesRef.current.forEach((img) => URL.revokeObjectURL(img.previewUrl)), []);

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>): void {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_CHAT_ATTACHMENTS - images.length);
    e.target.value = ''; // 같은 사진을 다시 고를 수 있게
    for (const file of files) {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setImages((prev) => [...prev, { key, previewUrl: URL.createObjectURL(file), status: 'uploading' }]);
      onUpload(file).then(
        (attachment) =>
          setImages((prev) => prev.map((img) => (img.key === key ? { ...img, status: 'done', attachment } : img))),
        () => setImages((prev) => prev.map((img) => (img.key === key ? { ...img, status: 'error' } : img)))
      );
    }
  }

  function removeImage(key: string): void {
    setImages((prev) => {
      const target = prev.find((img) => img.key === key);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((img) => img.key !== key);
    });
  }

  function autoResize(el: HTMLTextAreaElement): void {
    el.style.height = 'auto';
    // px, text-base(16px/1.5) 기준 — BUG-028: iOS 자동 확대 방지를 위해 text-sm(14px)에서 올림
    const lineHeight = 24;
    const maxHeight = lineHeight * MAX_ROWS;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }

  // value가 어떤 경로로든(타이핑, 전송 시 비움, 실패 시 복원) 바뀌면 높이를 다시 맞춘다 —
  // DOM에 반영된 뒤(커밋 후) 실행되어야 scrollHeight가 정확하다.
  useEffect(() => {
    if (textareaRef.current) autoResize(textareaRef.current);
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>): void {
    setValue(e.target.value);
  }

  async function handleSubmit(): Promise<void> {
    if (!canSend) return;
    const content = value;
    const sent = images;
    setValue(''); // EVT-M02-2: 입력창 비움 (전송 시도와 동시에 즉시)
    setImages([]);

    const ok = await onSend(content, ready.map((img) => img.attachment as ChatAttachment));

    // DF-009: 전송 실패 시 입력 내용 복원. 그 사이 사용자가 새로 입력을 시작했으면(값이 비어 있지
    // 않으면) 그 입력을 덮어쓰지 않는다. 사진도 같은 규칙으로 되돌린다.
    if (!ok) {
      setValue((latest) => (latest === '' ? content : latest));
      setImages((latest) => (latest.length === 0 ? sent : latest));
    } else {
      sent.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key !== 'Enter' || e.shiftKey) return;

    // BUG-010: IME(한글 등) 조합 중 Enter, 터치 기기의 Enter는 전송하지 않는다.
    const isCoarsePointer =
      typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const action = decideEnterAction({
      isComposing: e.nativeEvent.isComposing,
      keyCode: e.keyCode,
      isCoarsePointer,
    });

    if (action === 'send') {
      e.preventDefault();
      handleSubmit();
    }
    // action === 'default': 조합 확정(IME) 또는 줄바꿈(터치 기기)에 기본 동작을 맡긴다.
  }

  return (
    <div
      className="sticky bottom-0 px-3 py-2 border-t border-[var(--primary-50)] bg-[var(--bg-surface)]"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
    >
      {images.length > 0 && (
        <div className="flex gap-3 pt-2 pr-2 pb-2 overflow-x-auto" aria-label="첨부한 사진">
          {images.map((img) => (
            <div key={img.key} className="relative shrink-0 w-16 h-16">
              {/* eslint-disable-next-line @next/next/no-img-element -- 로컬 blob 미리보기 */}
              <img
                src={img.previewUrl}
                alt="첨부 사진"
                className={cn(
                  'w-16 h-16 object-cover rounded-[var(--radius-md)] border',
                  img.status === 'error' ? 'border-red-400 opacity-50' : 'border-[var(--primary-100)]'
                )}
              />
              {img.status === 'uploading' && (
                <span className="absolute inset-0 flex items-center justify-center rounded-[var(--radius-md)] bg-black/30">
                  <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </span>
              )}
              {img.status === 'error' && (
                <span className="absolute bottom-0 inset-x-0 text-center text-[11px] font-medium text-white bg-red-500/90 rounded-b-[var(--radius-md)]">
                  실패
                </span>
              )}
              <button
                type="button"
                onClick={() => removeImage(img.key)}
                aria-label="사진 빼기"
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[var(--text-primary)] text-white text-xs leading-none flex items-center justify-center"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFiles}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={!canAttach}
          aria-label="사진 첨부"
          className={cn(
            'min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[var(--radius-lg)] transition-colors',
            canAttach ? 'text-[var(--primary-500)] hover:bg-[var(--primary-50)]' : 'text-[var(--text-tertiary)] cursor-not-allowed'
          )}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="8.5" cy="10" r="1.5" />
            <path d="m21 15-4.5-4.5L7 19" />
          </svg>
        </button>
        <textarea
          ref={textareaRef}
          rows={MIN_ROWS}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="메시지 입력…"
          aria-label="메시지 입력"
          className="flex-1 resize-none rounded-[var(--radius-lg)] border border-[var(--primary-100)] px-3 py-2 text-base text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-300)]"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSend}
          aria-label={sending ? '전송 중' : '전송'}
          className={cn(
            'min-w-[44px] min-h-[44px] px-4 rounded-[var(--radius-lg)] text-sm font-medium transition-colors',
            canSend
              ? 'bg-[var(--primary-500)] text-white hover:bg-[var(--primary-600)]'
              : 'bg-[var(--primary-100)] text-[var(--text-tertiary)] cursor-not-allowed'
          )}
        >
          {sending ? (
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            '전송'
          )}
        </button>
      </div>
    </div>
  );
}
