import fs from 'node:fs';
import path from 'node:path';
import type { Config } from 'drizzle-kit';

/**
 * drizzle-kit 은 Next 와 달리 .env.local 을 읽지 않는다.
 * 그래서 DATABASE_URL 이 비어 폴백(localhost:5432)으로 붙었고, 그 포트에는
 * 다른 프로젝트의 Postgres 가 떠 있어 인증 실패로 죽었다. 게다가 스피너가
 * 에러 줄을 덮어써서 화면에는 아무 메시지 없이 종료된 것처럼 보였다.
 * 마이그레이션이 통째로 누락된 채 앱이 뜨는 사고로 이어지므로 여기서 직접 읽는다.
 */
function loadEnvLocal(): void {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;                       // 주석·빈 줄
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;  // 셸에서 준 값이 우선
    process.env[key] = rawValue.trim().replace(/^(['"])(.*)\1$/, '$2');
  }
}

loadEnvLocal();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL 이 없다. .env.local 을 확인할 것 (폴백으로 조용히 엉뚱한 DB 에 붙지 않는다).');
}

export default {
  schema: './src/lib/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
} satisfies Config;
