#!/usr/bin/env node
/**
 * 테스트 인스턴스(claudemanager-mtest) DB 준비 스크립트 — 수동 실행용.
 *
 * 하는 일 (DES-001 §테스트 인스턴스 구성, §리스크 대응 RISK-02):
 *   1. `MTEST_ADMIN_URL`(같은 Postgres 서버의 기존 DB — 운영 `claudemanager` 등)로
 *      접속해 `claudemanager_mtest` 데이터베이스가 없으면 만든다.
 *   2. `DATABASE_URL`(반드시 `.../claudemanager_mtest`)로 기존 drizzle 마이그레이션
 *      (`drizzle-kit migrate`, `drizzle.config.ts` 그대로 재사용)을 적용한다.
 *   3. 테스트 전용 에이전트 2개(Main 1, Sub 1 — parent = Main)를 없을 때만 시드한다.
 *      작업 폴더는 `/tmp/cm-mtest/work` (없으면 만든다).
 *
 * 안전장치: `DATABASE_URL`의 데이터베이스 이름이 정확히 `claudemanager_mtest`가
 * 아니면 아무것도 하지 않고 즉시 중단한다 — 운영 DB(`claudemanager`)를 잘못 겨냥해
 * 마이그레이션·시드를 돌리는 사고를 막기 위함이다.
 *
 * 이 스크립트는 운영 DB에 절대 연결하지 않는다. `MTEST_ADMIN_URL`은 CREATE
 * DATABASE 권한 확인용으로 같은 서버의 "기존" DB(예: 운영 `claudemanager`)에
 * 붙지만, 거기서 실행하는 쿼리는 `pg_database` 조회와 `CREATE DATABASE`뿐이고
 * 대상 DB 이름은 이 스크립트 안에 하드코딩된 `claudemanager_mtest`뿐이다.
 *
 * 사용법:
 *   MTEST_ADMIN_URL="postgresql://claudemanager:claudemanager@127.0.0.1:5434/claudemanager" \
 *   DATABASE_URL="postgresql://claudemanager:claudemanager@127.0.0.1:5434/claudemanager_mtest" \
 *   node scripts/mtest-db-setup.mjs
 *
 * 로그인: 새로 만든 `claudemanager_mtest`는 `users` 테이블이 비어 있다. 이 앱은
 * 계정이 0개일 때 `/setup` 화면에서 최초 비밀번호를 등록하게 되어 있다
 * (`src/app/api/auth/setup/route.ts`) — 이 스크립트는 그 상태를 그대로 두고
 * 계정을 만들지 않는다. `claudemanager-mtest` PM2 앱을 띄운 뒤 브라우저로
 * `/setup`에 들어가면 된다.
 */
import pg from 'pg';
import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.join(__dirname, '..');

const TARGET_DB_NAME = 'claudemanager_mtest';
const WORK_DIR = '/tmp/cm-mtest/work';

const MTEST_ADMIN_URL = process.env.MTEST_ADMIN_URL;
const DATABASE_URL = process.env.DATABASE_URL;

function fail(message) {
  console.error(`[mtest-db-setup] ${message}`);
  process.exit(1);
}

function dbNameOf(connectionString, label) {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    fail(`${label}이(가) 올바른 접속 URL이 아니다: ${connectionString}`);
  }
  return url.pathname.replace(/^\//, '');
}

async function ensureDatabaseExists() {
  const client = new pg.Client({ connectionString: MTEST_ADMIN_URL });
  await client.connect();
  try {
    const { rows } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [TARGET_DB_NAME]);
    if (rows.length > 0) {
      console.log(`[mtest-db-setup] DB "${TARGET_DB_NAME}"가 이미 있다. 건너뛴다.`);
      return;
    }
    // TARGET_DB_NAME은 위에서 검증한 상수 리터럴이다 — 사용자 입력을 그대로 SQL에 꽂지 않는다.
    await client.query(`CREATE DATABASE "${TARGET_DB_NAME}"`);
    console.log(`[mtest-db-setup] DB "${TARGET_DB_NAME}"를 만들었다.`);
  } finally {
    await client.end();
  }
}

function runMigrations() {
  return new Promise((resolve, reject) => {
    // 기존 `pnpm db:migrate` (= drizzle-kit migrate)와 같은 명령을 그대로 쓴다.
    // drizzle.config.ts가 process.env.DATABASE_URL을 최우선으로 읽으므로
    // (.env.local은 이미 세팅된 값이 있으면 건너뛴다), 여기서 검증을 마친
    // DATABASE_URL(claudemanager_mtest)이 그대로 적용된다.
    const drizzleKitBin = path.join(APP_DIR, 'node_modules', '.bin', 'drizzle-kit');
    const child = execFile(drizzleKitBin, ['migrate'], {
      cwd: APP_DIR,
      env: process.env,
      maxBuffer: 1024 * 1024 * 10,
    }, (error, stdout, stderr) => {
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
      if (error) {
        reject(new Error(`drizzle-kit migrate 실패: ${error.message}`));
        return;
      }
      resolve();
    });
    child.on('error', reject);
  });
}

async function seedAgent(client, { role, name, parentId }) {
  const { rows: existingRows } = await client.query(
    'SELECT id FROM agents WHERE role = $1 LIMIT 1',
    [role]
  );
  if (existingRows.length > 0) {
    console.log(`[mtest-db-setup] role='${role}' 에이전트가 이미 있다 (id=${existingRows[0].id}). 건너뛴다.`);
    return existingRows[0].id;
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  await client.query(
    `INSERT INTO agents (id, name, role, status, parent_id, model_name, project_root, created_at, updated_at)
     VALUES ($1, $2, $3, 'idle', $4, $5, $6, $7, $7)`,
    [id, name, role, parentId ?? null, role === 'main' ? 'opus' : 'sonnet', WORK_DIR, now]
  );
  console.log(`[mtest-db-setup] role='${role}' 에이전트를 만들었다 (id=${id}).`);
  return id;
}

async function seedTestAgents() {
  await mkdir(WORK_DIR, { recursive: true });
  console.log(`[mtest-db-setup] 작업 폴더 준비: ${WORK_DIR}`);

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const mainId = await seedAgent(client, { role: 'main', name: 'Main (mtest)' });
    await seedAgent(client, { role: 'sub', name: 'Sub (mtest)', parentId: mainId });
  } finally {
    await client.end();
  }
}

async function main() {
  if (!MTEST_ADMIN_URL) fail('MTEST_ADMIN_URL 환경변수가 필요하다 (같은 Postgres 서버의 기존 DB 접속 URL).');
  if (!DATABASE_URL) fail('DATABASE_URL 환경변수가 필요하다 (.../claudemanager_mtest).');

  const targetName = dbNameOf(DATABASE_URL, 'DATABASE_URL');
  if (targetName !== TARGET_DB_NAME) {
    fail(
      `DATABASE_URL의 DB 이름이 "${targetName}"다. 정확히 "${TARGET_DB_NAME}"가 아니면 ` +
      `운영 DB를 잘못 건드릴 위험이 있어 중단한다.`
    );
  }

  const adminName = dbNameOf(MTEST_ADMIN_URL, 'MTEST_ADMIN_URL');
  if (adminName === TARGET_DB_NAME) {
    fail(
      `MTEST_ADMIN_URL이 "${TARGET_DB_NAME}"를 가리킨다. CREATE DATABASE 확인용으로는 ` +
      `이미 존재하는 다른 DB(예: 운영 claudemanager)에 접속해야 한다.`
    );
  }

  await ensureDatabaseExists();
  await runMigrations();
  await seedTestAgents();

  console.log('[mtest-db-setup] 완료.');
  console.log(`[mtest-db-setup] "${TARGET_DB_NAME}"의 users 테이블은 비어 있다 — claudemanager-mtest 를 띄운 뒤 /setup 에서 최초 비밀번호를 등록할 것.`);
}

main().catch((error) => {
  console.error('[mtest-db-setup] 실패:', error.message);
  process.exit(1);
});
