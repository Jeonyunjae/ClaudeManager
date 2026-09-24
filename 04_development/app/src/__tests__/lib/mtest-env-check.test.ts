/**
 * scripts/mtest-env-check.mjs 단위 테스트 — DF-008 재발 방지.
 * 대상 기능: 테스트 인스턴스(claudemanager-mtest) 기동 전 `.env.local` 안전 검증
 * 수용 기준(사고 보고서 DF-008):
 *   - 운영 env를 상속한 셸에서 기동해도, `.env.local`의 DATABASE_URL이
 *     정확히 `claudemanager_mtest`가 아니면 검증은 실패(ok=false)를 반환한다.
 *   - CM_BACKGROUND_JOBS=off가 아니면 실패한다.
 *   - PORT=3010(운영) 또는 WS_PORT=3001(운영)이면(또는 WS_PORT 누락으로
 *     기본값이 3001이 되면) 실패한다.
 *   - 모두 만족하면 ok=true, reasons=[]를 반환한다.
 *
 * 검증 대상은 순수 함수(파일 경로만 받는다)라 실제 pm2/DB/서버를 건드리지
 * 않는다. /tmp 아래에 가짜 .env.local을 만들어 직접 호출한다.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkMtestEnv, parseEnvFile, dbNameFromUrl } from '../../../scripts/mtest-env-check.mjs';

const tmpDirs: string[] = [];

function writeEnvLocal(content: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'mtest-env-check-'));
  tmpDirs.push(dir);
  const filePath = path.join(dir, '.env.local');
  writeFileSync(filePath, content, 'utf8');
  return filePath;
}

afterEach(() => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

const VALID_ENV = [
  'DATABASE_URL=postgresql://claudemanager:pw@127.0.0.1:5434/claudemanager_mtest',
  'CM_BACKGROUND_JOBS=off',
  'PORT=3110',
  'WS_PORT=3111',
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
      ].join('\n')
    );
    const result = checkMtestEnv(envPath);
    expect(result.ok).toBe(false);
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
