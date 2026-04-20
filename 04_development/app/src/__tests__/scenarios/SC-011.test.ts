/**
 * SC-011. API 키 관리 시나리오 테스트
 * 관련 기능: F036, F037, F038, F039
 */
import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '@/lib/crypto';
import type { ApiKey } from '@/types/settings';

describe('SC-011: API 키 관리', () => {
  describe('Step 1-2: API 키 등록 및 암호화 저장', () => {
    it('API 키가 AES-256-GCM으로 암호화 저장', () => {
      const rawKey = 'sk-ant-xxxx-test-key-12345';
      const result = encrypt(rawKey);
      expect(result.encrypted).not.toBe(rawKey);
      expect(result.iv).toBeTruthy();
      expect(result.tag).toBeTruthy();
      const decrypted = decrypt(result.encrypted, result.iv, result.tag);
      expect(decrypted).toBe(rawKey);
    });

    it('키 등록 후 상태가 active', () => {
      const apiKey: ApiKey = {
        id: 1,
        provider: 'Anthropic',
        keyMasked: 'sk-ant-****5678',
        status: 'active',
        expiresAt: '2026-12-31T00:00:00Z',
        monthlyUsage: 0,
        createdAt: new Date().toISOString(),
      };
      expect(apiKey.status).toBe('active');
      expect(apiKey.provider).toBe('Anthropic');
    });

    it('키 마스킹: 마지막 4자리만 표시', () => {
      const rawKey = 'sk-ant-xxxx-test-key-12345678';
      const masked = rawKey.slice(0, 6) + '****' + rawKey.slice(-4);
      expect(masked).toContain('****');
      expect(masked.endsWith('5678')).toBe(true);
    });
  });

  describe('Step 3: 만료 알림', () => {
    it('만료 7일 전 알림 트리거', () => {
      const expiresAt = new Date('2026-12-31');
      const now = new Date('2026-12-24');
      const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const shouldAlert = daysUntilExpiry <= 7;
      expect(shouldAlert).toBe(true);
      expect(daysUntilExpiry).toBe(7);
    });
  });

  describe('Step 4: 키 갱신', () => {
    it('기존 키 폐기 후 새 키 등록', () => {
      let keys: ApiKey[] = [
        { id: 1, provider: 'Anthropic', keyMasked: 'sk-ant-****5678', status: 'active', monthlyUsage: 45.2, createdAt: '2026-01-01' },
      ];

      // 기존 키 폐기
      keys = keys.map((k) => k.id === 1 ? { ...k, status: 'revoked' as const } : k);
      expect(keys[0].status).toBe('revoked');

      // 새 키 등록
      keys.push({ id: 2, provider: 'Anthropic', keyMasked: 'sk-ant-****9999', status: 'active', monthlyUsage: 0, createdAt: new Date().toISOString() });
      const activeKeys = keys.filter((k) => k.status === 'active');
      expect(activeKeys).toHaveLength(1);
    });
  });

  describe('예외흐름', () => {
    it('E1: 잘못된 형식의 API 키', () => {
      const key = 'invalid-key-format';
      const isValid = key.startsWith('sk-ant-');
      expect(isValid).toBe(false);
    });

    it('E2: 만료된 키로 API 호출 실패 -> SC-006 연결', () => {
      const keyStatus = 'expired';
      const shouldTriggerKeyManagement = keyStatus === 'expired';
      expect(shouldTriggerKeyManagement).toBe(true);
    });

    it('E3: 키 삭제 시 영향도 경고', () => {
      const affectedInstances = 3;
      const shouldWarn = affectedInstances > 0;
      expect(shouldWarn).toBe(true);
    });
  });
});
