/**
 * .env.local 의 PORT 로 Next 를 띄우는 래퍼.
 *
 * Next 는 앱 코드용으로 .env.local 을 읽지만, 그 시점은 **포트를 정한 뒤**다.
 * 그래서 PORT=3010 을 적어둬도 `next dev` 는 3000 을 잡으려 하고, 3000 이
 * 이미 쓰이는 이 장비에서는 3002 같은 엉뚱한 포트로 떠서 매번 접속이 어긋났다.
 *
 * `node --env-file=... next` 로 해결하려 했으나, Next 가 자식 프로세스를 띄우며
 * 그 플래그를 NODE_OPTIONS 로 넘겨 "not allowed in NODE_OPTIONS" 로 죽는다.
 * 그래서 여기서 직접 읽어 --port 로 넘긴다. 포트의 진실 소스는 .env.local 하나다.
 */
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

if (existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

const [command = 'dev', ...rest] = process.argv.slice(2);
const port = process.env.PORT || '3000';

// 사용자가 --port 를 직접 주면 그쪽을 존중한다
const hasExplicitPort = rest.some((a) => a === '-p' || a === '--port' || a.startsWith('--port='));
const args = [
  'node_modules/next/dist/bin/next',
  command,
  ...(hasExplicitPort ? [] : ['--port', port]),
  ...rest,
];

const child = spawn(process.execPath, args, { stdio: 'inherit' });
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
