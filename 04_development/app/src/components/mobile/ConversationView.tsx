'use client';

import React, { useLayoutEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ConversationMessage, StreamingState } from '@/stores/mobileChatStore';

type ConversationViewProps = {
  messages: ConversationMessage[];
  streaming: StreamingState;
  typing: boolean;
  queueDepth: number;
  hasMore: boolean;
  loadingMore: boolean;
  loading: boolean;
  error: string | null;
  /** DF-011: EVT-M02-4 추가 로딩 실패 — 목록 맨 위 "불러오지 못했습니다 · 다시" */
  loadMoreError: string | null;
  onLoadMore: () => void;
  onRetry: () => void;
  onResend: (messageId: string) => void;
};

function MessageTime({ iso }: { iso: string }) {
  const hhmm = (() => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  })();
  return <span className="text-[10px] text-[var(--text-tertiary)]">{hhmm}</span>;
}

/** SCR-M02 대화 메시지 목록 — DES-006 §ConversationView (MessageBubble·스트리밍·대기열) */
export function ConversationView({
  messages,
  streaming,
  typing,
  queueDepth,
  hasMore,
  loadingMore,
  loading,
  error,
  loadMoreError,
  onLoadMore,
  onRetry,
  onResend,
}: ConversationViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number | null>(null);
  const isPrependRef = useRef(false);
  const prevMessageCountRef = useRef(messages.length);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (isPrependRef.current && prevScrollHeightRef.current !== null) {
      el.scrollTop += el.scrollHeight - prevScrollHeightRef.current;
      isPrependRef.current = false;
      prevScrollHeightRef.current = null;
    } else if (messages.length !== prevMessageCountRef.current) {
      el.scrollTop = el.scrollHeight;
    }
    prevMessageCountRef.current = messages.length;
  }, [messages, streaming]);

  function handleScroll(): void {
    const el = containerRef.current;
    if (!el) return;
    // loadMoreError가 있으면 스크롤로 자동 재시도하지 않는다 — 사용자가 [다시]를 눌러야 한다 (DF-011)
    if (el.scrollTop < 40 && hasMore && !loadingMore && !loadMoreError) {
      isPrependRef.current = true;
      prevScrollHeightRef.current = el.scrollHeight;
      onLoadMore();
    }
  }

  function handleRetryLoadMore(): void {
    const el = containerRef.current;
    if (el) {
      isPrependRef.current = true;
      prevScrollHeightRef.current = el.scrollHeight;
    }
    onLoadMore();
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-[var(--text-tertiary)]">
        불러오는 중…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-sm text-[var(--status-error-text)]">
        <span>불러오지 못했습니다</span>
        <button type="button" onClick={onRetry} className="text-[var(--primary-500)] font-medium underline">
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-3">
      {loadingMore && (
        <p className="text-center text-xs text-[var(--text-tertiary)] py-2">이전 대화 불러오는 중…</p>
      )}

      {loadMoreError && !loadingMore && (
        <p className="text-center text-xs text-[var(--status-error-text)] py-2">
          {loadMoreError} ·{' '}
          <button type="button" onClick={handleRetryLoadMore} className="text-[var(--primary-500)] font-medium underline">
            다시
          </button>
        </p>
      )}

      {messages.length === 0 && !streaming && (
        <div className="h-full flex items-center justify-center text-sm text-[var(--text-tertiary)] text-center px-6">
          아직 대화가 없습니다. 첫 지시를 보내 보세요
        </div>
      )}

      {messages.map((m) => {
        const isInstruction = m.type === 'instruction';
        return (
          <div key={m.id} className={`flex mb-3 ${isInstruction ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] ${isInstruction ? 'text-right' : ''}`}>
              <div
                className={
                  isInstruction
                    ? 'bg-[var(--primary-500)] text-white px-4 py-2.5 rounded-[var(--radius-2xl)] rounded-br-[var(--radius-sm)]'
                    : 'bg-white border border-[var(--primary-50)] px-4 py-2.5 rounded-[var(--radius-2xl)] rounded-bl-[var(--radius-sm)] shadow-[var(--shadow-sm)]'
                }
              >
                {isInstruction ? (
                  <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                ) : (
                  <div className="text-sm prose prose-sm max-w-none text-[var(--text-primary)]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || ' '}</ReactMarkdown>
                  </div>
                )}
                {m.metadata?.tools && m.metadata.tools.length > 0 && (
                  <p className="text-[10px] mt-1 opacity-70">🔧 도구 {m.metadata.tools.length}회 사용</p>
                )}
                {m.metadata?.queued && <p className="text-[10px] mt-1 opacity-80">대기 중</p>}
                {m.metadata?.cancelled && <p className="text-[10px] mt-1 opacity-80">취소됨</p>}
              </div>
              <div className="flex items-center gap-2 mt-1 justify-end">
                {m.failed && (
                  <>
                    <span className="text-[10px] text-[var(--status-error-text)]">전송 실패</span>
                    <button
                      type="button"
                      onClick={() => onResend(m.id)}
                      className="text-[10px] text-[var(--primary-500)] font-medium underline"
                    >
                      다시 보내기
                    </button>
                  </>
                )}
                <MessageTime iso={m.timestamp} />
              </div>
            </div>
          </div>
        );
      })}

      {streaming && (
        <div className="flex justify-start mb-1">
          <div className="max-w-[80%] bg-white border border-[var(--primary-50)] px-4 py-2.5 rounded-[var(--radius-2xl)] rounded-bl-[var(--radius-sm)] shadow-[var(--shadow-sm)]">
            <div className="text-sm prose prose-sm max-w-none text-[var(--text-primary)]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{streaming.content || ' '}</ReactMarkdown>
              <span className="inline-block w-1.5 h-3.5 bg-[var(--primary-400)] align-middle ml-0.5 animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {typing && !streaming && (
        <p className="text-xs text-[var(--text-tertiary)] mb-2">응답 중…</p>
      )}

      {streaming?.tool && (
        <p className="text-xs text-[var(--text-tertiary)] mb-2">🔧 도구 실행 중: {streaming.tool}</p>
      )}

      {queueDepth > 0 && (
        <p className="text-xs text-[var(--text-tertiary)] mb-2">앞선 요청 {queueDepth}건 처리 후 실행됩니다</p>
      )}
    </div>
  );
}
