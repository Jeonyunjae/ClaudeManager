/**
 * crypto.ts 단위 테스트
 * 대상 기능: F039 (키 암호화 저장), F036 (API 키 등록/갱신)
 * 시나리오 근거: SC-011 (API 키 등록 시 암호화), SC-028 (보안 설정)
 */
import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, maskApiKey } from '@/lib/crypto';

describe('crypto.ts - AES-256-GCM 암호화/복호화', () => {
  // SC-011: API 키 등록 시 암호화 저장
  describe('encrypt / decrypt', () => {
    it('평문을 암호화 후 복호화하면 원문 복원', () => {
      const plaintext = 'sk-1234567890abcdef';
      const { encrypted, iv, tag } = encrypt(plaintext);

      expect(encrypted).toBeTruthy();
      expect(iv).toBeTruthy();
      expect(tag).toBeTruthy();
      expect(encrypted).not.toBe(plaintext);

      const decrypted = decrypt(encrypted, iv, tag);
      expect(decrypted).toBe(plaintext);
    });

    it('같은 평문도 매번 다른 암호문 생성 (IV 랜덤)', () => {
      const plaintext = 'same-api-key';
      const result1 = encrypt(plaintext);
      const result2 = encrypt(plaintext);

      expect(result1.encrypted).not.toBe(result2.encrypted);
      expect(result1.iv).not.toBe(result2.iv);
    });

    it('빈 문자열도 암호화/복호화 가능', () => {
      const { encrypted, iv, tag } = encrypt('');
      const decrypted = decrypt(encrypted, iv, tag);
      expect(decrypted).toBe('');
    });

    it('긴 API 키도 암호화/복호화 가능', () => {
      const longKey = 'sk-' + 'a'.repeat(200);
      const { encrypted, iv, tag } = encrypt(longKey);
      const decrypted = decrypt(encrypted, iv, tag);
      expect(decrypted).toBe(longKey);
    });

    it('특수문자 포함 키 암호화/복호화', () => {
      const specialKey = 'sk-!@#$%^&*()_+-=[]{}|;:,.<>?';
      const { encrypted, iv, tag } = encrypt(specialKey);
      const decrypted = decrypt(encrypted, iv, tag);
      expect(decrypted).toBe(specialKey);
    });

    it('한글 문자열 암호화/복호화', () => {
      const korean = '테스트 암호화 키';
      const { encrypted, iv, tag } = encrypt(korean);
      const decrypted = decrypt(encrypted, iv, tag);
      expect(decrypted).toBe(korean);
    });
  });

  // E: 잘못된 데이터로 복호화 시 실패
  describe('decrypt - 예외 흐름', () => {
    it('잘못된 iv로 복호화 시 에러 발생', () => {
      const { encrypted, tag } = encrypt('test');
      const wrongIv = Buffer.from('wrong-iv-data!!').toString('base64');

      expect(() => decrypt(encrypted, wrongIv, tag)).toThrow();
    });

    it('잘못된 tag로 복호화 시 에러 발생', () => {
      const { encrypted, iv } = encrypt('test');
      const wrongTag = Buffer.from('wrong-tag-data!!').toString('base64');

      expect(() => decrypt(encrypted, iv, wrongTag)).toThrow();
    });

    it('잘못된 encrypted 데이터로 복호화 시 에러 발생', () => {
      const { iv, tag } = encrypt('test');
      const wrongEncrypted = Buffer.from('wrong-data').toString('base64');

      expect(() => decrypt(wrongEncrypted, iv, tag)).toThrow();
    });
  });

  // SC-011: API 키 마스킹 표시
  describe('maskApiKey', () => {
    it('긴 키는 앞 7자 + ... + 뒤 4자로 마스킹', () => {
      const key = 'sk-1234567890abcdef';
      const masked = maskApiKey(key);
      expect(masked).toBe('sk-1234...cdef');
    });

    it('8자 이하 키는 *** 반환', () => {
      expect(maskApiKey('short')).toBe('***');
      expect(maskApiKey('12345678')).toBe('***');
    });

    it('정확히 9자 키는 마스킹 처리', () => {
      const key = '123456789';
      const masked = maskApiKey(key);
      expect(masked).toBe('1234567...6789');
    });

    it('빈 문자열은 *** 반환', () => {
      expect(maskApiKey('')).toBe('***');
    });
  });
});
