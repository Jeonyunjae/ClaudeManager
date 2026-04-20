/**
 * litellm.ts 단위 테스트
 * 대상 기능: F044~F046 (LiteLLM 통합, 모델 라우팅, 토큰/비용 수집)
 * 수용 기준:
 *   - chatCompletion이 올바른 URL로 요청
 *   - LiteLLM 미실행 시 graceful fallback
 *   - 모델 라우팅 설정
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import {
  isLiteLLMAvailable,
  chatCompletion,
  getAvailableModels,
  resolveModelRoute,
} from '@/lib/litellm';

describe('litellm.ts - LiteLLM 클라이언트', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- AC: isLiteLLMAvailable ---
  describe('isLiteLLMAvailable', () => {
    it('LiteLLM 서버가 응답하면 true 반환', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      const available = await isLiteLLMAvailable();
      expect(available).toBe(true);
    });

    it('LiteLLM 서버가 응답하지 않으면 false 반환', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const available = await isLiteLLMAvailable();
      expect(available).toBe(false);
    });

    it('health 엔드포인트로 요청', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      await isLiteLLMAvailable();

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('/health');
      expect(url).toContain('4000');
    });
  });

  // --- AC: chatCompletion ---
  describe('chatCompletion', () => {
    it('올바른 URL(/v1/chat/completions)로 POST 요청', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'chatcmpl-1',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Hello' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          model: 'claude-sonnet-4-20250514',
        }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      await chatCompletion({
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hi' }],
      });

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/chat/completions');
      expect(options.method).toBe('POST');
    });

    it('요청 body에 model과 messages 포함', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'chatcmpl-2',
          choices: [],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          model: 'test',
        }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      await chatCompletion({
        model: 'test-model',
        messages: [{ role: 'user', content: 'Test' }],
        temperature: 0.7,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('test-model');
      expect(body.messages[0].content).toBe('Test');
      expect(body.temperature).toBe(0.7);
    });

    it('metadata에 source=claudemanager 자동 추가', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'chatcmpl-3',
          choices: [],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          model: 'test',
        }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      await chatCompletion({
        model: 'test',
        messages: [{ role: 'user', content: 'Hi' }],
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.metadata.source).toBe('claudemanager');
    });

    it('LiteLLM 에러 응답 시 에러 throw', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: vi.fn().mockResolvedValue({
          error: { message: 'Model not found', type: 'error', code: 'model_not_found' },
        }),
      });

      await expect(
        chatCompletion({ model: 'bad-model', messages: [] })
      ).rejects.toThrow('LiteLLM error 500');
    });

    it('네트워크 에러 시 throw (graceful이 아닌 호출자 처리)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network unreachable'));

      await expect(
        chatCompletion({ model: 'test', messages: [] })
      ).rejects.toThrow('Network unreachable');
    });

    it('Content-Type 헤더 포함', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'x', choices: [], usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, model: 't',
        }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      await chatCompletion({ model: 't', messages: [] });

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  // --- AC: getAvailableModels ---
  describe('getAvailableModels', () => {
    it('/v1/models 엔드포인트로 요청', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [
            { id: 'claude-sonnet-4-20250514', object: 'model' },
            { id: 'gpt-4', object: 'model' },
          ],
        }),
      });

      const models = await getAvailableModels();
      expect(models).toHaveLength(2);
      expect(models[0].id).toBe('claude-sonnet-4-20250514');
    });

    it('LiteLLM 미실행 시 빈 배열 반환', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const models = await getAvailableModels();
      expect(models).toEqual([]);
    });
  });

  // --- AC: resolveModelRoute ---
  describe('resolveModelRoute', () => {
    const origEnv = process.env.MODEL_ROUTING;

    afterEach(() => {
      if (origEnv === undefined) {
        delete process.env.MODEL_ROUTING;
      } else {
        process.env.MODEL_ROUTING = origEnv;
      }
    });

    it('fast -> claude-3-5-haiku-latest 기본 매핑', () => {
      expect(resolveModelRoute('fast')).toBe('claude-3-5-haiku-latest');
    });

    it('smart -> claude-sonnet-4-20250514 기본 매핑', () => {
      expect(resolveModelRoute('smart')).toBe('claude-sonnet-4-20250514');
    });

    it('powerful -> claude-opus-4-20250514 기본 매핑', () => {
      expect(resolveModelRoute('powerful')).toBe('claude-opus-4-20250514');
    });

    it('알 수 없는 별칭은 그대로 반환', () => {
      expect(resolveModelRoute('my-custom-model')).toBe('my-custom-model');
    });

    it('환경변수 MODEL_ROUTING으로 커스텀 라우팅', () => {
      process.env.MODEL_ROUTING = JSON.stringify({ fast: 'custom-fast-model' });
      expect(resolveModelRoute('fast')).toBe('custom-fast-model');
    });
  });
});
