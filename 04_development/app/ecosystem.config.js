/**
 * PM2 설정 — Spark 워크스테이션 상시 기동용
 *
 * 왜 PM2 인가: Claude Code 세션이 `run_in_background` 로 띄운 서버는 그 세션의
 * 자식이라 세션이 끝날 때 함께 정리된다 (2026-09-23 실제로 이렇게 내려갔다).
 * PM2 데몬 밑에 두면 어느 세션이 띄우고 닫든 서버는 영향을 받지 않고,
 * 죽으면 자동으로 다시 뜬다.
 *
 * 왜 프로세스가 하나인가: WebSocket 서버는 Next 의 instrumentation 이 함께
 * 기동한다. WS 를 별도 앱으로 띄우면 3001 이 겹쳐 EADDRINUSE 가 난다.
 *
 * 왜 `dev` 인가: 현재 운영 형태가 `pnpm dev` 이고, 프로덕션 기동
 * (`next build && start`)은 아직 검증하지 않았다 (deploy-guide §6).
 *
 * 기동은 scripts/pm2-start.sh 가 한다 — .env.local 의 PORT 를 읽고, 비정상
 * 종료로 남은 이전 인스턴스(next-server 고아)가 포트를 잡고 있으면 먼저 치운다.
 * 치우지 않으면 새 인스턴스가 EADDRINUSE 로 재시작만 반복한다 (2026-09-23 재현).
 *
 * 메모리 상한(max_memory_restart)은 두지 않는다 — dev 서버는 수백 MB 를
 * 쉽게 넘어서 재시작이 반복된다.
 *
 * 사용:
 *   pm2 start ecosystem.config.js && pm2 save
 *   pm2 status | pm2 logs claudemanager | pm2 restart claudemanager
 */

const path = require('path');
const os = require('os');

const CM_HOME = process.env.CLAUDEMANAGER_HOME || path.join(os.homedir(), '.claudemanager');

module.exports = {
  apps: [
    {
      name: 'claudemanager',
      script: 'scripts/pm2-start.sh',
      interpreter: 'bash',
      cwd: __dirname,
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '30s',
      kill_timeout: 10000,
      watch: false,
      out_file: path.join(CM_HOME, 'logs', 'app-out.log'),
      error_file: path.join(CM_HOME, 'logs', 'app-error.log'),
      merge_logs: true,
      time: true,
    },
  ],
};
