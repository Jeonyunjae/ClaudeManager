/**
 * mobileDocsStore 단위 테스트 — FEAT-003 (노트 API 읽기만)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
vi.mock('@/lib/api', () => ({ default: { get: mockGet } }));

describe('mobileDocsStore', () => {
  beforeEach(() => {
    vi.resetModules();
    mockGet.mockReset();
  });

  it('loadFolder: 최상위는 subpath 없이 조회하고 agentId·path를 함께 기억한다', async () => {
    mockGet.mockResolvedValue({ data: { folders: [{ name: 'docs', path: 'docs' }], files: [], current: '', root: { source: 'project', path: '/p', readOnly: true } } });
    const { useMobileDocsStore } = await import('@/stores/mobileDocsStore');

    await useMobileDocsStore.getState().loadFolder('a1', '');

    expect(mockGet).toHaveBeenCalledWith('/api/agents/a1/notes');
    const s = useMobileDocsStore.getState();
    expect(s.listing?.agentId).toBe('a1');
    expect(s.listing?.path).toBe('');
    expect(s.listing?.folders[0].name).toBe('docs');
    expect(s.loading).toBe(false);
  });

  it('loadFolder: 하위 폴더는 subpath를 인코딩해 조회한다', async () => {
    mockGet.mockResolvedValue({ data: { folders: [], files: [], current: 'docs/배포' } });
    const { useMobileDocsStore } = await import('@/stores/mobileDocsStore');
    await useMobileDocsStore.getState().loadFolder('a1', 'docs/배포');
    expect(mockGet).toHaveBeenCalledWith(`/api/agents/a1/notes?subpath=${encodeURIComponent('docs/배포')}`);
  });

  it('loadFile: 문서 내용을 불러온다', async () => {
    mockGet.mockResolvedValue({ data: { file: 'docs/a.md', content: '# A', updatedAt: '2026-10-07T00:00:00.000Z' } });
    const { useMobileDocsStore } = await import('@/stores/mobileDocsStore');
    await useMobileDocsStore.getState().loadFile('a1', 'docs/a.md');
    expect(mockGet).toHaveBeenCalledWith(`/api/agents/a1/notes?file=${encodeURIComponent('docs/a.md')}`);
    expect(useMobileDocsStore.getState().doc).toMatchObject({ agentId: 'a1', file: 'docs/a.md', content: '# A' });
  });

  it('실패하면 error를 남기고 loading을 푼다', async () => {
    mockGet.mockRejectedValue(new Error('500'));
    const { useMobileDocsStore } = await import('@/stores/mobileDocsStore');
    await useMobileDocsStore.getState().loadFile('a1', 'x.md');
    expect(useMobileDocsStore.getState().error).toBe('문서를 열지 못했습니다');
    expect(useMobileDocsStore.getState().loading).toBe(false);
  });
});
