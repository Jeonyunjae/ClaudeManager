'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Rnd } from 'react-rnd';
import { useAgentDetailStore } from '@/stores/agentDetailStore';
import { useAgentStore } from '@/stores/agentStore';
import { apiClient } from '@/lib/api';
import { FolderPickerPopup } from './FolderPickerPopup';

/* ──────────────────────────────────────────────
   Design tokens (from prototype CSS :root)
   ────────────────────────────────────────────── */
const T = {
  bgPage: '#E8ECEF',
  bgCard: '#FFFFFF',
  bgDarkCard: '#10141A',
  textPrimary: '#10141A',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textWhite: '#FFFFFF',
  borderLight: '#E5E7EB',
  accentBlue: '#3B82F6',
  accentPurple: '#7C5CFC',
  accentCoral: '#E8606D',
  accentMint: '#34D399',
  accentAmber: '#F59E0B',
  statusActive: '#3B82F6',
  statusIdle: '#9CA3AF',
  statusPending: '#F59E0B',
  statusError: '#EF4444',
  statusComplete: '#10B981',
  shadowPopup: '0 20px 60px rgba(0,0,0,0.15)',
  radiusCard: '14px',
};

const ALL_TABS: { key: 'info' | 'cli' | 'chat' | 'log' | 'note'; label: string }[] = [
  { key: 'info', label: '정보' },
  { key: 'cli', label: 'CLI' },
  { key: 'chat', label: '대화' },
  { key: 'log', label: '로그' },
  { key: 'note', label: '노트' },
];

// Main/Sub: all tabs, Part/Instance: info + log only (no CLI/chat)
function getTabsForRole(role?: string) {
  if (role === 'part' || role === 'instance') {
    return ALL_TABS.filter(t => t.key === 'info' || t.key === 'log');
  }
  return ALL_TABS;
}

/* ── Status helpers ── */
function statusBadgeStyle(status: string): React.CSSProperties {
  const map: Record<string, { bg: string; color: string }> = {
    active: { bg: '#DBEAFE', color: '#1E40AF' },
    idle: { bg: '#F3F4F6', color: T.textSecondary },
    pending: { bg: '#FEF3C7', color: '#92400E' },
    error: { bg: '#FEE2E2', color: '#991B1B' },
    stopped: { bg: '#F3F4F6', color: T.textSecondary },
  };
  const s = map[status] || map.idle;
  return { background: s.bg, color: s.color };
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    active: 'Active',
    idle: 'Idle',
    pending: 'Pending',
    error: 'Error',
    stopped: 'Stopped',
  };
  return map[status] || status;
}

/* ═══════════════════════════════════════════════
   INFO TAB
   ═══════════════════════════════════════════════ */
function InfoTab() {
  const { selectedAgent, openAgent, closeAgent } = useAgentDetailStore();
  const { fetchTree } = useAgentStore();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showNotesPathPicker, setShowNotesPathPicker] = useState(false);

  const notesPath = (selectedAgent as Record<string, unknown>)?.notesPath as string | undefined;

  const handleNotesPathSelect = async (folderPath: string) => {
    if (!selectedAgent) return;
    try {
      await apiClient.put(`/api/agents/${selectedAgent.id}`, { notesPath: folderPath });
      openAgent(selectedAgent.id);
    } catch (e) {
      console.error('Failed to update notesPath:', e);
    }
    setShowNotesPathPicker(false);
  };

  const handleAction = async (action: 'restart' | 'stop' | 'delete') => {
    if (!selectedAgent) return;
    if (action === 'delete' && !confirm(`"${selectedAgent.name}" 에이전트를 삭제하시겠습니까?`)) return;

    setActionLoading(action);
    try {
      if (action === 'delete') {
        await apiClient.del(`/api/agents/${selectedAgent.id}`);
        await fetchTree();
        closeAgent();
      } else {
        await apiClient.patch(`/api/agents/${selectedAgent.id}`, { action });
        await fetchTree();
        openAgent(selectedAgent.id);
      }
    } catch (e) {
      console.error(`Agent ${action} failed:`, e);
      alert(`${action} 실패`);
    } finally {
      setActionLoading(null);
    }
  };
  if (!selectedAgent) return null;

  const uptime = selectedAgent.uptimeSeconds
    ? `${Math.floor(selectedAgent.uptimeSeconds / 3600)}h ${Math.floor((selectedAgent.uptimeSeconds % 3600) / 60)}m`
    : '-';

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '11px', fontWeight: 600, color: T.textTertiary,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    marginBottom: '8px', marginTop: '16px',
  };
  const infoRowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 0', borderBottom: '1px solid #F9FAFB', fontSize: '12px',
  };
  const labelStyle: React.CSSProperties = {
    color: T.textSecondary, display: 'flex', alignItems: 'center', gap: '6px',
  };
  const valueStyle: React.CSSProperties = { fontWeight: 500 };
  const iconStyle: React.CSSProperties = { width: '14px', height: '14px' };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
      {/* Basic Info */}
      <div style={{ ...sectionTitleStyle, marginTop: 0 }}>기본 정보</div>

      <div style={infoRowStyle}>
        <span style={labelStyle}>
          <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke={T.textTertiary} strokeWidth="2"><circle cx="12" cy="7" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>
          역할
        </span>
        <span style={valueStyle}>{selectedAgent.role === 'main' ? 'Main 오케스트레이터' : selectedAgent.taskType || selectedAgent.role}</span>
      </div>
      <div style={infoRowStyle}>
        <span style={labelStyle}>
          <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke={T.textTertiary} strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          가동 시간
        </span>
        <span style={valueStyle}>{uptime}</span>
      </div>
      <div style={infoRowStyle}>
        <span style={labelStyle}>
          <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke={T.textTertiary} strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          세션 ID
        </span>
        <span style={{
          ...valueStyle,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '11px', background: '#F3F4F6',
          padding: '2px 8px', borderRadius: '4px',
          maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {(() => {
            const sid = selectedAgent.cliSessionId || selectedAgent.tmuxSession;
            return sid ? sid.substring(0, 16) + (sid.length > 16 ? '...' : '') : '-';
          })()}
        </span>
      </div>
      <div style={infoRowStyle}>
        <span style={labelStyle}>
          <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke={T.textTertiary} strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/></svg>
          모델
        </span>
        <select
          value={selectedAgent.modelName || 'sonnet'}
          onChange={async (e) => {
            try {
              await apiClient.put(`/api/agents/${selectedAgent.id}`, { modelName: e.target.value });
              openAgent(selectedAgent.id);
            } catch (err) {
              console.error('Failed to update model:', err);
            }
          }}
          style={{
            padding: '4px 8px', borderRadius: '6px',
            border: `1px solid ${T.borderLight}`, fontSize: '12px',
            fontWeight: 500, background: T.bgCard, cursor: 'pointer',
            outline: 'none', color: T.textPrimary,
          }}
        >
          <option value="sonnet">Claude Sonnet</option>
          <option value="opus">Claude Opus</option>
          <option value="haiku">Claude Haiku</option>
        </select>
      </div>
      <div style={infoRowStyle}>
        <span style={labelStyle}>
          <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke={T.textTertiary} strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          노트 경로
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            ...valueStyle,
            fontSize: '11px',
            maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            color: notesPath ? T.textPrimary : T.textTertiary,
          }}>
            {notesPath || '미설정'}
          </span>
          <button
            onClick={() => setShowNotesPathPicker(true)}
            style={{
              padding: '3px 8px', borderRadius: '6px', border: `1px solid ${T.borderLight}`,
              background: 'transparent', fontSize: '10px', fontWeight: 500,
              color: T.accentPurple, cursor: 'pointer',
            }}
          >
            {notesPath ? '변경' : '설정'}
          </button>
        </div>
      </div>
      {showNotesPathPicker && (
        <FolderPickerPopup onSelect={handleNotesPathSelect} onClose={() => setShowNotesPathPicker(false)} />
      )}

      {/* Cost & Usage */}
      <div style={sectionTitleStyle}>비용 및 사용량</div>
      <div style={infoRowStyle}>
        <span style={labelStyle}>
          <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke={T.textTertiary} strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          총 비용
        </span>
        <span style={valueStyle}>{selectedAgent.totalCost != null && selectedAgent.totalCost > 0 ? `$${selectedAgent.totalCost.toFixed(4)}` : '-'}</span>
      </div>
      <div style={infoRowStyle}>
        <span style={labelStyle}>
          <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke={T.textTertiary} strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          입력 토큰
        </span>
        <span style={valueStyle}>{selectedAgent.totalInputTokens ? selectedAgent.totalInputTokens.toLocaleString() : '-'}</span>
      </div>
      <div style={infoRowStyle}>
        <span style={labelStyle}>
          <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke={T.textTertiary} strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          출력 토큰
        </span>
        <span style={valueStyle}>{selectedAgent.totalOutputTokens ? selectedAgent.totalOutputTokens.toLocaleString() : '-'}</span>
      </div>

      {/* Progress Section */}
      <div style={{
        marginTop: '16px', padding: '14px', background: '#F9FAFB',
        borderRadius: '10px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600 }}>전체 진척율</span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: T.accentPurple }}>-</span>
        </div>
        <div style={{ height: '6px', background: '#E5E7EB', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '3px',
            background: `linear-gradient(90deg, ${T.accentPurple}, ${T.accentBlue})`,
            width: '0%', transition: 'width 0.5s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: T.textTertiary, marginTop: '6px' }}>
          <span>시작: {selectedAgent.startedAt ? new Date(selectedAgent.startedAt).toLocaleString('ko-KR') : '-'}</span>
          <span>예상 완료: -</span>
        </div>
      </div>

      {/* Actions */}
      <div style={{
        display: 'flex', gap: '8px', marginTop: '20px', paddingTop: '16px',
        borderTop: `1px solid ${T.borderLight}`,
      }}>
        <button
          style={{
            padding: '8px 16px', borderRadius: '8px', border: 'none',
            fontSize: '12px', fontWeight: 500, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
            background: '#DBEAFE', color: '#1E40AF',
            opacity: actionLoading ? 0.6 : 1,
          }}
          disabled={!!actionLoading}
          onClick={() => handleAction('restart')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          {actionLoading === 'restart' ? '재시작 중...' : '재시작'}
        </button>
        <button
          style={{
            padding: '8px 16px', borderRadius: '8px', border: 'none',
            fontSize: '12px', fontWeight: 500, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
            background: '#FEE2E2', color: '#991B1B',
            opacity: actionLoading ? 0.6 : 1,
          }}
          disabled={!!actionLoading}
          onClick={() => handleAction('stop')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          {actionLoading === 'stop' ? '정지 중...' : '정지'}
        </button>
        <button
          style={{
            padding: '8px 16px', borderRadius: '8px', border: 'none',
            fontSize: '12px', fontWeight: 500, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
            background: '#F3F4F6', color: T.textSecondary,
            opacity: actionLoading ? 0.6 : 1,
          }}
          disabled={!!actionLoading}
          onClick={() => handleAction('delete')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          {actionLoading === 'delete' ? '삭제 중...' : '삭제'}
        </button>
        <button
          style={{
            padding: '8px 16px', borderRadius: '8px', border: 'none',
            fontSize: '12px', fontWeight: 500, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
            background: '#E0E7FF', color: '#3730A3',
            marginLeft: 'auto',
          }}
          onClick={async () => {
            try {
              await apiClient.post(`/api/agents/${selectedAgent.id}/open-terminal`, {});
            } catch {}
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
          Terminal
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   CLI TAB
   ═══════════════════════════════════════════════ */
function CLITab() {
  const { selectedAgent, cliSession, fetchCLILogs } = useAgentDetailStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedAgent) fetchCLILogs(selectedAgent.id);
  }, [selectedAgent, fetchCLILogs]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [cliSession?.logs]);

  const sessionId = cliSession?.sessionId || 'N/A';
  const isActive = cliSession?.status === 'active' || cliSession?.status === 'idle';

  const termLineStyle: React.CSSProperties = {
    color: '#D1D5DB', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', lineHeight: 1.7,
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '11px', fontWeight: 500, fontFamily: "'JetBrains Mono', monospace",
            background: '#F3F4F6', padding: '3px 10px', borderRadius: '6px', color: T.textSecondary,
          }}>{sessionId.substring(0, 8)}...</span>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isActive ? T.accentMint : '#EF4444', display: 'inline-block' }} />
          <span style={{ fontSize: '10px', color: isActive ? T.accentMint : '#EF4444', fontWeight: 500 }}>
            {isActive ? 'Active' : 'Stopped'}
          </span>
          {cliSession && (
            <span style={{ fontSize: '10px', color: T.textTertiary }}>
              ({cliSession.messageCount} messages)
            </span>
          )}
        </div>
        <button
          onClick={() => selectedAgent && fetchCLILogs(selectedAgent.id)}
          style={{
            padding: '4px 10px', borderRadius: '6px', border: 'none',
            background: '#F3F4F6', color: T.textSecondary, cursor: 'pointer',
            fontSize: '11px', fontWeight: 500, fontFamily: 'inherit',
          }}
        >
          Refresh
        </button>
      </div>

      {/* Terminal View */}
      <div style={{ background: T.bgDarkCard, borderRadius: '12px', overflow: 'hidden' }}>
        {/* Terminal header dots */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '10px 16px', background: 'rgba(255,255,255,0.03)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FF5F56' }} />
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FFBD2E' }} />
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#27C93F' }} />
          <span style={{ fontSize: '11px', color: '#6B7280', marginLeft: '8px', fontFamily: "'JetBrains Mono', monospace" }}>
            {selectedAgent?.name} — claude session
          </span>
        </div>

        {/* Terminal body */}
        <div ref={scrollRef} style={{ padding: '16px', minHeight: '340px', maxHeight: '460px', overflowY: 'auto', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', lineHeight: 1.7 }}>
          <div style={termLineStyle}><span style={{ color: '#4B5563' }}># Agent: {selectedAgent?.name}</span></div>
          <div style={termLineStyle}><span style={{ color: '#4B5563' }}># Session: {sessionId}</span></div>
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '12px 0' }} />

          {(!cliSession?.logs || cliSession.logs.length === 0) ? (
            <div style={termLineStyle}><span style={{ color: '#6B7280' }}>No CLI activity yet.</span></div>
          ) : (
            cliSession.logs.map((log, i) => (
              <div key={i} style={{ marginBottom: '16px' }}>
                {/* Timestamp */}
                <div style={termLineStyle}>
                  <span style={{ color: '#4B5563' }}>
                    # {new Date(log.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                {/* Command */}
                <div style={termLineStyle}>
                  <span style={{ color: '#34D399' }}>$</span>{' '}
                  <span style={{ color: '#93C5FD' }}>claude</span>{' '}
                  <span style={{ color: '#FCA5A5' }}>--print --continue</span>{' '}
                  <span style={{ color: '#FDE68A' }}>&quot;{log.prompt.length > 50 ? log.prompt.substring(0, 50) + '...' : log.prompt}&quot;</span>
                </div>
                {/* Response */}
                <div style={{ ...termLineStyle, color: log.isError ? '#FCA5A5' : '#E5E7EB', whiteSpace: 'pre-wrap' as const, marginTop: '4px' }}>
                  {log.response.length > 300 ? log.response.substring(0, 300) + '...' : log.response}
                </div>
                {/* Stats */}
                <div style={termLineStyle}>
                  <span style={{ color: log.isError ? '#FCA5A5' : '#34D399' }}>
                    {log.isError ? '✗ Error' : '✓ Done'}
                  </span>{' '}
                  <span style={{ color: '#6B7280' }}>
                    (tokens: {(log.inputTokens + log.outputTokens).toLocaleString()} / cost: ${log.costUsd.toFixed(4)} / {(log.durationMs / 1000).toFixed(1)}s)
                  </span>
                </div>
                {i < cliSession.logs.length - 1 && (
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '8px 0' }} />
                )}
              </div>
            ))
          )}

          {/* Cursor */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
            <span style={{ color: '#34D399' }}>$</span>
            <div style={{ width: '7px', height: '14px', background: '#34D399', animation: 'blink 1s step-end infinite' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   CHAT TAB
   ═══════════════════════════════════════════════ */
/**
 * 에이전트가 실행한 도구 목록.
 *
 * 없으면 응답이 나올 때까지 20초간 화면이 비어 있어 "멈춘 건가" 싶어진다.
 * 무엇을 읽고 무엇을 고쳤는지 한 줄씩 보여준다.
 */
function ToolTrace({ tools }: { tools: { name: string; target?: string }[] }) {
  if (tools.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 6 }}>
      {tools.map((t, i) => (
        <div
          key={`${t.name}-${i}`}
          style={{
            display: 'flex', alignItems: 'baseline', gap: 8,
            fontSize: '10.5px', color: T.textTertiary,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            padding: '1px 2px',
          }}
        >
          <span style={{ color: T.accentPurple, flexShrink: 0 }}>▸</span>
          <span style={{ fontWeight: 600, flexShrink: 0, minWidth: 52 }}>{t.name}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t.target ?? ''}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChatTab() {
  const { conversations, selectedAgent, sendMessage, cancelChat, isAgentSending, hasMoreConversations, isLoadingMore, loadMoreConversations } = useAgentDetailStore();
  const isSending = selectedAgent ? isAgentSending(selectedAgent.id) : false;
  const [inputValue, setInputValue] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ filename: string; path: string; type: string; preview?: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  // 답변 중에 들어온 질문 수. 서버 대기열이 진실이고 WS로 받아 표시만 한다.
  const { queueDepth: queueDepthOf, cancelQueued: cancelQueuedInStore } = useAgentDetailStore();
  const queueDepth = selectedAgent ? queueDepthOf(selectedAgent.id) : 0;

  const cancelQueuedMessage = useCallback(
    (messageId: string) => {
      if (!selectedAgent) return;
      void cancelQueuedInStore(selectedAgent.id, messageId);
    },
    [selectedAgent, cancelQueuedInStore]
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number>(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations.length]);

  // Scroll to bottom on tab mount
  useEffect(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
    });
  }, []);

  // Scroll to top detection for loading more
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || !selectedAgent || isLoadingMore || !hasMoreConversations) return;
    if (container.scrollTop < 60) {
      prevScrollHeightRef.current = container.scrollHeight;
      loadMoreConversations(selectedAgent.id).then(() => {
        // Preserve scroll position after prepending older messages
        requestAnimationFrame(() => {
          if (messagesContainerRef.current) {
            const newScrollHeight = messagesContainerRef.current.scrollHeight;
            messagesContainerRef.current.scrollTop = newScrollHeight - prevScrollHeightRef.current;
          }
        });
      });
    }
  }, [selectedAgent, isLoadingMore, hasMoreConversations, loadMoreConversations]);

  const agentName = selectedAgent?.name || 'Agent';

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);

        const token = localStorage.getItem('auth_token') || '';
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (res.ok) {
          const json = await res.json();
          let preview: string | undefined;
          if (file.type.startsWith('image/')) {
            preview = URL.createObjectURL(file);
          }
          setAttachedFiles(prev => [...prev, {
            filename: json.data.filename,
            path: json.data.path,
            type: json.data.type,
            preview,
          }]);
        } else {
          const err = await res.json();
          alert(err.error?.message || 'Upload failed');
        }
      }
    } catch {
      alert('File upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachedFiles(prev => {
      const removed = prev[index];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSend = () => {
    // 답변 중에도 보낼 수 있다 — 서버 대기열이 순서를 지켜 처리한다.
    if ((!inputValue.trim() && attachedFiles.length === 0) || !selectedAgent) return;
    const msg = inputValue.trim() || (attachedFiles.length > 0 ? '첨부 파일을 분석해주세요.' : '');
    sendMessage(selectedAgent.id, msg, attachedFiles.length > 0 ? attachedFiles : undefined);
    setInputValue('');
    setAttachedFiles([]);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length === 0) return;

    e.preventDefault();
    setIsUploading(true);
    try {
      for (const file of imageFiles) {
        const ext = file.type.split('/')[1] || 'png';
        const filename = `screenshot-${Date.now()}.${ext}`;
        const renamedFile = new File([file], filename, { type: file.type });

        const formData = new FormData();
        formData.append('file', renamedFile);

        const token = localStorage.getItem('auth_token') || '';
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (res.ok) {
          const json = await res.json();
          const preview = URL.createObjectURL(renamedFile);
          setAttachedFiles(prev => [...prev, {
            filename: json.data.filename,
            path: json.data.path,
            type: json.data.type,
            preview,
          }]);
        } else {
          const err = await res.json();
          alert(err.error?.message || 'Upload failed');
        }
      }
    } catch {
      alert('Image paste upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Messages */}
      <div ref={messagesContainerRef} onScroll={handleScroll} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Load more indicator */}
        {isLoadingMore && (
          <div style={{ textAlign: 'center', padding: '8px 0', fontSize: '11px', color: T.textTertiary }}>
            Loading older messages...
          </div>
        )}
        {/* Date divider */}
        <div style={{ textAlign: 'center', padding: '12px 0', position: 'relative' }}>
          <div style={{
            position: 'absolute', left: '24px', right: '24px', top: '50%',
            height: '1px', background: T.borderLight,
          }} />
          <span style={{
            fontSize: '10px', color: T.textTertiary, background: T.bgCard,
            padding: '0 12px', position: 'relative', zIndex: 1,
          }}>
            {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
          </span>
        </div>

        {conversations.length === 0 ? (
          /* System message */
          <div style={{ alignSelf: 'center', maxWidth: '85%' }}>
            <div style={{
              background: '#FEF3C7', color: '#92400E', borderRadius: '8px',
              fontSize: '11px', padding: '8px 14px',
            }}>
              {agentName} 에이전트가 시작되었습니다.
            </div>
          </div>
        ) : (
          conversations.map((c) => {
            const isUser = c.fromAgent === 'user' || c.fromAgent === '나';
            const isSystem = c.type === 'approval';

            if (isSystem) {
              return (
                <div key={c.id} style={{ alignSelf: 'flex-start', maxWidth: '85%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '6px', color: T.textSecondary }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: T.accentPurple, display: 'inline-block' }} />
                    {c.fromAgent}
                  </div>
                  <div style={{
                    padding: '10px 14px', fontSize: '12px', lineHeight: 1.6,
                    borderRadius: '14px', borderBottomLeftRadius: '4px',
                    background: '#F3F4F6', color: T.textPrimary,
                  }}>
                    {c.content}
                    {/* Approval card inline */}
                    <div style={{
                      background: '#FFFBEB', border: '1px solid #FDE68A',
                      borderRadius: '10px', padding: '12px', marginTop: '6px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <div style={{
                          width: '20px', height: '20px', borderRadius: '50%',
                          background: '#FDE68A', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#92400E' }}>승인 요청</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#78350F', marginBottom: '8px', lineHeight: 1.5 }}>{c.content}</div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: '#10B981', color: 'white' }}>승인</button>
                        <button style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: '#EF4444', color: 'white' }}>반려</button>
                        <button style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: '#F3F4F6', color: T.textPrimary }}>수정 지시</button>
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '9px', color: T.textTertiary, marginTop: '3px' }}>
                    {new Date(c.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              );
            }

            /*
             * Wave AI 패널 구조를 따른다:
             *   에이전트 답변 = 말풍선 없이 평문 (길고 마크다운·코드가 많아
             *                   말풍선에 가두면 답답하다)
             *   사용자 질문   = 오른쪽 정렬 말풍선
             *   발신자 라벨   = 없음 (정렬과 배경으로 구분)
             * 색은 Wave의 zinc 다크가 아니라 우리 토큰을 쓴다.
             */
            const meta = c.metadata as { tools?: { name: string; target?: string }[]; queued?: boolean; cancelled?: boolean } | undefined;
            const tools = meta?.tools ?? [];

            if (isUser) {
              const queued = meta?.queued;
              const cancelledMsg = meta?.cancelled;
              return (
                <div key={c.id} style={{ alignSelf: 'flex-end', maxWidth: 'calc(100% - 50px)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <div style={{
                    padding: '8px 12px', fontSize: '12px', lineHeight: 1.6,
                    borderRadius: '10px', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    background: cancelledMsg ? 'transparent' : T.accentPurple,
                    color: cancelledMsg ? T.textTertiary : 'white',
                    border: cancelledMsg ? `1px dashed ${T.borderLight}` : 'none',
                    textDecoration: cancelledMsg ? 'line-through' : 'none',
                    opacity: queued ? 0.55 : 1,
                  }}>
                    {c.content}
                  </div>
                  <div style={{ fontSize: '9px', marginTop: '3px', color: T.textTertiary, display: 'flex', gap: 6, alignItems: 'center' }}>
                    {cancelledMsg && <span>취소됨</span>}
                    {queued && !cancelledMsg && (
                      <>
                        <span>대기 중</span>
                        <button
                          onClick={() => cancelQueuedMessage(c.id)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.textTertiary, fontSize: '11px', padding: 0 }}
                          title="대기 중인 질문 취소"
                        >✕</button>
                      </>
                    )}
                    {new Date(c.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              );
            }

            return (
              <div key={c.id} style={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column' }}>
                {tools.length > 0 && <ToolTrace tools={tools} />}
                <div className="chat-markdown" style={{ fontSize: '12px', lineHeight: 1.7, color: T.textPrimary, padding: '2px 2px 0' }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{c.content}</ReactMarkdown>
                </div>
                <div style={{ fontSize: '9px', marginTop: '2px', color: T.textTertiary, padding: '0 2px' }}>
                  {new Date(c.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator — 라벨·말풍선 없이 점만 (Wave 구조) */}
        {isSending && (
          <div style={{ alignSelf: 'stretch', display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 2px' }}>
            <span className="typing-dot" style={{ width: '5px', height: '5px', borderRadius: '50%', background: T.accentPurple, animation: 'typingBounce 1.4s infinite ease-in-out', animationDelay: '0s' }} />
            <span className="typing-dot" style={{ width: '5px', height: '5px', borderRadius: '50%', background: T.accentPurple, animation: 'typingBounce 1.4s infinite ease-in-out', animationDelay: '0.2s' }} />
            <span className="typing-dot" style={{ width: '5px', height: '5px', borderRadius: '50%', background: T.accentPurple, animation: 'typingBounce 1.4s infinite ease-in-out', animationDelay: '0.4s' }} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Attached Files Preview */}
      {attachedFiles.length > 0 && (
        <div style={{
          display: 'flex', gap: '6px', flexWrap: 'wrap',
          padding: '8px 24px 0', borderTop: `1px solid ${T.borderLight}`, background: T.bgCard,
        }}>
          {attachedFiles.map((file, i) => {
            const isImage = file.type.startsWith('image/');
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '4px 8px', borderRadius: '6px',
                background: '#F3F4F6', fontSize: '11px', color: T.textSecondary,
                position: 'relative',
              }}>
                {isImage && file.preview ? (
                  <img
                    src={file.preview}
                    alt={file.filename}
                    style={{ width: '28px', height: '28px', borderRadius: '4px', objectFit: 'cover' }}
                  />
                ) : isImage ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                )}
                <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.filename}</span>
                <button
                  onClick={() => removeAttachment(i)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.textTertiary, padding: '0 2px', fontSize: '14px', lineHeight: 1 }}
                >&times;</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Input Area — Wave 구조: 첨부·전송 버튼을 입력창 안에 겹쳐 배치 */}
      <div style={{
        padding: '10px 20px 12px',
        borderTop: attachedFiles.length > 0 ? 'none' : `1px solid ${T.borderLight}`,
        background: T.bgCard,
      }}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileSelect}
          accept=".txt,.md,.csv,.json,.xml,.yaml,.yml,.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.svg,.ts,.tsx,.js,.jsx,.py,.sh,.sql,.log,.toml,.ini,.cfg"
        />

        <div style={{
          position: 'relative',
          border: `1px solid ${inputFocused ? T.accentPurple : T.borderLight}`,
          borderRadius: '12px',
          background: T.bgCard,
          boxShadow: inputFocused ? '0 0 0 3px rgba(124,92,252,0.10)' : 'none',
          transition: 'border-color .15s, box-shadow .15s',
        }}>
          <textarea
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 168) + 'px';
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder={
              isSending
                ? `${agentName}이(가) 작업 중 — 이어서 질문하면 순서대로 처리합니다`
                : `${agentName}에게 지시하기…  (Shift+Enter 줄바꿈)`
            }
            rows={1}
            style={{
              width: '100%', padding: '10px 76px 10px 12px',
              border: 'none', outline: 'none', background: 'transparent',
              fontSize: '12px', fontFamily: 'inherit', lineHeight: 1.6,
              resize: 'none', overflowY: 'auto', maxHeight: '168px',
              color: T.textPrimary, borderRadius: '12px',
            }}
          />

          {/* 첨부 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            style={{
              position: 'absolute', right: 42, bottom: 7,
              width: '28px', height: '28px', borderRadius: '8px', border: 'none',
              background: attachedFiles.length > 0 ? 'rgba(124,92,252,0.1)' : 'transparent',
              color: attachedFiles.length > 0 ? T.accentPurple : T.textTertiary,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: isUploading ? 0.5 : 1,
            }}
            title="파일 첨부"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          </button>

          {/* 전송 / 중지 */}
          {isSending ? (
            <button
              onClick={() => selectedAgent && cancelChat(selectedAgent.id)}
              style={{
                position: 'absolute', right: 8, bottom: 7,
                width: '28px', height: '28px', borderRadius: '8px',
                background: '#EF4444', color: 'white', border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              title="응답 중지"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() && attachedFiles.length === 0}
              style={{
                position: 'absolute', right: 8, bottom: 7,
                width: '28px', height: '28px', borderRadius: '8px',
                background: (inputValue.trim() || attachedFiles.length > 0) ? T.accentPurple : 'transparent',
                color: (inputValue.trim() || attachedFiles.length > 0) ? 'white' : T.textTertiary,
                border: 'none',
                cursor: (inputValue.trim() || attachedFiles.length > 0) ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              title="전송 (Enter)"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          )}
        </div>

        {queueDepth > 0 && (
          <div style={{ fontSize: '10px', color: T.textTertiary, marginTop: 6, paddingLeft: 2 }}>
            대기 중인 질문 {queueDepth}건 — 앞의 답변이 끝나면 순서대로 처리됩니다
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   LOG TAB
   ═══════════════════════════════════════════════ */
function LogTab() {
  const { logs, logCostSummary } = useAgentDetailStore();
  const [activeFilter, setActiveFilter] = useState('전체');
  const [searchValue, setSearchValue] = useState('');

  const filters = [
    { label: '전체', count: logs.length },
    { label: '작업', count: logs.filter(l => l.eventType === 'start' || l.eventType === 'task').length },
    { label: '보고', count: logs.filter(l => l.eventType === 'report').length },
    { label: '승인', count: logs.filter(l => l.eventType === 'approval').length },
    { label: '오류', count: logs.filter(l => l.eventType === 'error').length },
    { label: '명령', count: logs.filter(l => l.eventType === 'command').length },
  ];

  const eventBadgeStyle = (type: string): React.CSSProperties => {
    const map: Record<string, { bg: string; color: string }> = {
      start: { bg: '#DBEAFE', color: '#1E40AF' },
      task: { bg: '#DBEAFE', color: '#1E40AF' },
      complete: { bg: '#D1FAE5', color: '#065F46' },
      error: { bg: '#FEE2E2', color: '#991B1B' },
      approval: { bg: '#FEF3C7', color: '#92400E' },
      report: { bg: '#EDE9FE', color: '#5B21B6' },
      command: { bg: '#F3F4F6', color: T.textSecondary },
    };
    const s = map[type] || map.command;
    return {
      fontSize: '9px', fontWeight: 500, padding: '2px 8px',
      borderRadius: '10px', display: 'inline-block', whiteSpace: 'nowrap',
      background: s.bg, color: s.color,
    };
  };

  const eventLabel = (type: string): string => {
    const map: Record<string, string> = {
      start: '작업 시작', task: '작업', complete: '완료',
      error: '오류', approval: '승인 요청', report: '보고', command: '명령',
    };
    return map[type] || type;
  };

  const filteredLogs = logs.filter(l => {
    if (activeFilter === '전체') return true;
    if (activeFilter === '작업') return l.eventType === 'start' || l.eventType === 'task';
    if (activeFilter === '보고') return l.eventType === 'report';
    if (activeFilter === '승인') return l.eventType === 'approval';
    if (activeFilter === '오류') return l.eventType === 'error';
    if (activeFilter === '명령') return l.eventType === 'command';
    return true;
  }).filter(l => {
    if (!searchValue) return true;
    return (l.message || '').includes(searchValue) || (l.detail || '').includes(searchValue);
  });

  // Summary from cost_records (single source of truth)
  const totalCost = logCostSummary?.totalCost || 0;
  const totalTokens = (logCostSummary?.totalInputTokens || 0) + (logCostSummary?.totalOutputTokens || 0);
  const errorCount = logs.filter(l => l.eventType === 'error').length;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {filters.map(f => (
            <button
              key={f.label}
              onClick={() => setActiveFilter(f.label)}
              style={{
                padding: '4px 10px', borderRadius: '6px', border: 'none',
                fontSize: '10px', fontWeight: 500, cursor: 'pointer',
                background: activeFilter === f.label ? T.accentPurple : '#F3F4F6',
                color: activeFilter === f.label ? 'white' : T.textSecondary,
                transition: 'all 0.15s',
              }}
            >
              {f.label}<span style={{ fontSize: '9px', marginLeft: '3px', opacity: 0.7 }}>{f.count}</span>
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="로그 검색..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          style={{
            padding: '5px 10px', borderRadius: '6px',
            border: `1px solid ${T.borderLight}`, fontSize: '11px',
            outline: 'none', width: '160px', fontFamily: 'inherit',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = T.accentPurple; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = T.borderLight; }}
        />
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
        <div style={{ background: '#F9FAFB', borderRadius: '8px', padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: T.accentPurple }}>${totalCost.toFixed(2)}</div>
          <div style={{ fontSize: '9px', color: T.textTertiary, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px' }}>총 비용</div>
        </div>
        <div style={{ background: '#F9FAFB', borderRadius: '8px', padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: T.accentBlue }}>{totalTokens > 1000 ? `${Math.round(totalTokens / 1000)}K` : totalTokens}</div>
          <div style={{ fontSize: '9px', color: T.textTertiary, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px' }}>총 토큰</div>
        </div>
        <div style={{ background: '#F9FAFB', borderRadius: '8px', padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: T.accentMint }}>-</div>
          <div style={{ fontSize: '9px', color: T.textTertiary, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px' }}>가동 시간</div>
        </div>
        <div style={{ background: '#F9FAFB', borderRadius: '8px', padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: T.statusError }}>{errorCount}</div>
          <div style={{ fontSize: '9px', color: T.textTertiary, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px' }}>오류 횟수</div>
        </div>
      </div>

      {/* Log Table */}
      {filteredLogs.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', fontSize: '12px', color: T.textTertiary }}>
          로그가 없습니다
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['시간', '이벤트', '메시지', '비용', '토큰'].map(h => (
                <th key={h} style={{
                  textAlign: 'left', fontSize: '10px', fontWeight: 600,
                  color: T.textTertiary, textTransform: 'uppercase',
                  letterSpacing: '0.04em', padding: '8px 10px',
                  borderBottom: `1px solid ${T.borderLight}`,
                  position: 'sticky', top: 0, background: T.bgCard,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map(log => (
              <tr key={log.id} style={{ cursor: 'default' }}
                onMouseEnter={(e) => { (e.currentTarget.querySelectorAll('td') as NodeListOf<HTMLElement>).forEach(td => td.style.background = '#FAFBFC'); }}
                onMouseLeave={(e) => { (e.currentTarget.querySelectorAll('td') as NodeListOf<HTMLElement>).forEach(td => td.style.background = ''); }}
              >
                <td style={{ padding: '8px 10px', fontSize: '11px', borderBottom: '1px solid #F9FAFB', color: T.textTertiary, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                  {new Date(log.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td style={{ padding: '8px 10px', fontSize: '11px', borderBottom: '1px solid #F9FAFB', verticalAlign: 'middle' }}>
                  <span style={eventBadgeStyle(log.eventType)}>{eventLabel(log.eventType)}</span>
                </td>
                <td style={{
                  padding: '8px 10px', fontSize: '11px', borderBottom: '1px solid #F9FAFB',
                  maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  color: T.textPrimary, verticalAlign: 'middle',
                }}>
                  {log.message || log.detail || '-'}
                </td>
                <td style={{
                  padding: '8px 10px', borderBottom: '1px solid #F9FAFB',
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: T.textSecondary, verticalAlign: 'middle',
                }}>
                  {log.cost != null ? `$${log.cost.toFixed(2)}` : '\u2014'}
                </td>
                <td style={{
                  padding: '8px 10px', borderBottom: '1px solid #F9FAFB',
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: T.textTertiary, verticalAlign: 'middle',
                }}>
                  {((log.inputTokens || 0) + (log.outputTokens || 0)).toLocaleString() || '\u2014'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Cost Chart Section */}
      {logs.length > 0 && (
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: `1px solid ${T.borderLight}` }}>
          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '12px' }}>시간별 비용 추이 (오늘)</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', padding: '8px 12px', background: '#F9FAFB', borderRadius: '8px', fontSize: '11px' }}>
            <span>오늘 총 비용</span>
            <span style={{ fontSize: '16px', fontWeight: 700, color: T.accentPurple }}>${totalCost.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   NOTE TAB
   ═══════════════════════════════════════════════ */
/* Tree node for sidebar */
function TreeNode({ agentId, name, nodePath, depth }: { agentId: string; name: string; nodePath: string; depth: number }) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<{ folders: Array<{ name: string; path: string }>; files: Array<{ name: string; path: string }> } | null>(null);
  const [loading, setLoading] = useState(false);
  const { fetchNoteContent, selectedNoteContent } = useAgentDetailStore();

  const toggle = async () => {
    if (!expanded && !children) {
      setLoading(true);
      try {
        const { default: apiClient } = await import('@/lib/api');
        const res = await apiClient.get<{ folders: Array<{ name: string; path: string }>; files: Array<{ name: string; path: string }> }>(`/api/agents/${agentId}/notes?subpath=${encodeURIComponent(nodePath)}`);
        setChildren(res.data);
      } catch {} finally { setLoading(false); }
    }
    setExpanded(!expanded);
  };

  const isSelected = selectedNoteContent?.file === nodePath;

  return (
    <div>
      <button
        onClick={toggle}
        style={{
          display: 'flex', alignItems: 'center', gap: '2px',
          padding: `3px 8px 3px ${8 + depth * 16}px`,
          border: 'none', background: 'transparent', cursor: 'pointer',
          fontSize: '12px', color: T.textPrimary, width: '100%',
          textAlign: 'left', fontFamily: 'inherit',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{ width: '14px', fontSize: '8px', color: T.textTertiary, flexShrink: 0, textAlign: 'center' }}>
          {loading ? '...' : expanded ? '▼' : '▶'}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill={expanded ? '#FBBF24' : '#FCD34D'} stroke={expanded ? '#D97706' : '#F59E0B'} strokeWidth="1.5" style={{ flexShrink: 0 }}>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        <span style={{ marginLeft: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </span>
      </button>
      {expanded && children && (
        <div>
          {children.folders.map(f => (
            <TreeNode key={f.path} agentId={agentId} name={f.name} nodePath={f.path} depth={depth + 1} />
          ))}
          {children.files.map(f => (
            <button
              key={f.path}
              onClick={() => fetchNoteContent(agentId, f.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: `3px 8px 3px ${22 + (depth + 1) * 16}px`,
                border: 'none', cursor: 'pointer', fontSize: '12px',
                width: '100%', textAlign: 'left', fontFamily: 'inherit',
                background: selectedNoteContent?.file === f.path ? '#EDE9FE' : 'transparent',
                color: selectedNoteContent?.file === f.path ? T.accentPurple : T.textSecondary,
                fontWeight: selectedNoteContent?.file === f.path ? 600 : 400,
              }}
              onMouseEnter={(e) => { if (selectedNoteContent?.file !== f.path) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
              onMouseLeave={(e) => { if (selectedNoteContent?.file !== f.path) e.currentTarget.style.background = selectedNoteContent?.file === f.path ? '#EDE9FE' : 'transparent'; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ flexShrink: 0, opacity: 0.5 }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NoteTab() {
  const { notes, noteFolders, noteLoading, selectedNoteContent, noteContentLoading, selectedAgent, updateNotesPath, fetchNotes, fetchNoteContent } = useAgentDetailStore();
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [pathSaving, setPathSaving] = useState(false);

  const agentId = selectedAgent?.id || '';
  const notesPath = (selectedAgent as Record<string, unknown>)?.notesPath as string | undefined;

  const handleFolderSelect = async (selectedPath: string) => {
    setShowFolderPicker(false);
    setPathSaving(true);
    try {
      await updateNotesPath(agentId, selectedPath);
      await fetchNotes(agentId);
    } catch {} finally { setPathSaving(false); }
  };

  // 경로 미설정 시 설정 화면
  if (!notesPath) {
    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '260px', gap: '16px', padding: '0 40px' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={T.textTertiary} strokeWidth="1.5" opacity={0.5}>
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <div style={{ fontSize: '13px', fontWeight: 600, color: T.textPrimary }}>노트 경로 설정</div>
          <div style={{ fontSize: '11px', color: T.textTertiary, textAlign: 'center', lineHeight: 1.6 }}>
            이 에이전트의 노트를 저장할 디렉토리를 선택하세요.<br/>
            옵시디언 볼트 경로를 지정하면 동기화됩니다.
          </div>
          <button
            onClick={() => setShowFolderPicker(true)}
            disabled={pathSaving}
            style={{
              padding: '10px 28px', borderRadius: '10px', border: 'none',
              background: T.accentPurple, color: 'white', fontSize: '13px',
              fontWeight: 600, cursor: pathSaving ? 'not-allowed' : 'pointer',
              opacity: pathSaving ? 0.5 : 1,
              display: 'flex', alignItems: 'center', gap: '8px',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            {pathSaving ? '저장 중...' : '폴더 선택'}
          </button>
        </div>
        {showFolderPicker && (
          <FolderPickerPopup onSelect={handleFolderSelect} onClose={() => setShowFolderPicker(false)} />
        )}
      </>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', padding: 0 }}>
      {showFolderPicker && (
        <FolderPickerPopup onSelect={handleFolderSelect} onClose={() => setShowFolderPicker(false)} />
      )}

      {/* Left sidebar — tree */}
      <div style={{
        width: '220px', flexShrink: 0, borderRight: `1px solid ${T.borderLight}`,
        display: 'flex', flexDirection: 'column', background: '#FAFBFC',
        overflowY: 'auto',
      }}>
        {/* Sidebar header */}
        <div style={{
          padding: '10px 12px', borderBottom: `1px solid ${T.borderLight}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: T.textTertiary, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Files
          </span>
          <button
            onClick={() => setShowFolderPicker(true)}
            style={{
              width: '20px', height: '20px', borderRadius: '4px', border: 'none',
              background: 'transparent', cursor: 'pointer', color: T.textTertiary,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px',
            }}
            title="경로 변경"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>

        {/* Tree */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {noteLoading ? (
            <div style={{ padding: '20px', textAlign: 'center', fontSize: '11px', color: T.textTertiary }}>로딩 중...</div>
          ) : (
            <>
              {noteFolders.map(f => (
                <TreeNode key={f.path} agentId={agentId} name={f.name} nodePath={f.path} depth={0} />
              ))}
              {(notes as unknown as Array<{ name: string; path: string }>).map(f => (
                <button
                  key={f.path}
                  onClick={() => fetchNoteContent(agentId, f.path)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '3px 8px 3px 22px',
                    border: 'none', cursor: 'pointer', fontSize: '12px',
                    width: '100%', textAlign: 'left', fontFamily: 'inherit',
                    background: selectedNoteContent?.file === f.path ? '#EDE9FE' : 'transparent',
                    color: selectedNoteContent?.file === f.path ? T.accentPurple : T.textSecondary,
                    fontWeight: selectedNoteContent?.file === f.path ? 600 : 400,
                  }}
                  onMouseEnter={(e) => { if (selectedNoteContent?.file !== f.path) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
                  onMouseLeave={(e) => { if (selectedNoteContent?.file !== f.path) e.currentTarget.style.background = selectedNoteContent?.file === f.path ? '#EDE9FE' : 'transparent'; }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ flexShrink: 0, opacity: 0.5 }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                </button>
              ))}
              {noteFolders.length === 0 && notes.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', fontSize: '11px', color: T.textTertiary }}>빈 폴더</div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right content — note viewer */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {noteContentLoading ? (
          <div style={{ textAlign: 'center', padding: '60px', fontSize: '12px', color: T.textTertiary }}>로딩 중...</div>
        ) : selectedNoteContent ? (
          <div>
            {/* Breadcrumb */}
            <div style={{ fontSize: '11px', color: T.textTertiary, marginBottom: '16px' }}>
              {selectedNoteContent.file.split('/').map((seg, i, arr) => (
                <React.Fragment key={i}>
                  {i > 0 && <span style={{ margin: '0 4px' }}>/</span>}
                  <span style={{ color: i === arr.length - 1 ? T.textPrimary : T.textTertiary, fontWeight: i === arr.length - 1 ? 600 : 400 }}>
                    {seg}
                  </span>
                </React.Fragment>
              ))}
            </div>
            {/* Title */}
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: T.textPrimary, margin: '0 0 8px', lineHeight: 1.3 }}>
              {selectedNoteContent.file.split('/').pop()?.replace(/\.(md|txt)$/, '')}
            </h2>
            {/* Meta */}
            <div style={{ fontSize: '11px', color: T.textTertiary, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {new Date(selectedNoteContent.updatedAt).toLocaleString('ko-KR')}
            </div>
            {/* Content */}
            <div
              className="note-markdown"
              style={{
                fontSize: '14px', color: T.textPrimary, lineHeight: 1.7,
                wordBreak: 'break-word',
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {selectedNoteContent.content}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', color: T.textTertiary,
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity={0.3}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            <span style={{ fontSize: '12px', marginTop: '12px' }}>노트를 선택하세요</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN POPUP
   ═══════════════════════════════════════════════ */
export function AgentDetailPopup() {
  const { selectedAgent, isOpen, isLoading, activeTab, closeAgent, setActiveTab } = useAgentDetailStore();

  // Floating window state (position + size). Set on first open only.
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 640, height: 560 });
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const initializedRef = useRef(false);

  // Initialize position/size when popup opens for the first time
  useEffect(() => {
    if (!isOpen) {
      initializedRef.current = false;
      return;
    }
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Determine initial size by active tab
    let w = 640;
    let h = 560;
    if (activeTab === 'chat') {
      w = 640;
      h = 700;
    } else if (activeTab === 'note') {
      w = 820;
      h = 600;
    }

    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const maxW = Math.max(420, vw - 40);
    const maxH = Math.max(360, vh - 40);
    const width = Math.min(w, maxW);
    const height = Math.min(h, maxH);

    setSize({ width, height });
    setPosition({
      x: Math.max(20, Math.round(vw / 2 - width / 2)),
      y: Math.max(20, Math.round(vh / 2 - height / 2)),
    });
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const maxW = Math.max(420, vw - 40);
  const maxH = Math.max(360, vh - 40);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0, 0, 0, 0.35)',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: '13px', lineHeight: 1.5, color: T.textPrimary,
      }}
      onClick={closeAgent}
    >
      <Rnd
        size={{ width: size.width, height: size.height }}
        position={{ x: position.x, y: position.y }}
        onDragStop={(_e, d) => setPosition({ x: d.x, y: d.y })}
        onResizeStop={(_e, _dir, ref, _delta, pos) => {
          setSize({ width: ref.offsetWidth, height: ref.offsetHeight });
          setPosition({ x: pos.x, y: pos.y });
        }}
        minWidth={420}
        minHeight={360}
        maxWidth={maxW}
        maxHeight={maxH}
        bounds="window"
        dragHandleClassName="popup-drag-handle"
        cancel=".popup-drag-cancel"
        enableResizing={{
          top: true, right: true, bottom: true, left: true,
          topRight: true, bottomRight: true, bottomLeft: true, topLeft: true,
        }}
        style={{ pointerEvents: 'auto', zIndex: 50 }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            height: '100%',
            background: T.bgCard,
            borderRadius: '18px',
            boxShadow: T.shadowPopup,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* ── Header (drag handle) ── */}
          <div
            className="popup-drag-handle"
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '20px 24px 16px', borderBottom: `1px solid ${T.borderLight}`,
              cursor: 'move',
              userSelect: 'none',
            }}
          >
            {selectedAgent ? (
              <>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '16px', color: 'white',
                  background: T.bgDarkCard,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: 600 }}>{selectedAgent.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                    <span style={{
                      fontSize: '10px', fontWeight: 500, padding: '2px 8px', borderRadius: '10px',
                      ...statusBadgeStyle(selectedAgent.status),
                    }}>
                      {statusLabel(selectedAgent.status)}
                    </span>
                    <span style={{ fontSize: '11px', color: T.textTertiary }}>
                      {selectedAgent.role === 'main' ? 'Main' : selectedAgent.name} &middot; {selectedAgent.modelName || 'claude'}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, height: '44px', display: 'flex', alignItems: 'center' }}>
                <div style={{ height: '16px', width: '128px', background: '#F3F4F6', borderRadius: '4px' }} />
              </div>
            )}
            <button
              className="popup-drag-cancel"
              onClick={closeAgent}
              style={{
                width: '32px', height: '32px', borderRadius: '8px',
                border: 'none', background: 'transparent', color: T.textTertiary,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#F3F4F6'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              &times;
            </button>
          </div>

          {/* ── Tabs ── */}
          <div className="popup-drag-cancel" style={{ display: 'flex', borderBottom: `1px solid ${T.borderLight}` }}>
            {getTabsForRole(selectedAgent?.role).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1, padding: '12px', textAlign: 'center',
                  fontSize: '12px', fontWeight: 500,
                  color: activeTab === tab.key ? T.accentPurple : T.textTertiary,
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  position: 'relative', transition: 'color 0.15s',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => { if (activeTab !== tab.key) e.currentTarget.style.color = T.textSecondary; }}
                onMouseLeave={(e) => { if (activeTab !== tab.key) e.currentTarget.style.color = T.textTertiary; }}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <span style={{
                    position: 'absolute', bottom: 0,
                    left: '25%', right: '25%', height: '2px',
                    background: T.accentPurple, borderRadius: '2px',
                  }} />
                )}
              </button>
            ))}
          </div>

          {/* ── Content ── */}
          <div className="popup-drag-cancel" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {isLoading ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
                <div style={{
                  width: '24px', height: '24px', border: '2px solid #E5E7EB',
                  borderTopColor: T.accentPurple, borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} />
              </div>
            ) : (
              <>
                {activeTab === 'info' && <InfoTab />}
                {activeTab === 'cli' && <CLITab />}
                {activeTab === 'chat' && <ChatTab />}
                {activeTab === 'log' && <LogTab />}
                {activeTab === 'note' && <NoteTab />}
              </>
            )}
          </div>
        </div>
      </Rnd>

      {/* CSS keyframes via style tag */}
      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
