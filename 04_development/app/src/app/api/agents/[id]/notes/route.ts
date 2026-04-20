import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { agents } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function getAgent(agentId: string) {
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
  return agent;
}

function authCheck(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    );
  }
  return null;
}

/**
 * GET /api/agents/[id]/notes
 *
 * ?subpath=folder/path   — list folders & files at subpath (default: root)
 * ?file=path/to/file.md  — get single file content
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = authCheck(request);
  if (authErr) return authErr;

  const { id: agentId } = await params;
  const agent = await getAgent(agentId);
  if (!agent) {
    return NextResponse.json(
      { error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found' } },
      { status: 404 }
    );
  }

  if (!agent.notesPath) {
    return NextResponse.json({ data: { folders: [], files: [], current: '' } });
  }

  const { searchParams } = new URL(request.url);
  const fileParam = searchParams.get('file');

  // Single file content
  if (fileParam) {
    const normalized = path.normalize(fileParam);
    if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
      return NextResponse.json(
        { error: { code: 'INVALID_PATH', message: 'Invalid path' } },
        { status: 400 }
      );
    }
    const fullPath = path.join(agent.notesPath, normalized);
    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'File not found' } },
        { status: 404 }
      );
    }
    const content = fs.readFileSync(fullPath, 'utf-8');
    const stat = fs.statSync(fullPath);
    return NextResponse.json({
      data: { file: normalized, content, updatedAt: stat.mtime.toISOString() },
    });
  }

  // Folder listing (no file content)
  const subpath = searchParams.get('subpath') || '';
  const normalized = path.normalize(subpath || '.');
  if (normalized.startsWith('..')) {
    return NextResponse.json(
      { error: { code: 'INVALID_PATH', message: 'Invalid path' } },
      { status: 400 }
    );
  }

  const targetDir = subpath
    ? path.join(agent.notesPath, normalized)
    : agent.notesPath;

  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    return NextResponse.json({ data: { folders: [], files: [], current: subpath } });
  }

  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  const folders: Array<{ name: string; path: string }> = [];
  const files: Array<{ name: string; path: string; updatedAt: string }> = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const relativePath = subpath ? `${subpath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      folders.push({ name: entry.name, path: relativePath });
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.txt')) {
      const stat = fs.statSync(path.join(targetDir, entry.name));
      files.push({ name: entry.name, path: relativePath, updatedAt: stat.mtime.toISOString() });
    }
  }

  folders.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ data: { folders, files, current: subpath || '' } });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = authCheck(request);
  if (authErr) return authErr;

  const { id: agentId } = await params;
  const agent = await getAgent(agentId);
  if (!agent || !agent.notesPath) {
    return NextResponse.json(
      { error: { code: 'AGENT_NOT_FOUND', message: 'Agent or notes path not found' } },
      { status: 404 }
    );
  }

  const body = await request.json();
  const { file, content } = body as { file: string; content: string };

  if (!file || typeof content !== 'string') {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', message: 'file and content are required' } },
      { status: 400 }
    );
  }

  const normalized = path.normalize(file);
  if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
    return NextResponse.json(
      { error: { code: 'INVALID_PATH', message: 'Invalid file path' } },
      { status: 400 }
    );
  }

  const fullPath = path.join(agent.notesPath, normalized);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(fullPath, content, 'utf-8');
  const stat = fs.statSync(fullPath);

  return NextResponse.json({
    data: { file: normalized, content, updatedAt: stat.mtime.toISOString() },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = authCheck(request);
  if (authErr) return authErr;

  const { id: agentId } = await params;
  const agent = await getAgent(agentId);
  if (!agent || !agent.notesPath) {
    return NextResponse.json(
      { error: { code: 'AGENT_NOT_FOUND', message: 'Agent or notes path not found' } },
      { status: 404 }
    );
  }

  const file = new URL(request.url).searchParams.get('file');
  if (!file) {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', message: 'file parameter is required' } },
      { status: 400 }
    );
  }

  const normalized = path.normalize(file);
  if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
    return NextResponse.json(
      { error: { code: 'INVALID_PATH', message: 'Invalid file path' } },
      { status: 400 }
    );
  }

  const fullPath = path.join(agent.notesPath, normalized);
  if (!fs.existsSync(fullPath)) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'File not found' } },
      { status: 404 }
    );
  }

  fs.unlinkSync(fullPath);
  return NextResponse.json({ data: { deleted: true, file: normalized } });
}
