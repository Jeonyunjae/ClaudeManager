/**
 * background-jobs.ts 단위 테스트
 * 대상 기능: CM_BACKGROUND_JOBS=off 판정 (NFR-002)
 * 수용 기준(DES-001 §테스트 인스턴스 구성, DES-009 §환경 변수):
 *   - CM_BACKGROUND_JOBS='off' → false (건너뜀)
 *   - 변수 없음/다른 값 → true (기존과 동일하게 전부 실행)
 */
import { describe, it, expect } from 'vitest';
import { backgroundJobsEnabled } from '@/lib/background-jobs';

describe('backgroundJobsEnabled', () => {
  it('CM_BACKGROUND_JOBS가 없으면 true를 반환한다 (기존과 동일)', () => {
    expect(backgroundJobsEnabled({})).toBe(true);
  });

  it("CM_BACKGROUND_JOBS='off'면 false를 반환한다", () => {
    expect(backgroundJobsEnabled({ CM_BACKGROUND_JOBS: 'off' })).toBe(false);
  });

  it('CM_BACKGROUND_JOBS가 다른 값이면 true를 반환한다', () => {
    expect(backgroundJobsEnabled({ CM_BACKGROUND_JOBS: 'on' })).toBe(true);
    expect(backgroundJobsEnabled({ CM_BACKGROUND_JOBS: '' })).toBe(true);
    expect(backgroundJobsEnabled({ CM_BACKGROUND_JOBS: 'OFF' })).toBe(true);
  });
});
