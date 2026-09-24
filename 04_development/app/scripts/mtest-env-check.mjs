#!/usr/bin/env node
/**
 * 테스트 인스턴스(claudemanager-mtest) 기동 전 안전 검증 — DF-008 재발 방지 + BUG-001/BUG-003/SEC-002.
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
 * 후속 사고 (BUG-001 / DF-013): `.env.local`의 `WS_PORT`가 운영과 다른 값이어도
 * `src/lib/ws-bridge.ts`가 코드 상수 3001을 그대로 썼다 — 즉 값 자체가 옳은지
 * 검증하는 것만으로는 부족하고, **서버 프로세스 안의 브리지가 실제로 그 값을
 * 읽어 쓰는지**(코드 수정, 이 커밋에서 처리)와 **비밀값·클라이언트 포트가 운영과
 * 겹치지 않는지**를 함께 검증해야 한다.
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
 *   e) (BUG-001) `WS_BROADCAST_SECRET`·`JWT_SECRET`이 있고, 코드의 fallback
 *      기본값(`ws-server.ts`·`lib/auth.ts`)과 같지 않다 — 기본값 그대로면
 *      운영과 우연히 같아질 위험이 크다.
 *   f) (BUG-001) `NEXT_PUBLIC_WS_PORT`가 `WS_PORT`와 같다 — 다르면 브라우저가
 *      엉뚱한 포트로 WS 접속을 시도한다.
 *   g) (BUG-003) 같은 디렉터리에 Next.js가 `.env.local`보다 **먼저** 적용하는
 *      파일(`.env.development.local`·`.env.development`·`.env`)이 있으면 실패한다
 *      — 있으면 `.env.local`을 아무리 옳게 채워도 무시될 수 있다(fail-open).
 *   h) (BUG-001, 선택) `prodEnvPath`(운영 `.env.local` 경로)가 주어지고 실제로
 *      존재하면, 그 파일의 `WS_BROADCAST_SECRET`·`JWT_SECRET`·`DATABASE_URL` DB명과
 *      **달라야** 한다. 값 자체는 절대 출력하지 않고 "동일함" 사실만 알린다.
 *
 * CLI 사용법:
 *   node scripts/mtest-env-check.mjs /path/to/.env.local [/path/to/운영/.env.local]
 *   prodEnvPath는 생략하면 환경변수 `MTEST_PROD_ENV_FILE`을 대신 본다(둘 다 없으면
 *   h) 검증은 건너뛴다). 정상: exit 0 (stdout에 확인 메시지). 위반: exit 1 (stderr에 이유 목록).
 *
 * 단위 테스트(src/__tests__/lib/mtest-env-check.test.ts)는 이 파일의
 * `checkMtestEnv()`를 /tmp 아래 가짜 `.env.local`로 직접 호출해 검증한다.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const TARGET_DB_NAME = 'claudemanager_mtest';
export const PROD_PORT = '3010';
export const PROD_WS_PORT = '3001';
const DEFAULT_PORT = '3000';
const DEFAULT_WS_PORT = '3001'; // scripts/pm2-start.sh의 기본값과 동일

/** 코드 상의 fallback 기본값 — `src/server/ws-server.ts`·`src/lib/ws-bridge.ts`·`src/lib/auth.ts` 참고 (BUG-001) */
export const DEFAULT_WS_BROADCAST_SECRET = 'claudemanager-ws-internal';
export const DEFAULT_JWT_SECRET = 'claudemanager-dev-secret-change-in-production';

/** Next.js가 `.env.local`보다 먼저 적용하는(=우선순위가 더 높은) 파일들 (BUG-003) */
const HIGHER_PRIORITY_ENV_FILES = ['.env.development.local', '.env.development', '.env'];

/**
 * DB 접속 URL의 비밀번호를 마스킹한다 (SEC-002) — 로그·에러 메시지에 그대로 찍히지 않게 한다.
 * `scheme://user:password@host` 형태를 `scheme://user:***@host`로 바꾼다.
 *
 * @param {string} text
 * @returns {string}
 */
export function maskDbUrl(text) {
  return String(text).replace(/:\/\/([^:@/\s]+):([^@\s]*)@/g, '://$1:***@');
}

/**
 * `.env.local` 형식(KEY=VALUE, `#` 주석, 빈 줄 무시)을 파싱한다.
 * 같은 키가 여러 번 나오면 마지막 값이 이긴다 — pm2-start.sh의
 * `grep ... | tail -1`과 같은 규칙이다. 값 양끝의 홑/겹따옴표는 벗겨낸다.
 * `export KEY=VALUE`처럼 `export ` 접두사가 붙은 줄도 인식한다 (BUG-003).
 *
 * @param {string} content
 * @returns {Map<string, string>}
 */
export function parseEnvFile(content) {
  const env = new Map();
  for (const rawLine of content.split('\n')) {
    let line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('export ')) {
      line = line.slice('export '.length).trim();
    }
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
 * `.env.local` 경로(및 선택적으로 운영 `.env.local` 경로)를 받아 안전 검증을 수행한다.
 *
 * @param {string} envLocalPath
 * @param {string} [prodEnvPath] 운영 `.env.local` 경로 — 주어지고 실제로 존재하면 비밀값·DB명을 비교한다 (BUG-001)
 * @returns {{ ok: boolean, reasons: string[] }}
 */
export function checkMtestEnv(envLocalPath, prodEnvPath) {
  if (!existsSync(envLocalPath)) {
    return { ok: false, reasons: [`.env.local이 없다: ${envLocalPath}`] };
  }

  const content = readFileSync(envLocalPath, 'utf8');
  const env = parseEnvFile(content);
  const reasons = [];

  // BUG-003: .env.local보다 우선순위가 높은 파일이 같은 디렉터리에 있으면 검증 자체가 무의미해진다.
  const dir = dirname(envLocalPath);
  for (const fname of HIGHER_PRIORITY_ENV_FILES) {
    if (existsSync(join(dir, fname))) {
      reasons.push(
        `Next.js가 .env.local보다 먼저 적용하는 '${fname}' 파일이 있다 — 검증을 통과해도 실제로는 그 파일 값이 쓰일 수 있다 (BUG-003).`
      );
    }
  }

  const databaseUrl = env.get('DATABASE_URL');
  let dbName = null;
  if (!databaseUrl) {
    reasons.push('DATABASE_URL이 .env.local에 없다.');
  } else {
    dbName = dbNameFromUrl(databaseUrl);
    if (dbName === null) {
      reasons.push(`DATABASE_URL이 올바른 접속 URL이 아니다: ${maskDbUrl(databaseUrl)}`);
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

  // BUG-001: 브리지·WS 서버 내부 인증 비밀값이 코드 기본값 그대로면 안 된다.
  const wsBroadcastSecret = env.get('WS_BROADCAST_SECRET');
  if (!wsBroadcastSecret) {
    reasons.push('WS_BROADCAST_SECRET이 .env.local에 없다.');
  } else if (wsBroadcastSecret === DEFAULT_WS_BROADCAST_SECRET) {
    reasons.push('WS_BROADCAST_SECRET이 코드 기본값(fallback)과 같다 — 반드시 별도 값을 설정해야 한다.');
  }

  const jwtSecret = env.get('JWT_SECRET');
  if (!jwtSecret) {
    reasons.push('JWT_SECRET이 .env.local에 없다.');
  } else if (jwtSecret === DEFAULT_JWT_SECRET) {
    reasons.push('JWT_SECRET이 코드 기본값(fallback)과 같다 — 반드시 별도 값을 설정해야 한다.');
  }

  // BUG-001: 클라이언트(NEXT_PUBLIC_WS_PORT)와 서버(WS_PORT)가 어긋나면 브라우저가 WS 접속에 실패한다.
  const nextPublicWsPort = env.get('NEXT_PUBLIC_WS_PORT');
  if (nextPublicWsPort !== wsPort) {
    reasons.push(
      `NEXT_PUBLIC_WS_PORT('${nextPublicWsPort ?? '(없음)'}')가 WS_PORT('${wsPort}')와 다르다 — 브라우저가 다른 포트로 WS 접속을 시도한다.`
    );
  }

  // BUG-001: 운영 .env.local과 비밀값·DB명이 같으면(값은 출력하지 않는다) 실패로 본다.
  if (prodEnvPath && existsSync(prodEnvPath)) {
    const prodEnv = parseEnvFile(readFileSync(prodEnvPath, 'utf8'));

    const prodBroadcastSecret = prodEnv.get('WS_BROADCAST_SECRET');
    if (wsBroadcastSecret && prodBroadcastSecret && wsBroadcastSecret === prodBroadcastSecret) {
      reasons.push('WS_BROADCAST_SECRET이 운영 .env.local과 동일함 — 반드시 달라야 한다 (BUG-001).');
    }

    const prodJwtSecret = prodEnv.get('JWT_SECRET');
    if (jwtSecret && prodJwtSecret && jwtSecret === prodJwtSecret) {
      reasons.push('JWT_SECRET이 운영 .env.local과 동일함 — 반드시 달라야 한다 (BUG-001).');
    }

    const prodDatabaseUrl = prodEnv.get('DATABASE_URL');
    const prodDbName = prodDatabaseUrl ? dbNameFromUrl(prodDatabaseUrl) : null;
    if (dbName && prodDbName && dbName === prodDbName) {
      reasons.push('DATABASE_URL의 DB 이름이 운영 .env.local과 동일함 — 반드시 달라야 한다 (BUG-001).');
    }
  }

  return { ok: reasons.length === 0, reasons };
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  const envLocalPath = process.argv[2];
  const prodEnvPath = process.argv[3] || process.env.MTEST_PROD_ENV_FILE || undefined;
  if (!envLocalPath) {
    console.error('[mtest-env-check] 사용법: node scripts/mtest-env-check.mjs <.env.local 경로> [운영 .env.local 경로]');
    process.exit(1);
  }

  const result = checkMtestEnv(envLocalPath, prodEnvPath);
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
