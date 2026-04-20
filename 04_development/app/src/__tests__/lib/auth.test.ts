/**
 * auth.ts 단위 테스트
 * 대상 기능: F059 (대표-Main 지시 UI - 인증), F036 (API 키 등록 - JWT 기반)
 * 시나리오 근거: SC-001 (최초 접속 및 인증), SC-004 (승인 처리 시 인증 필요)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { generateToken, verifyToken, extractToken, hashPassword, comparePassword, getAuthenticatedUserId } from '@/lib/auth';

describe('auth.ts - JWT 토큰 관리', () => {
  // SC-001: 최초 접속 시 JWT 토큰 발급
  describe('generateToken / verifyToken', () => {
    it('유효한 userId로 토큰 생성 후 검증 시 payload 반환', () => {
      const token = generateToken(1);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');

      const payload = verifyToken(token);
      expect(payload).not.toBeNull();
      expect(payload!.userId).toBe(1);
      expect(payload!.iat).toBeDefined();
      expect(payload!.exp).toBeDefined();
    });

    it('토큰 만료 시간이 7일로 설정됨', () => {
      const token = generateToken(1);
      const payload = verifyToken(token);
      expect(payload).not.toBeNull();

      const expectedExpiry = payload!.iat + 7 * 24 * 60 * 60;
      expect(payload!.exp).toBe(expectedExpiry);
    });

    it('서로 다른 userId에 대해 다른 토큰 생성', () => {
      const token1 = generateToken(1);
      const token2 = generateToken(2);
      expect(token1).not.toBe(token2);
    });
  });

  // E1: 잘못된 토큰으로 접근 시 인증 실패
  describe('verifyToken - 예외 흐름', () => {
    it('잘못된 토큰은 null 반환', () => {
      const result = verifyToken('invalid-token');
      expect(result).toBeNull();
    });

    it('빈 문자열 토큰은 null 반환', () => {
      const result = verifyToken('');
      expect(result).toBeNull();
    });

    it('변조된 토큰은 null 반환', () => {
      const token = generateToken(1);
      const tampered = token + 'tampered';
      const result = verifyToken(tampered);
      expect(result).toBeNull();
    });
  });

  // SC-001: Authorization 헤더에서 토큰 추출
  describe('extractToken', () => {
    it('Bearer 토큰 형식에서 정상 추출', () => {
      const mockRequest = {
        headers: {
          get: (name: string) => name === 'authorization' ? 'Bearer test-token-123' : null,
        },
      } as any;

      const token = extractToken(mockRequest);
      expect(token).toBe('test-token-123');
    });

    it('Authorization 헤더 없으면 null 반환', () => {
      const mockRequest = {
        headers: {
          get: () => null,
        },
      } as any;

      const token = extractToken(mockRequest);
      expect(token).toBeNull();
    });

    it('Bearer 접두사 없는 토큰은 null 반환', () => {
      const mockRequest = {
        headers: {
          get: (name: string) => name === 'authorization' ? 'Basic some-token' : null,
        },
      } as any;

      const token = extractToken(mockRequest);
      expect(token).toBeNull();
    });
  });

  describe('getAuthenticatedUserId', () => {
    it('유효한 토큰에서 userId 추출', () => {
      const token = generateToken(42);
      const mockRequest = {
        headers: {
          get: (name: string) => name === 'authorization' ? `Bearer ${token}` : null,
        },
      } as any;

      const userId = getAuthenticatedUserId(mockRequest);
      expect(userId).toBe(42);
    });

    it('토큰 없으면 null 반환', () => {
      const mockRequest = {
        headers: {
          get: () => null,
        },
      } as any;

      const userId = getAuthenticatedUserId(mockRequest);
      expect(userId).toBeNull();
    });

    it('잘못된 토큰이면 null 반환', () => {
      const mockRequest = {
        headers: {
          get: (name: string) => name === 'authorization' ? 'Bearer invalid' : null,
        },
      } as any;

      const userId = getAuthenticatedUserId(mockRequest);
      expect(userId).toBeNull();
    });
  });
});

describe('auth.ts - 비밀번호 해싱', () => {
  // SC-001: 비밀번호 설정 및 검증
  describe('hashPassword / comparePassword', () => {
    it('비밀번호 해싱 후 비교 시 true 반환', async () => {
      const password = 'test-password-123';
      const hash = await hashPassword(password);

      expect(hash).toBeTruthy();
      expect(hash).not.toBe(password);

      const isValid = await comparePassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('잘못된 비밀번호 비교 시 false 반환', async () => {
      const hash = await hashPassword('correct-password');
      const isValid = await comparePassword('wrong-password', hash);
      expect(isValid).toBe(false);
    });

    it('같은 비밀번호도 매번 다른 해시 생성 (salt)', async () => {
      const password = 'same-password';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      expect(hash1).not.toBe(hash2);
    });

    it('빈 비밀번호도 해싱 가능', async () => {
      const hash = await hashPassword('');
      expect(hash).toBeTruthy();
    });
  });
});
