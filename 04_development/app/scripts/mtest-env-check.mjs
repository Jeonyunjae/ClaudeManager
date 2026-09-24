#!/usr/bin/env node
/**
 * 테스트 인스턴스(claudemanager-mtest) 기동 전 안전 검증 — DF-008 재발 방지.
 *
 * 사고 경위 (2026-09-24, DF-008): `pm2 start ecosystem.mtest.config.js`를
 * 운영 next-server의 자식 셸에서 실행했더니, 그 셸이 상속한 운영 env
 * (DATABASE_URL·JWT_SECRET·ENCRYPTION_KEY·HOOKS_SECRET·WS_PORT·PORT·
 * CLAUDEMANAGER_HOME·ORCHESTRATOR_DIR·CLAUDEMANAGER_API_URL·NODE_ENV·
 * NEXT_RUNTIME·__NEXT_PROCESSED_ENV·__NEXT_PRIVATE_ORIGIN 등)를 pm2 CLI가
 * 그대로 새 앱에 넘겼다. Next는 이미 있는 env를 `.env.local`로 덮지 않고,
 * `__NEXT_PROCESSED_ENV`가 있으면 env 파일 로딩 자체를 건너뛰므로
 * `CM_BACKGROUND_JOBS=off`도 무시되고 테스트 인스턴스가 운영 DB에 붙었다.
 *
 * 이 스크립트는 `scripts/mtest-start.sh`가 pm2-start.sh를 부르기 **전에**
 * 실행한다. `.env.local` 파일 내용만 읽어 검증하므로(프로세스에 상속된
 * env는 보지 않는다) 셸이 무엇을 상속했든 결과가 흔들리지 않는다.
 *
 * 검증 항목 (하나라도 어기면 실패):
 *   a) `.env.local`이 존재한다
 *   b) `DATABASE_URL`의 DB 이름(마지막 `/` 뒤, `?` 앞)이 정확히
 *      `claudemanager_mtest`다 (DES-001 §테스트 인스턴스 구성)
 *   c) `CM_BACKGROUND_JOBS=off`다
 *   d) 유효 `PORT`가 운영 포트(3010)와 다르고, 유효 `WS_PORT`가 운영 포트
 *      (3001)와 다르다. "유효"란 `.env.local`에 없으면 `scripts/pm2-start.sh`와
 *      같은 기본값(PORT=3000, WS_PORT=3001)을 적용한 값이다 — WS_PORT를
 *      비워두면 기본값이 하필 운영 WS 포트와 같아 충돌하므로, 값이 없는
 *      것도 실패로 본다.
 *
 * CLI 사용법:
 *   node scripts/mtest-env-check.mjs /path/to/.env.local
 *   정상: exit 0 (stdout에 확인 메시지). 위반: exit 1 (stderr에 이유 목록).
 *
 * 단위 테스트(src/__tests__/lib/mtest-env-check.test.ts)는 이 파일의
 * `checkMtestEnv()`를 /tmp 아래 가짜 `.env.local`로 직접 호출해 검증한다.
 */
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const TARGET_DB_NAME = 'claudemanager_mtest';
export const PROD_PORT = '3010';
export const PROD_WS_PORT = '3001';
const DEFAULT_PORT = '3000';
const DEFAULT_WS_PORT = '3001'; // scripts/pm2-start.sh의 기본값과 동일

/**
 * `.env.local` 형식(KEY=VALUE, `#` 주석, 빈 줄 무시)을 파싱한다.
 * 같은 키가 여러 번 나오면 마지막 값이 이긴다 — pm2-start.sh의
 * `grep ... | tail -1`과 같은 규칙이다. 값 양끝의 홑/겹따옴표는 벗겨낸다.
 *
 * @param {string} content
 * @returns {Map<string, string>}
 */
export function parseEnvFile(content) {
  const env = new Map();
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    value = value.replace(/^["']/, '').replace(/["']$/, '');
    env.set(key, value);
  }
  return env;
}

/**
 * DATABASE_URL에서 DB 이름을 뽑는다(마지막 `/` 뒤, `?` 앞).
 * `new URL()`을 쓰면 이 앱의 다른 스크립트(scripts/mtest-db-setup.mjs의
 * `dbNameOf`)와 같은 방식으로 pathname만 남아 querystring이 자동으로
 * 제외된다.
 *
 * @param {string} databaseUrl
 * @returns {string | null} 파싱 실패 시 null
 */
export function dbNameFromUrl(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    return url.pathname.replace(/^\//, '');
  } catch {
    return null;
  }
}

/**
 * `.env.local` 경로를 받아 DF-008 안전 검증을 수행한다.
 *
 * @param {string} envLocalPath
 * @returns {{ ok: boolean, reasons: string[] }}
 */
export function checkMtestEnv(envLocalPath) {
  if (!existsSync(envLocalPath)) {
    return { ok: false, reasons: [`.env.local이 없다: ${envLocalPath}`] };
  }

  const content = readFileSync(envLocalPath, 'utf8');
  const env = parseEnvFile(content);
  const reasons = [];

  const databaseUrl = env.get('DATABASE_URL');
  if (!databaseUrl) {
    reasons.push('DATABASE_URL이 .env.local에 없다.');
  } else {
    const dbName = dbNameFromUrl(databaseUrl);
    if (dbName === null) {
      reasons.push(`DATABASE_URL이 올바른 접속 URL이 아니다: ${databaseUrl}`);
    } else if (dbName !== TARGET_DB_NAME) {
      reasons.push(
        `DATABASE_URL의 DB 이름이 '${TARGET_DB_NAME}'가 아니다: '${dbName}' (운영 DB에 잘못 붙을 위험 — DF-008)`
      );
    }
  }

  const backgroundJobs = env.get('CM_BACKGROUND_JOBS');
  if (backgroundJobs !== 'off') {
    reasons.push(`CM_BACKGROUND_JOBS가 'off'가 아니다: '${backgroundJobs ?? '(없음)'}'`);
  }

  const port = env.get('PORT') || DEFAULT_PORT;
  if (port === PROD_PORT) {
    reasons.push(`PORT가 운영 포트(${PROD_PORT})와 같다 — 운영과 충돌한다.`);
  }

  const wsPort = env.get('WS_PORT') || DEFAULT_WS_PORT;
  if (wsPort === PROD_WS_PORT) {
    reasons.push(`WS_PORT가 운영 포트(${PROD_WS_PORT})와 같다 — 운영과 충돌한다.`);
  }

  return { ok: reasons.length === 0, reasons };
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  const envLocalPath = process.argv[2];
  if (!envLocalPath) {
    console.error('[mtest-env-check] 사용법: node scripts/mtest-env-check.mjs <.env.local 경로>');
    process.exit(1);
  }

  const result = checkMtestEnv(envLocalPath);
  if (result.ok) {
    console.log(`[mtest-env-check] 통과: ${envLocalPath}`);
    process.exit(0);
  } else {
    console.error(`[mtest-env-check] 검증 실패 (${envLocalPath}):`);
    for (const reason of result.reasons) {
      console.error(`  - ${reason}`);
    }
    process.exit(1);
  }
}
