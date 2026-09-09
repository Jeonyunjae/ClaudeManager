'use client';

/**
 * Skills — 스킬 카탈로그 (최상위 탭)
 *
 * 진실 소스는 git 스킬 저장소이고, 이 화면은 DB 캐시를 읽는다.
 * 스킬을 만들고 고치는 일은 Main과의 대화에서 이뤄진다.
 * 여기서는 확인 · 카테고리 필터 · 비활성 · 삭제 · 저장소 동기화만 한다.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

const c = {
  card: 'var(--bg-card)',
  content: 'var(--bg-content-card)',
  text: 'var(--text-primary)',
  sub: 'var(--text-secondary)',
  tri: 'var(--text-tertiary)',
  border: 'var(--border-light)',
  purple: 'var(--accent-purple)',
  error: 'var(--status-error)',
  pending: 'var(--status-pending)',
  shadow: 'var(--shadow-card)',
};

type UsedBy = { name: string; version?: string; stale?: boolean };

type Skill = {
  id: number;
  name: string;
  displayName: string;
  description: string | null;
  version: string | null;
  category: string | null;
  topics: string[];
  status: 'active' | 'archived';
  isPrivate: boolean;
  defaultBranch: string | null;
  filePath: string;
  repoUrl: string | null;
  repoPushedAt: string | null;
  syncedAt: string | null;
  createdAt: string;
  updatedAt: string;
  usedBy: UsedBy[];
};

type SkillDetail = Skill & { body: string | null };

type Meta = {
  accountUrl: string | null;
  owner: string | null;
  configured: boolean;
  authenticated: boolean;
  categories: string[];
  total: number;
  lastSyncedAt: string | null;
};

function relTime(iso: string | null): string {
  if (!iso) return '없음';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '없음';
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [category, setCategory] = useState('전체');
  const [showArchived, setShowArchived] = useState(false);
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<Skill[]>('/api/skills');
      setSkills(res.data);
      setMeta((res as unknown as { meta?: Meta }).meta ?? null);
    } catch (e) {
      setNotice({ kind: 'err', text: e instanceof Error ? e.message : '목록을 불러오지 못했습니다.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sync = async () => {
    setSyncing(true);
    setNotice(null);
    try {
      const res = await apiClient.post<{
        ok: boolean; inserted: number; updated: number; removed: number; message?: string;
      }>('/api/skills/sync', {});
      const r = res.data;
      setNotice(
        r.ok
          ? { kind: 'ok', text: `동기화 완료 — 추가 ${r.inserted} · 갱신 ${r.updated} · 제거 ${r.removed}` }
          : { kind: 'err', text: r.message || '동기화하지 못했습니다.' }
      );
      await load();
    } catch (e) {
      setNotice({ kind: 'err', text: e instanceof Error ? e.message : '동기화하지 못했습니다.' });
    } finally {
      setSyncing(false);
    }
  };

  const openDetail = async (name: string) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await apiClient.get<SkillDetail>(`/api/skills/${name}`);
      setDetail(res.data);
    } catch (e) {
      setNotice({ kind: 'err', text: e instanceof Error ? e.message : '상세를 불러오지 못했습니다.' });
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleArchive = async (s: Skill) => {
    const next = s.status === 'archived' ? 'active' : 'archived';
    try {
      await apiClient.patch(`/api/skills/${s.name}`, { status: next });
      setNotice({ kind: 'ok', text: next === 'archived' ? '비활성 처리했습니다.' : '다시 활성화했습니다.' });
      setDetail(null);
      load();
    } catch (e) {
      setNotice({ kind: 'err', text: e instanceof Error ? e.message : '변경하지 못했습니다.' });
    }
  };

  const remove = async (s: Skill) => {
    if (s.usedBy.length > 0) return;
    if (!confirm(`"${s.displayName}" 을(를) 목록에서 제거할까요?\n\nGitHub 저장소는 그대로 남습니다.\n다시 동기화하면 목록에 나타납니다.`)) return;
    try {
      await apiClient.del(`/api/skills/${s.name}`);
      setNotice({ kind: 'ok', text: '목록에서 제거했습니다. GitHub 저장소는 그대로입니다.' });
      setDetail(null);
      load();
    } catch (e) {
      setNotice({ kind: 'err', text: e instanceof Error ? e.message : '삭제하지 못했습니다.' });
    }
  };

  const categories = ['전체', ...(meta?.categories ?? [])];
  const visible = skills
    .filter((s) => (showArchived ? true : s.status === 'active'))
    .filter((s) => (category === '전체' ? true : s.topics.includes(category)));

  return (
    // Content Card — Dashboard/Resources/Settings 와 동일한 래퍼
    <div
      style={{
        background: 'var(--bg-content-card)',
        borderRadius: 20,
        margin: '16px 20px',
        padding: '20px 24px',
        minHeight: 'calc(100vh - 56px - 68px)',
      }}
    >
      {/* ---------- 헤더 ---------- */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: c.text, margin: 0 }}>Skills</h1>
          <div style={{ fontSize: 12, color: c.tri, marginTop: 4 }}>
            {meta?.total ?? 0}개 · 스킬 생성·수정은 Main과의 대화에서 이뤄집니다
          </div>
          <div style={{ fontSize: 11, color: c.tri, marginTop: 4, display: 'flex', gap: 10, alignItems: 'center' }}>
            {meta?.accountUrl ? (
              <a href={meta.accountUrl} target="_blank" rel="noreferrer"
                 style={{ color: c.purple, textDecoration: 'none' }}>
                {meta.accountUrl.replace(/^https?:\/\//, '')} ↗
              </a>
            ) : (
              <span>계정 미설정</span>
            )}
            <span>{meta?.authenticated ? '토큰 등록됨' : '토큰 없음 (public만 조회)'}</span>
            <span>마지막 동기화: {relTime(meta?.lastSyncedAt ?? null)}</span>
          </div>
        </div>

        <button
          onClick={sync}
          disabled={syncing}
          style={{
            padding: '8px 16px', borderRadius: 10, fontSize: 13, fontFamily: 'inherit',
            border: 'none', background: c.text, color: '#fff',
            cursor: syncing ? 'wait' : 'pointer', opacity: syncing ? 0.6 : 1,
          }}
        >
          {syncing ? '동기화 중…' : '동기화'}
        </button>
      </div>

      {notice && (
        <div
          onClick={() => setNotice(null)}
          style={{
            marginBottom: 12, padding: '9px 13px', borderRadius: 9, fontSize: 12, cursor: 'pointer',
            background: notice.kind === 'ok' ? 'var(--status-complete-bg)' : 'var(--status-error-bg)',
            color: notice.kind === 'ok' ? 'var(--status-complete-text)' : 'var(--status-error-text)',
          }}
        >
          {notice.text}
        </div>
      )}

      {/* ---------- 필터 ---------- */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {categories.map((cat) => (
          <button key={cat} onClick={() => setCategory(cat)}
            style={{
              padding: '5px 13px', borderRadius: 16, border: 'none', cursor: 'pointer',
              fontSize: 12, fontFamily: 'inherit',
              background: category === cat ? c.text : 'transparent',
              color: category === cat ? '#fff' : c.sub,
            }}>
            {cat}
            {cat !== '전체' && (
              <span style={{ marginLeft: 6, opacity: 0.65 }}>
                {skills.filter((s) => s.topics.includes(cat) && (showArchived || s.status === 'active')).length}
              </span>
            )}
          </button>
        ))}
        <label style={{ marginLeft: 'auto', fontSize: 12, color: c.sub, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          비활성 포함
        </label>
      </div>

      {/* ---------- 목록 ---------- */}
      {loading && <div style={{ padding: 40, textAlign: 'center', color: c.tri, fontSize: 13 }}>불러오는 중…</div>}

      {!loading && meta && !meta.configured && (
        <div style={{ padding: 48, textAlign: 'center', background: c.card, borderRadius: 14, boxShadow: c.shadow }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: c.text, marginBottom: 8 }}>스킬 계정이 설정되지 않았습니다</div>
          <div style={{ fontSize: 13, color: c.sub, lineHeight: 1.8 }}>
            Settings &gt; Global Settings &gt; Skills Account 에 GitHub 계정 주소를 등록하세요.<br />
            예: <code style={{ fontSize: 12 }}>https://github.com/Jeonyunjae-Skills</code>
          </div>
        </div>
      )}

      {!loading && meta?.configured && visible.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: c.tri, fontSize: 13 }}>
          표시할 스킬이 없습니다. [동기화]를 눌러 계정의 저장소를 불러오세요.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map((s) => {
          const archived = s.status === 'archived';
          return (
            <div key={s.name}
              onClick={() => openDetail(s.name)}
              style={{
                background: c.card, borderRadius: 12, boxShadow: c.shadow, padding: 16,
                cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'flex-start',
                opacity: archived ? 0.55 : 1,
              }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{s.displayName}</span>
                  {s.version && (
                    <span style={{ fontSize: 11, color: c.tri }}>{s.version}</span>
                  )}
                  {s.category && (
                    <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 10, background: c.content, color: c.sub }}>
                      {s.category}
                    </span>
                  )}
                  {s.isPrivate && <span style={{ fontSize: 11, color: c.tri }}>private</span>}
                  {archived && <span style={{ fontSize: 11, color: c.tri }}>비활성</span>}
                </div>

                <div style={{ fontSize: 12, color: c.sub, marginBottom: 6 }}>
                  {s.description || <span style={{ color: c.tri }}>설명 없음</span>}
                </div>

                <div style={{ fontSize: 11, color: c.tri }}>
                  {s.usedBy.length > 0 ? (
                    <>사용 중: {s.usedBy.map((u, i) => (
                      <span key={u.name}>
                        {i > 0 && ', '}{u.name}
                        {u.version && <span style={{ color: u.stale ? c.pending : c.tri }}>
                          {' '}(v{u.version}{u.stale ? ' · 구버전' : ''})
                        </span>}
                      </span>
                    ))}</>
                  ) : '사용 중인 프로젝트 없음'}
                  <span style={{ marginLeft: 10 }}>수정 {relTime(s.updatedAt)}</span>
                </div>
              </div>

              {s.repoUrl && (
                <a href={s.repoUrl} target="_blank" rel="noreferrer"
                   onClick={(e) => e.stopPropagation()}
                   style={{ fontSize: 12, color: c.purple, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                  저장소 ↗
                </a>
              )}
            </div>
          );
        })}
      </div>

      {/* ---------- 상세 팝업 ---------- */}
      {(detail || detailLoading) && (
        <div
          onClick={() => { setDetail(null); setDetailLoading(false); }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: c.card, borderRadius: 16, width: 'min(780px, 100%)',
              maxHeight: '85vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
            }}
          >
            {detailLoading && <div style={{ padding: 48, textAlign: 'center', color: c.tri, fontSize: 13 }}>불러오는 중…</div>}

            {detail && (
              <>
                {/* 팝업 헤더 */}
                <div style={{ padding: '18px 22px', borderBottom: `1px solid ${c.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 17, fontWeight: 700, color: c.text }}>{detail.displayName}</span>
                        {detail.version && <span style={{ fontSize: 12, color: c.tri }}>{detail.version}</span>}
                        {detail.category && (
                          <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 10, background: c.content, color: c.sub }}>
                            {detail.category}
                          </span>
                        )}
                        {detail.isPrivate && <span style={{ fontSize: 11, color: c.tri }}>private</span>}
                      </div>
                      <div style={{ fontSize: 12, color: c.sub, marginTop: 5 }}>
                        {detail.description || '설명 없음'}
                      </div>
                    </div>
                    <button onClick={() => setDetail(null)}
                      style={{ background: 'transparent', border: 'none', fontSize: 20, color: c.tri, cursor: 'pointer', lineHeight: 1 }}>
                      ×
                    </button>
                  </div>
                </div>

                {/* 팝업 본문 */}
                <div style={{ padding: 22, overflowY: 'auto', flex: 1 }}>
                  {/* 메타 */}
                  <dl style={{ display: 'grid', gridTemplateColumns: '110px 1fr', rowGap: 7, columnGap: 12, fontSize: 12, margin: 0, marginBottom: 20 }}>
                    <dt style={{ color: c.tri }}>스킬명</dt><dd style={{ margin: 0, color: c.text }}><code>{detail.name}</code></dd>
                    <dt style={{ color: c.tri }}>저장소</dt><dd style={{ margin: 0, color: c.text }}><code>{detail.filePath}</code></dd>
                    {detail.repoUrl && (
                      <>
                        <dt style={{ color: c.tri }}>저장소</dt>
                        <dd style={{ margin: 0 }}>
                          <a href={detail.repoUrl} target="_blank" rel="noreferrer" style={{ color: c.purple, textDecoration: 'none' }}>
                            {detail.repoUrl.replace(/^https?:\/\//, '')} ↗
                          </a>
                        </dd>
                      </>
                    )}
                    {detail.topics.length > 0 && (
                      <><dt style={{ color: c.tri }}>Topics</dt><dd style={{ margin: 0, color: c.text }}>{detail.topics.join(', ')}</dd></>
                    )}
                    {detail.repoPushedAt && (
                      <><dt style={{ color: c.tri }}>마지막 푸시</dt><dd style={{ margin: 0, color: c.text }}>{detail.repoPushedAt.slice(0, 10)}</dd></>
                    )}
                    <dt style={{ color: c.tri }}>생성 / 수정</dt>
                    <dd style={{ margin: 0, color: c.text }}>
                      {detail.createdAt?.slice(0, 10)} / {detail.updatedAt?.slice(0, 10)}
                    </dd>
                    <dt style={{ color: c.tri }}>사용 중</dt>
                    <dd style={{ margin: 0, color: c.text }}>
                      {detail.usedBy.length > 0 ? detail.usedBy.join(', ') : '없음'}
                    </dd>
                  </dl>

                                    {!detail.body && (
                    <div style={{ fontSize: 12, color: c.tri }}>
                      SKILL.md를 읽지 못했습니다. 저장소에 파일이 없거나 접근 권한이 필요합니다.
                    </div>
                  )}

                  {detail.body && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: c.sub, marginBottom: 6 }}>SKILL.md</div>
                      <pre style={{
                        margin: 0, padding: 12, background: c.content, borderRadius: 8,
                        fontSize: 12, lineHeight: 1.75, color: c.text,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>{detail.body}</pre>
                    </div>
                  )}
                </div>

                {/* 팝업 액션 */}
                <div style={{ padding: '14px 22px', borderTop: `1px solid ${c.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => toggleArchive(detail)}
                    style={{
                      padding: '7px 14px', borderRadius: 9, fontSize: 12, fontFamily: 'inherit',
                      border: `1px solid ${c.border}`, background: 'transparent', color: c.sub, cursor: 'pointer',
                    }}>
                    {detail.status === 'archived' ? '다시 활성화' : '비활성'}
                  </button>
                  <button
                    onClick={() => remove(detail)}
                    disabled={detail.usedBy.length > 0}
                    title={detail.usedBy.length > 0 ? '사용 중인 프로젝트가 있어 삭제할 수 없습니다' : undefined}
                    style={{
                      padding: '7px 14px', borderRadius: 9, fontSize: 12, fontFamily: 'inherit',
                      border: `1px solid ${detail.usedBy.length > 0 ? c.border : c.error}`,
                      background: 'transparent',
                      color: detail.usedBy.length > 0 ? c.tri : c.error,
                      cursor: detail.usedBy.length > 0 ? 'not-allowed' : 'pointer',
                    }}>
                    삭제
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
