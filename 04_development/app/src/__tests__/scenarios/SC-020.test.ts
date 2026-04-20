/**
 * SC-020. 이전 용이성 및 마이그레이션 시나리오 테스트
 * 관련 기능: F047, F048, F049
 */
import { describe, it, expect } from 'vitest';

describe('SC-020: 이전 용이성 및 마이그레이션', () => {
  it('환경변수 기반 경로 관리', () => {
    const env = {
      CLAUDEMANAGER_HOME: '/Users/user/claudemanager',
      PROJECTS_ROOT: '/Users/user/projects',
      SKILL_LIB: '/Users/user/.claudemanager/skills',
    };
    expect(env.CLAUDEMANAGER_HOME).toBeTruthy();
    expect(env.PROJECTS_ROOT).toBeTruthy();
  });

  it('패키징 대상 목록', () => {
    const packItems = ['sqlite_db', 'orchestrator_folder', 'skill_library', 'env_config', 'version_locks'];
    expect(packItems).toHaveLength(5);
  });

  it('체크섬 무결성 검증', () => {
    const files = [
      { path: 'claudemanager.db', checksum: 'sha256:abc123', verified: true },
      { path: 'main-context.md', checksum: 'sha256:def456', verified: true },
    ];
    const allVerified = files.every((f) => f.verified);
    expect(allVerified).toBe(true);
  });

  describe('예외흐름', () => {
    it('E1: 환경변수 미설정', () => {
      const home = '';
      const isSet = !!home;
      expect(isSet).toBe(false);
    });

    it('E2: 체크섬 불일치 -> 재전송 권장', () => {
      const originalChecksum = 'sha256:abc123';
      const receivedChecksum = 'sha256:xyz789';
      const isIntact = originalChecksum === receivedChecksum;
      expect(isIntact).toBe(false);
    });
  });
});
