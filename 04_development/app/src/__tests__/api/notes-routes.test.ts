/**
 * 노트 API 단위 테스트 — FEAT-002 (D-26)
 * 노트 경로가 없으면 작업 폴더를 읽기 전용으로 보여 주고, 쓰기·삭제는 403으로 막는다.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { generateToken } from '@/lib/auth';

const h = vi.hoisted(() => ({ rows: [] as unknown[] }));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => {
      const chain: Record<string, unknown> = {};
      for (const m of ['from', 'where', 'limit']) chain[m] = vi.fn(() => chain);
      chain.then = (resolve: (v: unknown) => void) => Promise.resolve(h.rows).then(resolve);
      return chain;
    }),
  },
}));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-'));
fs.mkdirSync(path.join(tmp, 'docs'));
fs.mkdirSync(path.join(tmp, 'node_modules'));
fs.mkdirSync(path.join(tmp, '.git'));
fs.writeFileSync(path.join(tmp, 'README.md'), '# 안녕');
fs.writeFileSync(path.join(tmp, 'docs', 'plan.md'), '# 계획');
fs.writeFileSync(path.join(tmp, 'app.ts'), 'x');

afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const auth = () => ({ Authorization: `Bearer ${generateToken(1)}` });
const params = { params: Promise.resolve({ id: 'a1' }) };
const req = (url: string, init?: RequestInit) =>
  new NextRequest(`http://localhost/api/agents/a1/notes${url}`, { ...init, headers: { ...auth(), ...(init?.headers || {}) } });

beforeEach(() => {
  h.rows = [];
});

describe('GET /api/agents/[id]/notes', () => {
  it('노트 경로가 없으면 작업 폴더를 보여 주고, 숨김·node_modules·문서 아닌 파일은 뺀다', async () => {
    h.rows = [{ id: 'a1', role: 'sub', notesPath: null, projectRoot: tmp }];
    const { GET } = await import('@/app/api/agents/[id]/notes/route');
    const res = await GET(req(''), params);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.folders.map((f: { name: string }) => f.name)).toEqual(['docs']);
    expect(body.data.files.map((f: { name: string }) => f.name)).toEqual(['README.md']);
    expect(body.data.root).toEqual({ source: 'project', path: tmp, readOnly: true });
  });

  it('작업 폴더 안 문서 내용을 읽는다', async () => {
    h.rows = [{ id: 'a1', role: 'sub', notesPath: null, projectRoot: tmp }];
    const { GET } = await import('@/app/api/agents/[id]/notes/route');
    const res = await GET(req('?file=docs/plan.md'), params);
    expect((await res.json()).data.content).toBe('# 계획');
  });

  it('작업 폴더 밖 경로는 400', async () => {
    h.rows = [{ id: 'a1', role: 'sub', notesPath: null, projectRoot: tmp }];
    const { GET } = await import('@/app/api/agents/[id]/notes/route');
    expect((await GET(req('?file=../../etc/passwd'), params)).status).toBe(400);
  });

  it('보여 줄 폴더가 없으면 빈 목록 + source none', async () => {
    h.rows = [{ id: 'a1', role: 'sub', notesPath: null, projectRoot: null }];
    const { GET } = await import('@/app/api/agents/[id]/notes/route');
    const body = await (await GET(req(''), params)).json();
    expect(body.data.root.source).toBe('none');
    expect(body.data.files).toEqual([]);
  });
});

describe('작업 폴더는 읽기 전용', () => {
  it('POST(쓰기)는 403', async () => {
    h.rows = [{ id: 'a1', role: 'sub', notesPath: null, projectRoot: tmp }];
    const { POST } = await import('@/app/api/agents/[id]/notes/route');
    const res = await POST(req('', { method: 'POST', body: JSON.stringify({ file: 'x.md', content: 'y' }) }), params);
    expect(res.status).toBe(403);
    expect(fs.existsSync(path.join(tmp, 'x.md'))).toBe(false);
  });

  it('DELETE(삭제)는 403이고 파일이 남는다', async () => {
    h.rows = [{ id: 'a1', role: 'sub', notesPath: null, projectRoot: tmp }];
    const { DELETE } = await import('@/app/api/agents/[id]/notes/route');
    const res = await DELETE(req('?file=README.md', { method: 'DELETE' }), params);
    expect(res.status).toBe(403);
    expect(fs.existsSync(path.join(tmp, 'README.md'))).toBe(true);
  });

  it('지정한 노트 경로는 기존처럼 쓰기 가능', async () => {
    h.rows = [{ id: 'a1', role: 'sub', notesPath: tmp, projectRoot: null }];
    const { POST } = await import('@/app/api/agents/[id]/notes/route');
    const res = await POST(req('', { method: 'POST', body: JSON.stringify({ file: 'note.md', content: 'hi' }) }), params);
    expect(res.status).toBe(200);
    expect(fs.readFileSync(path.join(tmp, 'note.md'), 'utf8')).toBe('hi');
  });
});
