/**
 * utils.ts 단위 테스트
 * 대상 기능: 전체 UI에서 사용하는 유틸리티 (F013 대시보드, F016 비용 대시보드 등)
 * 시나리오 근거: SC-001 (대시보드 표시), SC-007 (비용 데이터 표시)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDate, formatDateTime, formatRelativeTime, formatCurrency, formatTokenCount, formatBytes } from '@/lib/utils';

describe('utils.ts - 날짜 포맷', () => {
  // SC-001: 대시보드에서 날짜 표시
  describe('formatDate', () => {
    it('ISO 날짜 문자열을 한국어 날짜로 변환', () => {
      const result = formatDate('2025-03-15T10:00:00Z');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      // 한국어 로케일 형식 확인 (YYYY. MM. DD. 또는 유사)
      expect(result).toMatch(/\d{4}/);
    });
  });

  describe('formatDateTime', () => {
    it('ISO 날짜 문자열을 날짜+시간으로 변환', () => {
      const result = formatDateTime('2025-03-15T10:30:00Z');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });

  describe('formatRelativeTime', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('30초 전이면 "방금 전" 반환', () => {
      const now = new Date('2025-03-15T10:00:30Z');
      vi.setSystemTime(now);
      const result = formatRelativeTime('2025-03-15T10:00:00Z');
      expect(result).toBe('방금 전');
    });

    it('5분 전이면 "5분 전" 반환', () => {
      const now = new Date('2025-03-15T10:05:00Z');
      vi.setSystemTime(now);
      const result = formatRelativeTime('2025-03-15T10:00:00Z');
      expect(result).toBe('5분 전');
    });

    it('3시간 전이면 "3시간 전" 반환', () => {
      const now = new Date('2025-03-15T13:00:00Z');
      vi.setSystemTime(now);
      const result = formatRelativeTime('2025-03-15T10:00:00Z');
      expect(result).toBe('3시간 전');
    });

    it('5일 전이면 "5일 전" 반환', () => {
      const now = new Date('2025-03-20T10:00:00Z');
      vi.setSystemTime(now);
      const result = formatRelativeTime('2025-03-15T10:00:00Z');
      expect(result).toBe('5일 전');
    });

    it('31일 이상이면 날짜 포맷으로 반환', () => {
      const now = new Date('2025-05-15T10:00:00Z');
      vi.setSystemTime(now);
      const result = formatRelativeTime('2025-03-15T10:00:00Z');
      // 30일 초과이므로 formatDate 형식으로 반환
      expect(result).toMatch(/\d{4}/);
    });
  });
});

describe('utils.ts - 숫자 포맷', () => {
  // SC-007: 비용 대시보드에서 금액 표시
  describe('formatCurrency', () => {
    it('달러 형식으로 포맷', () => {
      expect(formatCurrency(12.5)).toBe('$12.50');
      expect(formatCurrency(0)).toBe('$0.00');
      expect(formatCurrency(100.456)).toBe('$100.46');
    });

    it('큰 금액도 정상 포맷', () => {
      expect(formatCurrency(1234.56)).toBe('$1234.56');
    });
  });

  // SC-007: 토큰 사용량 표시
  describe('formatTokenCount', () => {
    it('1000 미만은 그대로 표시', () => {
      expect(formatTokenCount(500)).toBe('500');
      expect(formatTokenCount(0)).toBe('0');
      expect(formatTokenCount(999)).toBe('999');
    });

    it('1000 이상은 K 단위로 표시', () => {
      expect(formatTokenCount(1000)).toBe('1.0K');
      expect(formatTokenCount(1500)).toBe('1.5K');
      expect(formatTokenCount(999999)).toBe('1000.0K');
    });

    it('100만 이상은 M 단위로 표시', () => {
      expect(formatTokenCount(1000000)).toBe('1.0M');
      expect(formatTokenCount(2500000)).toBe('2.5M');
    });
  });

  // SC-015: 백업 파일 크기 표시
  describe('formatBytes', () => {
    it('1024 미만은 B 단위', () => {
      expect(formatBytes(500)).toBe('500 B');
      expect(formatBytes(0)).toBe('0 B');
    });

    it('KB 단위 표시', () => {
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
    });

    it('MB 단위 표시', () => {
      expect(formatBytes(1048576)).toBe('1.0 MB');
      expect(formatBytes(5242880)).toBe('5.0 MB');
    });

    it('GB 단위 표시', () => {
      expect(formatBytes(1073741824)).toBe('1.0 GB');
    });
  });
});
