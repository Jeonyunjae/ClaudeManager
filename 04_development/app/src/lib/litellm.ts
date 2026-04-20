/**
 * LiteLLM Client — proxies AI model calls through LiteLLM gateway.
 *
 * LiteLLM runs at http://localhost:4000 and provides:
 * - Unified API for multiple AI providers
 * - Token/cost tracking via callbacks
 * - Model routing and fallbacks
 *
 * Gracefully degrades if LiteLLM is not running.
 */

const LITELLM_BASE_URL = process.env.LITELLM_BASE_URL || 'http://localhost:4000';
const LITELLM_API_KEY = process.env.LITELLM_API_KEY || '';

export interface ChatCompletionRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  metadata?: Record<string, unknown>;
}

export interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

export interface LiteLLMError {
  error: {
    message: string;
    type: string;
    code: string | number;
  };
}

/**
 * Check if LiteLLM is reachable.
 */
export async function isLiteLLMAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${LITELLM_BASE_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Send a chat completion request through LiteLLM.
 */
export async function chatCompletion(
  request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (LITELLM_API_KEY) {
    headers['Authorization'] = `Bearer ${LITELLM_API_KEY}`;
  }

  const response = await fetch(`${LITELLM_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...request,
      metadata: {
        ...request.metadata,
        source: 'claudemanager',
      },
    }),
    signal: AbortSignal.timeout(120000), // 2 min timeout for AI calls
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as LiteLLMError | null;
    throw new Error(
      `LiteLLM error ${response.status}: ${errorBody?.error?.message || response.statusText}`
    );
  }

  return response.json() as Promise<ChatCompletionResponse>;
}

/**
 * Get available models from LiteLLM.
 */
export async function getAvailableModels(): Promise<Array<{ id: string; object: string }>> {
  try {
    const headers: Record<string, string> = {};
    if (LITELLM_API_KEY) {
      headers['Authorization'] = `Bearer ${LITELLM_API_KEY}`;
    }

    const response = await fetch(`${LITELLM_BASE_URL}/v1/models`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return [];

    const data = (await response.json()) as { data: Array<{ id: string; object: string }> };
    return data.data || [];
  } catch {
    return [];
  }
}

/**
 * Resolve a model name using routing rules.
 * Maps abstract model names (e.g. "fast", "smart") to actual model IDs.
 */
export function resolveModelRoute(modelAlias: string): string {
  const routes: Record<string, string> = {};

  // Load from environment variable MODEL_ROUTING (JSON)
  try {
    const routingEnv = process.env.MODEL_ROUTING;
    if (routingEnv) {
      Object.assign(routes, JSON.parse(routingEnv));
    }
  } catch {
    // Invalid JSON — ignore
  }

  // Default routing
  const defaults: Record<string, string> = {
    fast: 'claude-3-5-haiku-latest',
    smart: 'claude-sonnet-4-20250514',
    powerful: 'claude-opus-4-20250514',
    default: 'claude-sonnet-4-20250514',
  };

  return routes[modelAlias] || defaults[modelAlias] || modelAlias;
}
