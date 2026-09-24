/**
 * CLI Executor — runs Claude CLI in the WS server process.
 *
 * Moved from chat/route.ts so that CLI execution happens in the WS server
 * process (port 3001) rather than in the Next.js process, avoiding UI lag.
 */

import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import db from '../lib/db';
import { chatMessages, agents, parts, costRecords, auditLogs } from '../lib/schema';
import { agentManager } from '../lib/agent-manager';
import { loadMainSkill, parseActions } from '../lib/skill-loader';
import { createNotification } from '../lib/notify';
import { broadcast } from './ws-server';

function ts() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export interface CliExecutionRequest {
  agentId: string;
  agentName: string;
  modelName?: string;
  cliPrompt: string;
  systemPrompt: string;
  responseMsgId: string;
  userId: string;
  /** 사용자 메시지 id — 대기 중 취소 시 이 id로 지목한다. */
  userMsgId?: string;
}

/**
 * 도구 입력에서 한 줄로 보여줄 대상만 뽑는다.
 * Read/Write → 파일 경로, Bash → 명령어, Grep → 패턴 …
 */
function summarizeToolInput(input: unknown): string | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const o = input as Record<string, unknown>;
  const pick = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : undefined);
  const v =
    pick('file_path') ??
    pick('path') ??
    pick('command') ??
    pick('pattern') ??
    pick('query') ??
    pick('url') ??
    pick('description') ??
    pick('prompt');
  if (!v) return undefined;
  const oneLine = v.replace(/\s+/g, ' ').trim();
  return oneLine.length > 90 ? oneLine.slice(0, 90) + '…' : oneLine;
}

/* ------------------------------------------------------------------ */
/*  에이전트별 질문 대기열                                              */
/*                                                                     */
/*  에이전트 하나에 CLI 프로세스 하나만 붙을 수 있다. 같은 세션 id로     */
/*  두 프로세스를 띄우면 대화 이력이 서로를 덮어써 세션이 깨진다.        */
/*  그래서 답변 중에 들어온 질문은 여기 쌓아두고 순서대로 처리한다.      */
/*  (클라이언트가 아니라 서버에 두는 이유: 새로고침·다중 탭에도 유지)    */
/* ------------------------------------------------------------------ */

const queues = new Map<string, CliExecutionRequest[]>();
const running = new Set<string>();
/** 대기 중 취소된 사용자 메시지 id */
const cancelled = new Set<string>();

export function getQueueDepth(agentId: string): number {
  return queues.get(agentId)?.length ?? 0;
}

export function isAgentRunning(agentId: string): boolean {
  return running.has(agentId);
}

/** 대기 중인 질문 취소. 메시지는 남기고 "취소됨"으로 표시한다. */
export async function cancelQueued(agentId: string, userMsgId: string): Promise<boolean> {
  const q = queues.get(agentId);
  if (!q) return false;
  const idx = q.findIndex((r) => r.userMsgId === userMsgId);
  if (idx === -1) return false;

  q.splice(idx, 1);
  cancelled.add(userMsgId);

  try {
    await db
      .update(chatMessages)
      .set({ metadata: JSON.stringify({ agentId, queued: false, cancelled: true }) })
      .where(eq(chatMessages.id, userMsgId));
  } catch {
    /* 표시 실패해도 큐에서는 빠진다 */
  }

  broadcast('chat:queue', {
    agentId,
    depth: q.length,
    cancelledMsgId: userMsgId,
  });
  return true;
}

/**
 * 채팅 처리 진입점. 이미 실행 중이면 대기열에 넣고 즉시 돌아온다.
 */
export async function enqueueChat(req: CliExecutionRequest): Promise<void> {
  const { agentId } = req;

  if (running.has(agentId)) {
    const q = queues.get(agentId) ?? [];
    q.push(req);
    queues.set(agentId, q);
    console.log(`[${ts()}] [CLI] ⏸ ${req.agentName} 대기열에 추가 (대기 ${q.length}건)`);
    broadcast('chat:queue', { agentId, depth: q.length, queuedMsgId: req.userMsgId });
    return;
  }

  running.add(agentId);
  try {
    await processChatInBackground(req);
  } finally {
    running.delete(agentId);
    void drain(agentId);
  }
}

/** 대기열에서 다음 질문을 꺼내 처리한다. 취소된 건은 건너뛴다. */
async function drain(agentId: string): Promise<void> {
  const q = queues.get(agentId);
  if (!q || q.length === 0) return;

  let next: CliExecutionRequest | undefined;
  while (q.length > 0) {
    const candidate = q.shift()!;
    if (candidate.userMsgId && cancelled.has(candidate.userMsgId)) {
      cancelled.delete(candidate.userMsgId);
      continue;
    }
    next = candidate;
    break;
  }

  broadcast('chat:queue', { agentId, depth: q.length });
  if (!next) return;

  // 대기 표시 해제
  if (next.userMsgId) {
    try {
      await db
        .update(chatMessages)
        .set({ metadata: JSON.stringify({ agentId, queued: false }) })
        .where(eq(chatMessages.id, next.userMsgId));
    } catch {
      /* noop */
    }
  }

  running.add(agentId);
  try {
    await processChatInBackground(next);
  } finally {
    running.delete(agentId);
    void drain(agentId);
  }
}

/**
 * Background CLI processing — runs after the HTTP response is sent.
 * Uses broadcast() directly since we're in the same WS server process.
 */
export async function processChatInBackground(req: CliExecutionRequest): Promise<void> {
  const { agentId, agentName, modelName, cliPrompt, systemPrompt, responseMsgId, userId } = req;
  console.log(`[${ts()}] [CLI] ▶ ${agentName}(${agentId}) — prompt(${cliPrompt.length} chars):\n${cliPrompt}\n--- END PROMPT ---`);

  // Broadcast active status
  broadcast('agent:status', { agentId, status: 'active', statusMessage: cliPrompt.length > 60 ? cliPrompt.substring(0, 60) + '…' : cliPrompt });
  try {
    await db.update(agents).set({ status: 'active', statusMessage: cliPrompt.length > 60 ? cliPrompt.substring(0, 60) + '…' : cliPrompt }).where(eq(agents.id, agentId));
  } catch {}

  try {
    let streamedText = '';
    // 에이전트가 실행한 도구들. 응답 메시지의 metadata에 함께 저장해
    // 새로고침 후에도 "무엇을 했는지"가 남게 한다.
    const toolsUsed: { name: string; target?: string }[] = [];

    const cliResponse = await agentManager.sendMessage(
      agentId,
      cliPrompt,
      systemPrompt,
      modelName,
      (chunk: string) => {
        streamedText += chunk;
        broadcast('chat:stream', { agentId, responseMsgId, content: streamedText });
      },
      (tool) => {
        const entry = { name: tool.name || 'tool', target: summarizeToolInput(tool.input) };
        toolsUsed.push(entry);
        broadcast('chat:tool', { agentId, responseMsgId, ...entry });
      },
    );

    // Parse actions from response
    const { actions, cleanText } = parseActions(cliResponse.text);
    const actionResults = await executeActions(actions, agentId, userId);
    let responseText = cleanText;
    if (actionResults.length > 0) {
      responseText += '\n\n' + actionResults.join('\n');
    }

    // Save cost record
    if (cliResponse.costUsd > 0 || cliResponse.inputTokens > 0) {
      await db.insert(costRecords).values({
        agentId,
        modelName: cliResponse.modelName,
        inputTokens: cliResponse.inputTokens,
        outputTokens: cliResponse.outputTokens,
        cost: cliResponse.costUsd,
      });
    }

    // Save agent response (실행한 도구 목록을 함께 남긴다)
    await db.insert(chatMessages).values({
      id: responseMsgId,
      sender: agentName,
      content: responseText,
      messageType: 'text',
      metadata: JSON.stringify({ agentId, tools: toolsUsed }),
    });

    console.log(`[${ts()}] [CLI] ✔ ${agentName} — ${cliResponse.durationMs}ms, $${cliResponse.costUsd.toFixed(4)}, in:${cliResponse.inputTokens} out:${cliResponse.outputTokens}`);

    // Broadcast idle status
    broadcast('agent:status', { agentId, status: 'idle', statusMessage: 'Completed' });
    try {
      await db.update(agents).set({ status: 'idle', statusMessage: 'Completed' }).where(eq(agents.id, agentId));
    } catch {}

    broadcast('chat:typing', { agentId, isTyping: false });
    broadcast('chat:message', {
      id: responseMsgId,
      sender: agentName,
      content: responseText,
      messageType: 'text',
      agentId,
      createdAt: new Date().toISOString(),
    });

    // Notification (lib/notify.ts -- insert -> notification:new broadcast -> push fire-and-forget)
    const preview = responseText.length > 80
      ? responseText.substring(0, 80) + '\u2026'
      : responseText;
    // BUG-012: 알림 생성 실패가 방금 저장·방송한 성공 응답을 error로 바꾸면 안 된다 —
    // 이 호출만 별도 try/catch로 감싸 실패해도 로그만 남기고 흐름을 끝낸다.
    try {
      await createNotification(
        { type: 'info', title: `${agentName} 응답 완료`, message: preview, sourceAgentId: agentId },
        { broadcast }
      );
    } catch (notifyErr) {
      console.error(`[${ts()}] [CLI] ⚠ ${agentName} — 알림 생성 실패(응답은 성공으로 유지):`, notifyErr);
    }

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[${ts()}] [CLI] ✘ ${agentName} — ${errorMsg}`);

    // Broadcast error status
    broadcast('agent:status', { agentId, status: 'error', statusMessage: errorMsg.length > 60 ? errorMsg.substring(0, 60) + '…' : errorMsg });
    try {
      await db.update(agents).set({ status: 'error', statusMessage: errorMsg.length > 60 ? errorMsg.substring(0, 60) + '…' : errorMsg }).where(eq(agents.id, agentId));
    } catch {}

    await db.insert(chatMessages).values({
      id: responseMsgId,
      sender: agentName,
      content: `[Error] ${errorMsg}`,
      messageType: 'error',
      metadata: JSON.stringify({ agentId }),
    });

    broadcast('chat:typing', { agentId, isTyping: false });
    broadcast('chat:message', {
      id: responseMsgId,
      sender: agentName,
      content: `[Error] ${errorMsg}`,
      messageType: 'error',
      agentId,
      createdAt: new Date().toISOString(),
    });

    // Error notification (lib/notify.ts)
    await createNotification(
      {
        type: 'error',
        title: `${agentName} 응답 오류`,
        message: errorMsg.length > 80 ? errorMsg.substring(0, 80) + '\u2026' : errorMsg,
        sourceAgentId: agentId,
      },
      { broadcast }
    );
  }
}

/**
 * Execute parsed actions from agent response (CREATE_PART, CREATE_SUB).
 */
async function executeActions(
  actions: { type: string; payload: Record<string, unknown> }[],
  agentId: string,
  userId: string,
): Promise<string[]> {
  const results: string[] = [];

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'CREATE_PART': {
          const { name, description, skill } = action.payload as {
            name: string;
            description?: string;
            skill?: string;
          };
          if (!name) break;

          const partId = uuidv4();
          await db.insert(parts).values({
            id: partId,
            name,
            description: description || '',
            skillName: 'custom',
            skillVersion: '1.0.0',
            status: 'active',
            inputJson: skill ? JSON.stringify({ skill }) : null,
          });

          await db.insert(auditLogs).values({
            actorType: 'agent',
            actorId: agentId,
            action: 'create_part',
            resource: 'part',
            resourceId: partId,
            detail: JSON.stringify({ name, description }),
          });

          broadcast('part:created', { id: partId, name, status: 'active' });

          results.push(`[System] Part "${name}" has been created. (ID: ${partId})`);
          break;
        }

        case 'CREATE_SUB': {
          const { name, partId, skill } = action.payload as {
            name: string;
            partId: string;
            skill?: string;
          };
          if (!name || !partId) break;

          const [part] = await db.select().from(parts).where(eq(parts.id, partId)).limit(1);
          if (!part) {
            results.push(`[System] Part ID "${partId}" not found.`);
            break;
          }

          const subId = uuidv4();
          await db.insert(agents).values({
            id: subId,
            name,
            role: 'sub',
            partId,
            parentId: agentId,
            status: 'idle',
            modelName: 'sonnet',
            statusMessage: skill ? 'Skill assigned' : undefined,
          });

          if (skill) {
            const baseDir = process.env.CLAUDEMANAGER_HOME || process.cwd();
            const skillDir = path.join(baseDir, '.orchestrator', partId, 'sub-contexts');
            fs.mkdirSync(skillDir, { recursive: true });
            fs.writeFileSync(path.join(skillDir, `${subId}.md`), skill, 'utf-8');
          }

          await db.insert(auditLogs).values({
            actorType: 'agent',
            actorId: agentId,
            action: 'create_sub',
            resource: 'agent',
            resourceId: subId,
            detail: JSON.stringify({ name, partId, partName: part.name }),
          });

          broadcast('agent:created', { id: subId, name, role: 'sub', partId });

          results.push(`[System] Sub "${name}" has been created in "${part.name}". (ID: ${subId})`);
          break;
        }

        default:
          console.warn(`[ChatAction] Unknown action type: ${action.type}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      results.push(`[System] Action execution failed: ${msg}`);
    }
  }

  return results;
}
