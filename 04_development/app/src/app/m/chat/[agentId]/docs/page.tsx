'use client';

import React, { Suspense, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAgentStore } from '@/stores/agentStore';
import { useMobileDocsStore } from '@/stores/mobileDocsStore';
import { MarkdownBody } from '@/components/mobile/MarkdownBody';
import { breadcrumbs, docTitle, joinDocPath, parentPath, rootLabelOf } from '@/lib/doc-path';

/**
 * 모바일 문서 화면 `/m/chat/[agentId]/docs` (FEAT-003).
 * `?path=docs/deploy` → 폴더 목록, `?file=docs/a.md` → 문서 보기. 노트 탭(FEAT-002)과 같은 폴더를 읽기 전용으로 본다.
 * `?ref=a.md` → 대화 속 문서 참조(FEAT-004): 하나면 바로 열고, 여러 개면 고르게, 없으면 안내한다.
 * `from=chat`이면 뒤로 가기가 대화로 돌아간다.
 */
export default function MobileDocsPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center text-sm text-[var(--text-tertiary)]">불러오는 중…</div>}>
      <MobileDocs />
    </Suspense>
  );
}

function MobileDocs() {
  const router = useRouter();
  const params = useParams<{ agentId: string }>();
  const search = useSearchParams();
  const agentId = params.agentId;
  const file = search.get('file');
  const path = search.get('path') ?? '';
  const ref = search.get('ref');
  const fromChat = search.get('from') === 'chat';

  const { initialized, isLoading: treeLoading, getAgent, fetchTree } = useAgentStore();
  const { listing, doc, resolved, loading, error, loadFolder, loadFile, resolveRef } = useMobileDocsStore();
  const agent = getAgent(agentId);

  useEffect(() => {
    if (!initialized && !treeLoading) fetchTree();
  }, [initialized, treeLoading, fetchTree]);

  useEffect(() => {
    if (ref) resolveRef(agentId, ref);
    else if (file) loadFile(agentId, file);
    else loadFolder(agentId, path);
  }, [agentId, ref, file, path, loadFile, loadFolder, resolveRef]);

  // 참조 후보가 하나면 바로 그 문서로 (주소를 바꿔 뒤로 가기에 남지 않게)
  const currentResolved = ref && resolved && resolved.agentId === agentId && resolved.ref === ref ? resolved : null;
  useEffect(() => {
    if (currentResolved && currentResolved.matches.length === 1) {
      router.replace(`/m/chat/${agentId}/docs?file=${encodeURIComponent(currentResolved.matches[0])}&from=chat`);
    }
  }, [currentResolved, agentId, router]);

  const base = `/m/chat/${agentId}/docs`;
  const go = (query: string) => router.push(query ? `${base}?${query}` : base);
  const openFolder = (p: string) => go(p ? `path=${encodeURIComponent(p)}` : '');
  const openFile = (f: string) => go(`file=${encodeURIComponent(f)}`);

  function handleBack(): void {
    if (fromChat || ref) router.push(`/m/chat/${agentId}`);
    else if (file) openFolder(parentPath(file));
    else if (path) openFolder(parentPath(path));
    else router.push(`/m/chat/${agentId}`);
  }

  const rootLabel = rootLabelOf(listing?.agentId === agentId ? listing.root?.source : undefined);
  const currentListing = listing && listing.agentId === agentId && listing.path === path ? listing : null;
  const currentDoc = doc && doc.agentId === agentId && doc.file === file ? doc : null;
  const crumbs = breadcrumbs(file ? parentPath(file) : path, rootLabel);

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--primary-50)] bg-[var(--bg-surface)]">
        <button
          type="button"
          onClick={handleBack}
          aria-label="뒤로"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-xl text-[var(--text-secondary)]"
        >
          {'‹'}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
            {file ? docTitle(file) : ref ? docTitle(ref) : '문서'}
          </p>
          <p className="text-xs text-[var(--text-tertiary)] truncate">{agent?.name ?? ''} · 읽기 전용</p>
        </div>
      </header>

      {/* 경로 표시 — 누르면 그 폴더로 */}
      <nav aria-label="경로" className="flex items-center gap-1 px-4 py-2 text-xs text-[var(--text-tertiary)] overflow-x-auto whitespace-nowrap bg-[var(--bg-surface)] border-b border-[var(--primary-50)]">
        {crumbs.map((c, i) => (
          <React.Fragment key={c.path || '/'}>
            {i > 0 && <span aria-hidden="true">/</span>}
            <button
              type="button"
              onClick={() => openFolder(c.path)}
              className={i === crumbs.length - 1 && !file ? 'font-medium text-[var(--text-primary)]' : 'text-[var(--primary-500)]'}
            >
              {c.name}
            </button>
          </React.Fragment>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto">
        {ref ? (
          loading || !currentResolved || currentResolved.matches.length === 1 ? (
            error ? (
              <p className="p-6 text-center text-sm text-[var(--status-error-text)]">{error}</p>
            ) : (
              <p className="p-6 text-center text-sm text-[var(--text-tertiary)]">문서 찾는 중…</p>
            )
          ) : currentResolved.matches.length === 0 ? (
            <div className="p-6 flex flex-col items-center gap-3 text-sm text-[var(--text-tertiary)] text-center">
              <span>
                <span className="font-medium text-[var(--text-primary)]">{ref}</span>
                <br />
                문서를 찾지 못했습니다
              </span>
              <button type="button" onClick={() => openFolder('')} className="text-[var(--primary-500)] font-medium underline">
                전체 문서 보기
              </button>
            </div>
          ) : (
            <>
              <p className="px-4 pt-3 text-xs text-[var(--text-tertiary)]">
                같은 이름의 문서가 {currentResolved.matches.length}개 있습니다
              </p>
              <ul className="m-3 rounded-[var(--radius-lg)] bg-[var(--bg-surface)] border border-[var(--primary-50)] divide-y divide-[var(--primary-50)] overflow-hidden">
                {currentResolved.matches.map((m) => (
                  <li key={m}>
                    <button
                      type="button"
                      onClick={() => router.push(`/m/chat/${agentId}/docs?file=${encodeURIComponent(m)}&from=chat`)}
                      className="w-full min-h-[48px] flex items-center gap-3 px-4 py-3 text-left"
                    >
                      <span aria-hidden="true">📄</span>
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-sm text-[var(--text-primary)]">{docTitle(m)}</span>
                        <span className="block truncate text-xs text-[var(--text-tertiary)]">{m}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )
        ) : loading && !(file ? currentDoc : currentListing) ? (
          <p className="p-6 text-center text-sm text-[var(--text-tertiary)]">불러오는 중…</p>
        ) : error ? (
          <div className="p-6 flex flex-col items-center gap-2 text-sm text-[var(--status-error-text)]">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => (file ? loadFile(agentId, file) : loadFolder(agentId, path))}
              className="text-[var(--primary-500)] font-medium underline"
            >
              다시 시도
            </button>
          </div>
        ) : file ? (
          currentDoc && (
            <article className="px-4 py-4 bg-[var(--bg-surface)] min-h-full">
              <p className="text-xs text-[var(--text-tertiary)] mb-3">
                {new Date(currentDoc.updatedAt).toLocaleString('ko-KR')}
              </p>
              <MarkdownBody
                content={currentDoc.content}
                docHref={(r) => `/m/chat/${agentId}/docs?ref=${encodeURIComponent(joinDocPath(parentPath(currentDoc.file), r))}`}
                className="text-[15px] leading-relaxed [&_td]:min-w-[5rem] [&_th]:min-w-[5rem]"
              />
            </article>
          )
        ) : currentListing ? (
          currentListing.root?.source === 'none' ? (
            <p className="p-6 text-center text-sm text-[var(--text-tertiary)]">
              이 에이전트에는 연결된 문서 폴더가 없습니다
            </p>
          ) : currentListing.folders.length === 0 && currentListing.files.length === 0 ? (
            <p className="p-6 text-center text-sm text-[var(--text-tertiary)]">문서가 없습니다</p>
          ) : (
            <ul className="m-3 rounded-[var(--radius-lg)] bg-[var(--bg-surface)] border border-[var(--primary-50)] divide-y divide-[var(--primary-50)] overflow-hidden">
              {currentListing.folders.map((f) => (
                <li key={f.path}>
                  <button
                    type="button"
                    onClick={() => openFolder(f.path)}
                    className="w-full min-h-[48px] flex items-center gap-3 px-4 py-3 text-left"
                  >
                    <span aria-hidden="true">📁</span>
                    <span className="flex-1 min-w-0 truncate text-sm text-[var(--text-primary)]">{f.name}</span>
                    <span aria-hidden="true" className="text-[var(--text-tertiary)]">›</span>
                  </button>
                </li>
              ))}
              {currentListing.files.map((f) => (
                <li key={f.path}>
                  <button
                    type="button"
                    onClick={() => openFile(f.path)}
                    className="w-full min-h-[48px] flex items-center gap-3 px-4 py-3 text-left"
                  >
                    <span aria-hidden="true">📄</span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-sm text-[var(--text-primary)]">{f.name}</span>
                      <span className="block text-xs text-[var(--text-tertiary)]">
                        {new Date(f.updatedAt).toLocaleDateString('ko-KR')}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>
    </div>
  );
}
