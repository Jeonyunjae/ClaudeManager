/**
 * LiteLLM Callback Receiver — receives token/cost data from LiteLLM callbacks
 * and stores it in the costRecords table.
 *
 * LiteLLM sends POST requests here after each completion call.
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { costRecords } from '@/lib/schema';
import { broadcastCostUpdated } from '@/lib/ws-bridge';
import { logError } from '@/lib/error-logger';
import { sql } from 'drizzle-orm';

const LITELLM_CALLBACK_SECRET = process.env.LITELLM_CALLBACK_SECRET || 'claudemanager-litellm-callback';

interface LiteLLMCallbackPayload {
  call_id?: string;
  model?: string;
  model_id?: string;
  api_key?: string;
  messages?: unknown[];
  response?: {
    id?: string;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
  response_cost?: number;
  start_time?: string;
  end_time?: string;
  metadata?: {
    agentId?: string;
    projectId?: string;
    source?: string;
  };
  status?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Validate callback secret
    const secret = request.headers.get('x-litellm-secret');
    if (secret !== LITELLM_CALLBACK_SECRET) {
      return NextResponse.json(
        { error: { code: 'AUTH_INVALID', message: 'Invalid callback secret.' } },
        { status: 401 }
      );
    }

    const body = (await request.json()) as LiteLLMCallbackPayload;

    const modelName = body.model || body.model_id || 'unknown';
    const inputTokens = body.response?.usage?.prompt_tokens || 0;
    const outputTokens = body.response?.usage?.completion_tokens || 0;
    const cost = body.response_cost || 0;
    const agentId = body.metadata?.agentId || null;
    const projectId = body.metadata?.projectId || null;

    // Insert cost record
    await db.insert(costRecords)
      .values({
        agentId,
        modelName,
        inputTokens,
        outputTokens,
        cost,
        projectId,
      })
      ;

    // Broadcast cost update with running totals
    try {
      const [totalResult] = await db
        .select({ total: sql<number>`COALESCE(SUM(cost), 0)` })
        .from(costRecords)
        .limit(1);

      const totalCost = totalResult?.total ?? 0;

      broadcastCostUpdated({
        totalCost,
        overageLimit: 2000,
        overage: Math.max(0, totalCost - 200),
        overageRemaining: 2000 - Math.max(0, totalCost - 200),
        percentage: totalCost > 0 ? Math.round(Math.max(0, totalCost - 200) / 2000 * 100) : 0,
      });
    } catch {
      // Non-critical
    }

    return NextResponse.json({ data: { received: true } });
  } catch (error) {
    logError(error, { requestPath: '/api/litellm/callback' });
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: 'Server error.' } },
      { status: 500 }
    );
  }
}
