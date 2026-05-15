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
import { chatMessages, agents, parts, costRecords, auditLogs, notifications } from '../lib/schema';
import { agentManager } from '../lib/agent-manager';
import { loadMainSkill, parseActions } from '../lib/skill-loader';
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
    const cliResponse = await agentManager.sendMessage(
      agentId,
      cliPrompt,
      systemPrompt,
      modelName,
      (chunk: string) => {
        streamedText += chunk;
        broadcast('chat:stream', { agentId, responseMsgId, content: streamedText });
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

    // Save agent response
    await db.insert(chatMessages).values({
      id: responseMsgId,
      sender: agentName,
      content: responseText,
      messageType: 'text',
      metadata: JSON.stringify({ agentId }),
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

    // Notification
    const preview = responseText.length > 80
      ? responseText.substring(0, 80) + '\u2026'
      : responseText;
    const [notifResult] = await db.insert(notifications).values({
      type: 'info',
      title: `${agentName} 응답 완료`,
      message: preview,
      sourceAgentId: agentId,
    }).returning({ id: notifications.id });
    broadcast('notification:new', {
      notification: {
        id: notifResult.id,
        type: 'info',
        title: `${agentName} 응답 완료`,
        message: preview,
      },
    });

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

    // Error notification
    const [errNotif] = await db.insert(notifications).values({
      type: 'error',
      title: `${agentName} 응답 오류`,
      message: errorMsg.length > 80 ? errorMsg.substring(0, 80) + '\u2026' : errorMsg,
      sourceAgentId: agentId,
    }).returning({ id: notifications.id });
    broadcast('notification:new', {
      notification: {
        id: errNotif.id,
        type: 'error',
        title: `${agentName} 응답 오류`,
        message: errorMsg.length > 80 ? errorMsg.substring(0, 80) + '\u2026' : errorMsg,
      },
    });
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
