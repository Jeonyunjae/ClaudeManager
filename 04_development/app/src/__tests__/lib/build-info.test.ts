/**
 * 화면 버전 표시 단위 테스트 — FEAT-005
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { formatBuildLabel, getBuildInfo } from '@/lib/build-info';

describe('formatBuildLabel', () => {
  it('커밋 + 커밋 시각(월/일 시:분)', () => {
    vi.stubEnv('TZ', 'Asia/Seoul');
    const label = formatBuildLabel({ commit: '91879f9', commitTime: '2026-10-19T11:51:00+09:00' });
    expect(label).toMatch(/^버전 91879f9 \(\d{2}\/\d{2} \d{2}:\d{2}\)$/);
  });
  it('시각이 없거나 깨졌으면 커밋만', () => {
    expect(formatBuildLabel({ commit: 'abc1234', commitTime: '' })).toBe('버전 abc1234');
  });
  it('커밋이 없으면 안내', () => {
    expect(formatBuildLabel({ commit: '', commitTime: '' })).toBe('버전 정보 없음');
  });
});

describe('getBuildInfo', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('next.config가 넣은 값을 읽는다', () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_COMMIT', 'deadbee');
    vi.stubEnv('NEXT_PUBLIC_BUILD_COMMIT_TIME', '2026-10-19T02:51:00Z');
    expect(getBuildInfo()).toEqual({ commit: 'deadbee', commitTime: '2026-10-19T02:51:00Z' });
  });
});
