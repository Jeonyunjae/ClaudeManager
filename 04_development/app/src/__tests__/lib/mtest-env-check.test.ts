/**
 * scripts/mtest-env-check.mjs 단위 테스트 — DF-008 재발 방지 + BUG-001/BUG-003/SEC-002.
 * 대상 기능: 테스트 인스턴스(claudemanager-mtest) 기동 전 `.env.local` 안전 검증
 * 수용 기준(사고 보고서 DF-008):
 *   - 운영 env를 상속한 셸에서 기동해도, `.env.local`의 DATABASE_URL이
 *     정확히 `claudemanager_mtest`가 아니면 검증은 실패(ok=false)를 반환한다.
 *   - CM_BACKGROUND_JOBS=off가 아니면 실패한다.
 *   - PORT=3010(운영) 또는 WS_PORT=3001(운영)이면(또는 WS_PORT 누락으로
 *     기본값이 3001이 되면) 실패한다.
 *   - 모두 만족하면 ok=true, reasons=[]를 반환한다.
 * 추가 수용 기준(BUG-001·BUG-003·SEC-002):
 *   - WS_BROADCAST_SECRET·JWT_SECRET이 없거나 코드 기본값과 같으면 실패한다.
 *   - NEXT_PUBLIC_WS_PORT가 WS_PORT와 다르면 실패한다.
 *   - .env.development.local·.env.development·.env가 같은 디렉터리에 있으면 실패한다.
 *   - 운영 .env.local 경로를 주면 비밀값·DB명이 같을 때 실패한다(값 자체는 노출하지 않는다).
 *   - 에러 메시지에 DB 접속 URL의 비밀번호가 그대로 나오지 않는다(마스킹).
 *
 * 검증 대상은 순수 함수(파일 경로만 받는다)라 실제 pm2/DB/서버를 건드리지
 * 않는다. /tmp 아래에 가짜 .env.local을 만들어 직접 호출한다.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  checkMtestEnv,
  parseEnvFile,
  dbNameFromUrl,
  maskDbUrl,
  DEFAULT_WS_BROADCAST_SECRET,
  DEFAULT_JWT_SECRET,
} from '../../../scripts/mtest-env-check.mjs';

const tmpDirs: string[] = [];

function writeEnvLocal(content: string, filename = '.env.local'): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'mtest-env-check-'));
  tmpDirs.push(dir);
  const filePath = path.join(dir, filename);
  writeFileSync(filePath, content, 'utf8');
  return filePath;
}

function writeSibling(dir: string, filename: string, content = ''): void {
  writeFileSync(path.join(dir, filename), content, 'utf8');
}

afterEach(() => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

const SECRETS = [
  'WS_BROADCAST_SECRET=mtest-only-broadcast-secret',
  'JWT_SECRET=mtest-only-jwt-secret',
].join('\n');

const VALID_ENV = [
  'DATABASE_URL=postgresql://claudemanager:pw@127.0.0.1:5434/claudemanager_mtest',
  'CM_BACKGROUND_JOBS=off',
  'PORT=3110',
  'WS_PORT=3111',
  'NEXT_PUBLIC_WS_PORT=3111',
  SECRETS,
].join('\n');

describe('checkMtestEnv', () => {
  it('정상: 모든 조건을 만족하면 ok=true, reasons=[]', () => {
    const envPath = writeEnvLocal(VALID_ENV);
    const result = checkMtestEnv(envPath);
    expect(result.ok).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('.env.local이 없으면 ok=false', () => {
    const result = checkMtestEnv('/tmp/does-not-exist-mtest-env-check/.env.local');
    expect(result.ok).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('DB 이름 불일치: 운영 DB(claudemanager)를 그대로 가리키면 ok=false', () => {
    const envPath = writeEnvLocal(
      [
        'DATABASE_URL=postgresql://claudemanager:pw@127.0.0.1:5434/claudemanager',
        'CM_BACKGROUND_JOBS=off',
        'PORT=3110',
        'WS_PORT=3111',
        'NEXT_PUBLIC_WS_PORT=3111',
        SECRETS,
      ].join('\n')
    );
    const result = checkMtestEnv(envPath);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes('claudemanager'))).toBe(true);
  });

  it('DB 이름 불일치: claudemanager_mtest_x 같은 유사 이름도 거부한다', () => {
    const envPath = writeEnvLocal(
      [
        'DATABASE_URL=postgresql://claudemanager:pw@127.0.0.1:5434/claudemanager_mtest_x',
        'CM_BACKGROUND_JOBS=off',
        'PORT=3110',
        'WS_PORT=3111',
        'NEXT_PUBLIC_WS_PORT=3111',
        SECRETS,
      ].join('\n')
    );
    const result = checkMtestEnv(envPath);
    expect(result.ok).toBe(false);
  });

  it('DB 이름 불일치: 쿼리스트링이 붙어도 "?" 앞까지만 보고 정확히 판정한다', () => {
    const envPath = writeEnvLocal(
      [
        'DATABASE_URL=postgresql://claudemanager:pw@127.0.0.1:5434/claudemanager?sslmode=require',
        'CM_BACKGROUND_JOBS=off',
        'PORT=3110',
        'WS_PORT=3111',
        'NEXT_PUBLIC_WS_PORT=3111',
        SECRETS,
      ].join('\n')
    );
    const result = checkMtestEnv(envPath);
    expect(result.ok).toBe(false);
  });

  it('DB 이름이 맞으면 쿼리스트링이 붙어도 통과한다(오탐 방지)', () => {
    const envPath = writeEnvLocal(
      [
        'DATABASE_URL=postgresql://claudemanager:pw@127.0.0.1:5434/claudemanager_mtest?sslmode=require',
        'CM_BACKGROUND_JOBS=off',
        'PORT=3110',
        'WS_PORT=3111',
        'NEXT_PUBLIC_WS_PORT=3111',
        SECRETS,
      ].join('\n')
    );
    const result = checkMtestEnv(envPath);
    expect(result.ok).toBe(true);
  });

  it('플래그 누락: CM_BACKGROUND_JOBS가 없으면 ok=false', () => {
    const envPath = writeEnvLocal(
      [
        'DATABASE_URL=postgresql://claudemanager:pw@127.0.0.1:5434/claudemanager_mtest',
        'PORT=3110',
        'WS_PORT=3111',
        'NEXT_PUBLIC_WS_PORT=3111',
        SECRETS,
      ].join('\n')
    );
    const result = checkMtestEnv(envPath);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes('CM_BACKGROUND_JOBS'))).toBe(true);
  });

  it('플래그 오설정: CM_BACKGROUND_JOBS=on이면 ok=false', () => {
    const envPath = writeEnvLocal(
      [
        'DATABASE_URL=postgresql://claudemanager:pw@127.0.0.1:5434/claudemanager_mtest',
        'CM_BACKGROUND_JOBS=on',
        'PORT=3110',
        'WS_PORT=3111',
        'NEXT_PUBLIC_WS_PORT=3111',
        SECRETS,
      ].join('\n')
    );
    const result = checkMtestEnv(envPath);
    expect(result.ok).toBe(false);
  });

  it('운영 포트 사용: PORT=3010이면 ok=false', () => {
    const envPath = writeEnvLocal(
      [
        'DATABASE_URL=postgresql://claudemanager:pw@127.0.0.1:5434/claudemanager_mtest',
        'CM_BACKGROUND_JOBS=off',
        'PORT=3010',
        'WS_PORT=3111',
        'NEXT_PUBLIC_WS_PORT=3111',
        SECRETS,
      ].join('\n')
    );
    const result = checkMtestEnv(envPath);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes('3010'))).toBe(true);
  });

  it('운영 포트 사용: WS_PORT=3001이면 ok=false', () => {
    const envPath = writeEnvLocal(
      [
        'DATABASE_URL=postgresql://claudemanager:pw@127.0.0.1:5434/claudemanager_mtest',
        'CM_BACKGROUND_JOBS=off',
        'PORT=3110',
        'WS_PORT=3001',
        'NEXT_PUBLIC_WS_PORT=3001',
        SECRETS,
      ].join('\n')
    );
    const result = checkMtestEnv(envPath);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes('3001'))).toBe(true);
  });

  it('운영 포트 사용: WS_PORT 누락 시 기본값(3001)이 운영 포트와 같아 ok=false', () => {
    const envPath = writeEnvLocal(
      [
        'DATABASE_URL=postgresql://claudemanager:pw@127.0.0.1:5434/claudemanager_mtest',
        'CM_BACKGROUND_JOBS=off',
        'PORT=3110',
        SECRETS,
      ].join('\n')
    );
    const result = checkMtestEnv(envPath);
    expect(result.ok).toBe(false);
  });

  // --- BUG-001: 비밀값·클라이언트 포트 검증 ---
  describe('BUG-001 — 비밀값·NEXT_PUBLIC_WS_PORT 검증', () => {
    it('WS_BROADCAST_SECRET이 없으면 ok=false', () => {
      const envPath = writeEnvLocal(
        [
          'DATABASE_URL=postgresql://claudemanager:pw@127.0.0.1:5434/claudemanager_mtest',
          'CM_BACKGROUND_JOBS=off',
          'PORT=3110',
          'WS_PORT=3111',
          'NEXT_PUBLIC_WS_PORT=3111',
          'JWT_SECRET=mtest-only-jwt-secret',
        ].join('\n')
      );
      const result = checkMtestEnv(envPath);
      expect(result.ok).toBe(false);
      expect(result.reasons.some((r) => r.includes('WS_BROADCAST_SECRET'))).toBe(true);
    });

    it('WS_BROADCAST_SECRET이 코드 기본값과 같으면 ok=false', () => {
      const envPath = writeEnvLocal(
        [
          'DATABASE_URL=postgresql://claudemanager:pw@127.0.0.1:5434/claudemanager_mtest',
          'CM_BACKGROUND_JOBS=off',
          'PORT=3110',
          'WS_PORT=3111',
          'NEXT_PUBLIC_WS_PORT=3111',
          `WS_BROADCAST_SECRET=${DEFAULT_WS_BROADCAST_SECRET}`,
          'JWT_SECRET=mtest-only-jwt-secret',
        ].join('\n')
      );
      const result = checkMtestEnv(envPath);
      expect(result.ok).toBe(false);
      expect(result.reasons.some((r) => r.includes('WS_BROADCAST_SECRET') && r.includes('기본값'))).toBe(true);
    });

    it('JWT_SECRET이 없거나 코드 기본값과 같으면 ok=false', () => {
      const missing = writeEnvLocal(
        [
          'DATABASE_URL=postgresql://claudemanager:pw@127.0.0.1:5434/claudemanager_mtest',
          'CM_BACKGROUND_JOBS=off',
          'PORT=3110',
          'WS_PORT=3111',
          'NEXT_PUBLIC_WS_PORT=3111',
          'WS_BROADCAST_SECRET=mtest-only-broadcast-secret',
        ].join('\n')
      );
      expect(checkMtestEnv(missing).ok).toBe(false);

      const defaulted = writeEnvLocal(
        [
          'DATABASE_URL=postgresql://claudemanager:pw@127.0.0.1:5434/claudemanager_mtest',
          'CM_BACKGROUND_JOBS=off',
          'PORT=3110',
          'WS_PORT=3111',
          'NEXT_PUBLIC_WS_PORT=3111',
          'WS_BROADCAST_SECRET=mtest-only-broadcast-secret',
          `JWT_SECRET=${DEFAULT_JWT_SECRET}`,
        ].join('\n')
      );
      const result = checkMtestEnv(defaulted);
      expect(result.ok).toBe(false);
      expect(result.reasons.some((r) => r.includes('JWT_SECRET') && r.includes('기본값'))).toBe(true);
    });

    it('NEXT_PUBLIC_WS_PORT가 WS_PORT와 다르면 ok=false', () => {
      const envPath = writeEnvLocal(
        [
          'DATABASE_URL=postgresql://claudemanager:pw@127.0.0.1:5434/claudemanager_mtest',
          'CM_BACKGROUND_JOBS=off',
          'PORT=3110',
          'WS_PORT=3111',
          'NEXT_PUBLIC_WS_PORT=9999',
          SECRETS,
        ].join('\n')
      );
      const result = checkMtestEnv(envPath);
      expect(result.ok).toBe(false);
      expect(result.reasons.some((r) => r.includes('NEXT_PUBLIC_WS_PORT'))).toBe(true);
    });

    it('NEXT_PUBLIC_WS_PORT가 없으면(undefined !== WS_PORT) ok=false', () => {
      const envPath = writeEnvLocal(
        [
          'DATABASE_URL=postgresql://claudemanager:pw@127.0.0.1:5434/claudemanager_mtest',
          'CM_BACKGROUND_JOBS=off',
          'PORT=3110',
          'WS_PORT=3111',
          SECRETS,
        ].join('\n')
      );
      const result = checkMtestEnv(envPath);
      expect(result.ok).toBe(false);
    });
  });

  // --- BUG-001: 운영 .env.local과의 비교(선택 인자) ---
  describe('BUG-001 — 운영 .env.local과 비밀값·DB명 비교', () => {
    it('운영과 WS_BROADCAST_SECRET이 같으면 ok=false (값은 노출하지 않는다)', () => {
      const prodPath = writeEnvLocal(
        [
          'DATABASE_URL=postgresql://claudemanager:pw@127.0.0.1:5434/claudemanager',
          'WS_BROADCAST_SECRET=shared-secret-value',
          'JWT_SECRET=prod-only-jwt-secret',
        ].join('\n'),
        '.env.local'
      );
      const mtestPath = writeEnvLocal(
        [
          'DATABASE_URL=postgresql://claudemanager:pw@127.0.0.1:5434/claudemanager_mtest',
          'CM_BACKGROUND_JOBS=off',
          'PORT=3110',
          'WS_PORT=3111',
          'NEXT_PUBLIC_WS_PORT=3111',
          'WS_BROADCAST_SECRET=shared-secret-value', // 운영과 동일 — 실패해야 한다
          'JWT_SECRET=mtest-only-jwt-secret',
        ].join('\n')
      );

      const result = checkMtestEnv(mtestPath, prodPath);
      expect(result.ok).toBe(false);
      expect(result.reasons.some((r) => r.includes('WS_BROADCAST_SECRET') && r.includes('운영'))).toBe(true);
      // 값 자체(shared-secret-value)는 이유 목록에 노출되지 않는다
      expect(result.reasons.join('\n')).not.toContain('shared-secret-value');
    });

    it('운영과 DATABASE_URL의 DB명이 같으면 ok=false', () => {
      const prodPath = writeEnvLocal(
        [
          'DATABASE_URL=postgresql://claudemanager:pw@127.0.0.1:5434/claudemanager_mtest',
          'WS_BROADCAST_SECRET=prod-broadcast-secret',
          'JWT_SECRET=prod-jwt-secret',
        ].join('\n')
      );
      const mtestPath = writeEnvLocal(VALID_ENV);

      const result = checkMtestEnv(mtestPath, prodPath);
      expect(result.ok).toBe(false);
      expect(result.reasons.some((r) => r.includes('DATABASE_URL') && r.includes('운영'))).toBe(true);
    });

    it('운영 파일 경로가 주어졌지만 실제로 존재하지 않으면 비교를 건너뛴다(다른 조건이 맞으면 ok=true)', () => {
      const mtestPath = writeEnvLocal(VALID_ENV);
      const result = checkMtestEnv(mtestPath, '/tmp/does-not-exist-prod-env/.env.local');
      expect(result.ok).toBe(true);
    });

    it('모든 값이 운영과 다르면 ok=true', () => {
      const prodPath = writeEnvLocal(
        [
          'DATABASE_URL=postgresql://claudemanager:pw@127.0.0.1:5434/claudemanager',
          'WS_BROADCAST_SECRET=prod-broadcast-secret',
          'JWT_SECRET=prod-jwt-secret',
        ].join('\n')
      );
      const mtestPath = writeEnvLocal(VALID_ENV);
      const result = checkMtestEnv(mtestPath, prodPath);
      expect(result.ok).toBe(true);
    });
  });

  // --- BUG-003: Next.js 우선순위가 더 높은 env 파일이 있으면 검증이 무의미해진다 ---
  describe('BUG-003 — 더 높은 우선순위의 env 파일 존재 시 거부', () => {
    it('.env.development.local이 같은 디렉터리에 있으면 ok=false', () => {
      const envPath = writeEnvLocal(VALID_ENV);
      writeSibling(path.dirname(envPath), '.env.development.local', 'DATABASE_URL=postgresql://x:y@h/claudemanager');
      const result = checkMtestEnv(envPath);
      expect(result.ok).toBe(false);
      expect(result.reasons.some((r) => r.includes("'.env.development.local'"))).toBe(true);
    });

    it('.env.development이 같은 디렉터리에 있으면 ok=false', () => {
      const envPath = writeEnvLocal(VALID_ENV);
      writeSibling(path.dirname(envPath), '.env.development', '');
      const result = checkMtestEnv(envPath);
      expect(result.ok).toBe(false);
      expect(result.reasons.some((r) => r.includes("'.env.development'"))).toBe(true);
    });

    it('.env가 같은 디렉터리에 있으면 ok=false', () => {
      const envPath = writeEnvLocal(VALID_ENV);
      writeSibling(path.dirname(envPath), '.env', '');
      const result = checkMtestEnv(envPath);
      expect(result.ok).toBe(false);
      expect(result.reasons.some((r) => r.includes("'.env'"))).toBe(true);
    });

    it('더 높은 우선순위 파일이 없으면 이 검증 때문에 실패하지 않는다', () => {
      const envPath = writeEnvLocal(VALID_ENV);
      const result = checkMtestEnv(envPath);
      expect(result.ok).toBe(true);
    });
  });
});

describe('parseEnvFile', () => {
  it('주석·빈 줄을 무시하고 따옴표를 벗겨낸다', () => {
    const env = parseEnvFile(['# comment', '', 'FOO="bar"', "BAZ='qux'", 'PLAIN=value'].join('\n'));
    expect(env.get('FOO')).toBe('bar');
    expect(env.get('BAZ')).toBe('qux');
    expect(env.get('PLAIN')).toBe('value');
  });

  it('같은 키가 여러 번 있으면 마지막 값이 이긴다', () => {
    const env = parseEnvFile(['PORT=3000', 'PORT=3110'].join('\n'));
    expect(env.get('PORT')).toBe('3110');
  });

  // BUG-003: `export KEY=VALUE` 줄도 인식해야 한다
  it('export 접두사가 붙은 줄도 KEY=VALUE로 파싱한다', () => {
    const env = parseEnvFile(['export FOO=bar', 'export BAZ="qux"'].join('\n'));
    expect(env.get('FOO')).toBe('bar');
    expect(env.get('BAZ')).toBe('qux');
  });
});

describe('dbNameFromUrl', () => {
  it('마지막 / 뒤, ? 앞의 DB 이름을 뽑는다', () => {
    expect(dbNameFromUrl('postgresql://u:p@127.0.0.1:5434/claudemanager_mtest')).toBe(
      'claudemanager_mtest'
    );
    expect(
      dbNameFromUrl('postgresql://u:p@127.0.0.1:5434/claudemanager_mtest?sslmode=require')
    ).toBe('claudemanager_mtest');
  });

  it('올바른 URL이 아니면 null을 반환한다', () => {
    expect(dbNameFromUrl('not-a-url')).toBeNull();
  });
});

// SEC-002: DB 접속 URL의 비밀번호가 에러 메시지에 그대로 노출되면 안 된다
describe('maskDbUrl (SEC-002)', () => {
  it('scheme://user:password@host 형태의 비밀번호를 마스킹한다', () => {
    expect(maskDbUrl('postgresql://claudemanager:s3cr3t@127.0.0.1:5434/db')).toBe(
      'postgresql://claudemanager:***@127.0.0.1:5434/db'
    );
  });

  it('DATABASE_URL이 잘못된 형식일 때 검증 실패 사유에 비밀번호가 노출되지 않는다', () => {
    const envPath = writeEnvLocal(
      [
        // "://user:pass@"까지는 있지만 호스트가 없어 new URL()이 던지는 값 — 마스킹 경로를 태운다
        'DATABASE_URL=postgresql://claudemanager:s3cr3t@',
        'CM_BACKGROUND_JOBS=off',
        'PORT=3110',
        'WS_PORT=3111',
        'NEXT_PUBLIC_WS_PORT=3111',
        SECRETS,
      ].join('\n')
    );
    const result = checkMtestEnv(envPath);
    expect(result.ok).toBe(false);
    expect(result.reasons.join('\n')).not.toContain('s3cr3t');
  });
});
