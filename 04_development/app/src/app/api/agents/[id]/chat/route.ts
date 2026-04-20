import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { chatMessages, agents } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { wsBroadcast, requestCliExecution } from '@/lib/ws-bridge';
import { loadMainSkill } from '@/lib/skill-loader';
import fs from 'fs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  const { id: agentId } = await params;
  const body = await request.json();
  const { content, attachments } = body as {
    content: string;
    attachments?: { filename: string; path: string; type: string }[];
  };

  if (!content?.trim()) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Content is required' } },
      { status: 400 }
    );
  }

  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
  if (!agent) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Agent not found' } },
      { status: 404 }
    );
  }

  // Build prompt with attachments
  let cliPrompt = content.trim();
  const attachmentNames = (attachments || []).map(a => a.filename);

  if (attachments && attachments.length > 0) {
    const fileDescriptions = attachments.map(a => {
      const isImage = a.type.startsWith('image/');
      if (isImage) {
        return `[Attached image: ${a.filename}] (path: ${a.path})`;
      }
      try {
        const fileContent = fs.readFileSync(a.path, 'utf-8');
        const truncated = fileContent.length > 8000
          ? fileContent.substring(0, 8000) + '\n... (truncated)'
          : fileContent;
        return `[Attached file: ${a.filename}]\n\`\`\`\n${truncated}\n\`\`\``;
      } catch {
        return `[Attached file: ${a.filename}] (path: ${a.path})`;
      }
    });
    cliPrompt = `${content.trim()}\n\n${fileDescriptions.join('\n\n')}`;
  }

  // Save user message
  const userMsgId = uuidv4();
  const displayContent = attachmentNames.length > 0
    ? `${content.trim()}\n\n📎 ${attachmentNames.join(', ')}`
    : content.trim();

  await db.insert(chatMessages).values({
    id: userMsgId,
    sender: 'user',
    content: displayContent,
    messageType: 'text',
    metadata: JSON.stringify({ agentId, attachments: attachmentNames }),
  });

  await wsBroadcast('chat:message', {
    id: userMsgId,
    sender: 'user',
    content: displayContent,
    messageType: 'text',
    agentId,
    createdAt: new Date().toISOString(),
  });

  // Response message ID (pre-generated for the background task)
  const responseMsgId = uuidv4();

  // Build system prompt
  const systemPrompt = agent.role === 'main'
    ? loadMainSkill()
    : `You are ${agent.name}, an AI agent managed by YJ Manager. Respond concisely and helpfully. When the user writes in Korean, respond in Korean.`;

  // Fire-and-forget: forward CLI execution to the WS server process
  requestCliExecution({
    agentId,
    agentName: agent.name,
    modelName: agent.modelName || undefined,
    cliPrompt,
    systemPrompt,
    responseMsgId,
    userId: String(userId),
  });

  // Immediately respond — no blocking
  await wsBroadcast('chat:typing', { agentId, isTyping: true });

  return NextResponse.json({
    data: {
      userMessage: { id: userMsgId, sender: 'user', content: content.trim() },
      status: 'processing',
      responseMsgId,
    },
  });
}
