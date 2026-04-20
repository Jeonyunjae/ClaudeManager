/**
 * api.ts (ApiClient) 단위 테스트
 * 대상 기능: 전체 API 통신 기반 (모든 F 기능)
 * 시나리오 근거: SC-001~SC-029 (모든 API 호출)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClientError } from '@/lib/api';

describe('ApiClientError', () => {
  it('에러 객체 생성 시 속성 정상 설정', () => {
    const error = new ApiClientError('Not found', 'AGENT_NOT_FOUND', 404, { id: '123' });

    expect(error.message).toBe('Not found');
    expect(error.code).toBe('AGENT_NOT_FOUND');
    expect(error.statusCode).toBe(404);
    expect(error.details).toEqual({ id: '123' });
    expect(error instanceof Error).toBe(true);
  });

  it('details 없이도 생성 가능', () => {
    const error = new ApiClientError('Unauthorized', 'AUTH_TOKEN_EXPIRED', 401);
    expect(error.details).toBeUndefined();
  });

  it('Error 프로토타입 체인 유지', () => {
    const error = new ApiClientError('test', 'TEST', 500);
    expect(error instanceof Error).toBe(true);
    expect(error.name).toBe('Error');
  });
});
