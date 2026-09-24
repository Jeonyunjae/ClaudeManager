/**
 * PM2 설정 — 테스트 인스턴스(claudemanager-mtest) 상시 기동용.
 *
 * 운영(`ecosystem.config.js`)과 같은 구조를 그대로 따른다. 다른 점은 앱 이름과
 * 로그 파일 경로뿐이다 — 포트·DB·CM_BACKGROUND_JOBS 등은 이 파일이 아니라
 * 이 앱의 작업 사본(별도 경로)에 있는 `.env.local`이 정한다
 * (DES-001 §테스트 인스턴스 구성, DES-009 §환경 변수).
 *
 * 왜 같은 `scripts/pm2-start.sh`를 쓰는가: 그 스크립트는 실행 시점의 cwd에서
 * `.env.local`을 읽어 PORT/WS_PORT를 얻는다(운영과 같은 스크립트를 그대로 복사해도
 * 각자의 `.env.local`을 보고 각자의 포트로 뜬다). 포트를 잡은 프로세스를 정리할 때도
 * "작업 디렉터리가 이 앱일 때만" 죽이므로, 운영 앱(다른 경로에서 기동)과는 절대
 * 겹치지 않는다.
 *
 * 앱 이름은 `claudemanager-mtest`로 운영(`claudemanager`)과 다르게 둔다 — pm2가
 * 이름으로 구분하므로 `pm2 restart claudemanager`가 이 앱을 건드릴 일이 없다.
 *
 * 로그는 운영과 겹치지 않게 파일명에 `mtest-` 접두사를 붙이고, 운영과 같은
 * `~/.claudemanager/logs/` 아래에 둔다(홈 디렉터리 고정 — 테스트 인스턴스의
 * `CLAUDEMANAGER_HOME=/tmp/cm-mtest`와는 무관하다. 그건 앱이 스킬·오케스트레이터
 * 데이터를 두는 곳이고, pm2 로그는 항상 사람이 보는 홈 디렉터리에 남긴다).
 *
 * 사용:
 *   pm2 start ecosystem.mtest.config.js && pm2 save
 *   pm2 status | pm2 logs claudemanager-mtest | pm2 restart claudemanager-mtest
 */

// pm2가 이 파일을 CommonJS로 읽는다 (package.json에 "type": "module"이 없다) —
// ecosystem.config.js와 같은 이유로 require를 그대로 쓴다.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const os = require('os');

const LOG_DIR = path.join(os.homedir(), '.claudemanager', 'logs');

module.exports = {
  apps: [
    {
      name: 'claudemanager-mtest',
      script: 'scripts/pm2-start.sh',
      interpreter: 'bash',
      cwd: __dirname,
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '30s',
      kill_timeout: 10000,
      watch: false,
      out_file: path.join(LOG_DIR, 'mtest-out.log'),
      error_file: path.join(LOG_DIR, 'mtest-error.log'),
      merge_logs: true,
      time: true,
    },
  ],
};
