#!/usr/bin/env node
/**
 * 관리자 비밀번호 재설정.
 *
 * 앱에는 재설정 경로가 없다 — `/setup` 은 계정이 0개일 때만 받고(AUTH_ALREADY_SETUP),
 * 로그인 후에 비밀번호를 바꾸는 화면도 없다. 그래서 비밀번호를 잊으면 DB 를 직접
 * 건드리는 수밖에 없는데, `users` 행을 지우고 `/setup` 을 다시 여는 방식은
 * 계정 삭제라 되돌릴 수 없다. 여기서는 행을 그대로 두고 `password_hash` 만
 * 덮어쓴다 — 실패해도 잃는 것이 없다.
 *
 * 비밀번호는 인자로 받지 않는다. 셸 히스토리와 `ps` 에 그대로 남기 때문이다.
 * TTY 에서 에코 없이 직접 입력받는다.
 *
 * 사용: node scripts/reset-password.mjs
 */
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const SALT_ROUNDS = 12; // src/lib/constants.ts 의 PASSWORD_SALT_ROUNDS 와 같아야 한다
const MIN_LENGTH = 4; // src/app/api/auth/setup/route.ts 와 같은 기준

function readEnvLocal() {
  const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  const m = raw.match(/^DATABASE_URL=(.*)$/m);
  if (!m) throw new Error('.env.local 에 DATABASE_URL 이 없다');
  return m[1].trim().replace(/^["']|["']$/g, '');
}

/** 에코 없이 한 줄을 받는다. 입력이 화면에 남지 않도록. */
function askHidden(prompt) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const onData = () => rl.output.write(`\x1B[2K\x1B[200D${prompt}`);
    process.stdout.write(prompt);
    rl.input.on('data', onData);
    rl.question('', (answer) => {
      rl.input.off('data', onData);
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

// 비밀번호를 받을 수 없는 환경이면 DB 에 붙기도 전에 멈춘다.
if (!process.stdin.isTTY) {
  console.error('TTY 가 필요하다 — 터미널에서 직접 실행할 것 (node scripts/reset-password.mjs)');
  process.exit(1);
}

const client = new pg.Client({ connectionString: readEnvLocal() });
await client.connect();

try {
  const { rows } = await client.query('select id, created_at from users order by id');
  if (rows.length === 0) {
    console.log('계정이 없다. 재설정할 것이 아니라 /setup 으로 처음 등록하면 된다.');
    process.exit(0);
  }
  if (rows.length > 1) {
    // 이 앱은 단일 관리자 계정을 전제로 한다. 여러 개면 무엇을 바꿔야 할지 알 수 없다.
    console.error(`계정이 ${rows.length}개다. 어느 것을 바꿀지 정해야 하므로 멈춘다:`);
    console.table(rows);
    process.exit(1);
  }

  const target = rows[0];
  console.log(`대상: users.id=${target.id} (생성 ${target.created_at})`);

  const password = await askHidden('새 비밀번호: ');
  if (password.length < MIN_LENGTH) {
    console.error(`비밀번호는 ${MIN_LENGTH}자 이상이어야 한다.`);
    process.exit(1);
  }
  const confirm = await askHidden('한 번 더: ');
  if (password !== confirm) {
    console.error('두 입력이 다르다.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  await client.query(
    'update users set password_hash = $1, updated_at = now()::text where id = $2',
    [hash, target.id]
  );
  console.log('완료. 기존 로그인 토큰은 그대로 유효하니, 다른 기기에서 쫓아내려면 JWT_SECRET 을 바꿔야 한다.');
} finally {
  await client.end();
}
