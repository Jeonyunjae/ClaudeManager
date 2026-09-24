'use client';

import React, { useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAgentStore } from '@/stores/agentStore';
import { useInboxStore } from '@/stores/inboxStore';
import { useMobileChatStore } from '@/stores/mobileChatStore';
import { useWsConnectionStatus } from '@/hooks/useMobileRealtime';
import { ConnectionBar } from '@/components/mobile/ConnectionBar';
import { ConversationView } from '@/components/mobile/ConversationView';
import { MessageComposer } from '@/components/mobile/MessageComposer';
import { agentInitial, agentRoleLabel, agentStatusLabel } from '@/lib/mobile-format';

/** SCR-M02 대화 `/m/chat/[agentId]` — DES-006, FR-004·FR-005·FR-007 */
export default function MobileConversationPage() {
  const router = useRouter();
  const params = useParams<{ agentId: string }>();
  const agentId = params.agentId;

  const { initialized, isLoading: treeLoading, getAgent, fetchTree } = useAgentStore();
  const { fetchInbox } = useInboxStore();
  const { load, loadMore, send, resend, getAgentState } = useMobileChatStore();

  // EVT-SH-2: 재연결 성공 시 대화 화면은 conversations 1페이지를 재조회해 누락분을 채운다 (DES-007 §4).
  const connected = useWsConnectionStatus(
    useCallback(() => {
      load(agentId);
    }, [agentId, load])
  );

  const agent = getAgent(agentId);
  const chatState = getAgentState(agentId);

  useEffect(() => {
    if (!initialized && !treeLoading) {
      fetchTree();
    }
  }, [initialized, treeLoading, fetchTree]);

  useEffect(() => {
    load(agentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  function handleBack(): void {
    router.push('/m/chat');
    void fetchInbox(); // EVT-M02-1: 뒤로 갈 때 인박스 재조회
  }

  // 트리를 아직 못 불러왔으면(초기 로딩) 판단을 미룬다. 불러왔는데도 없으면 404.
  if (!agent && (!initialized || treeLoading)) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-[var(--text-tertiary)]">
        불러오는 중…
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-sm text-[var(--text-primary)]">
        <span>에이전트를 찾을 수 없습니다</span>
        <button
          type="button"
          onClick={() => router.push('/m/chat')}
          className="text-[var(--primary-500)] font-medium underline"
        >
          목록으로
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-3 py-2.5 border-b border-[var(--primary-50)] bg-[var(--bg-surface)]">
        <button
          type="button"
          onClick={handleBack}
          aria-label="뒤로"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-xl text-[var(--text-secondary)]"
        >
          {'‹'}
        </button>
        <div className="w-8 h-8 rounded-full bg-[var(--primary-100)] flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-[var(--primary-600)]">{agentInitial(agent.name)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">{agent.name}</p>
          <p className="text-xs text-[var(--text-tertiary)] truncate">
            {agentRoleLabel(agent.role)} · {agentStatusLabel(agent.status)}
            {agent.statusMessage ? `: ${agent.statusMessage}` : ''}
          </p>
        </div>
      </header>

      <ConnectionBar connected={connected} />

      <ConversationView
        messages={chatState.messages}
        streaming={chatState.streaming}
        typing={chatState.typing}
        queueDepth={chatState.queueDepth}
        hasMore={chatState.hasMore}
        loadingMore={chatState.loadingMore}
        loading={chatState.loading}
        error={chatState.error}
        loadMoreError={chatState.loadMoreError}
        onLoadMore={() => loadMore(agentId)}
        onRetry={() => load(agentId)}
        onResend={(messageId) => resend(agentId, messageId)}
      />

      <MessageComposer sending={chatState.sending} onSend={(content) => send(agentId, content)} />
    </div>
  );
}
