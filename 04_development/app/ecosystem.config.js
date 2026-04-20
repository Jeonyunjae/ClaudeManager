/**
 * PM2 Ecosystem Configuration for ClaudeManager
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 stop all
 *   pm2 restart all
 *   pm2 logs
 */

const path = require('path');

const CM_HOME = process.env.CLAUDEMANAGER_HOME || __dirname;

module.exports = {
  apps: [
    {
      name: 'cm-next',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        CLAUDEMANAGER_HOME: CM_HOME,
      },
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      watch: false,
      max_memory_restart: '500M',
      log_file: path.join(CM_HOME, 'logs', 'next.log'),
      error_file: path.join(CM_HOME, 'logs', 'next-error.log'),
      out_file: path.join(CM_HOME, 'logs', 'next-out.log'),
      merge_logs: true,
      time: true,
    },
    {
      name: 'cm-ws',
      script: 'dist/server/start-ws.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        WS_PORT: 3001,
        CLAUDEMANAGER_HOME: CM_HOME,
      },
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      watch: false,
      max_memory_restart: '300M',
      log_file: path.join(CM_HOME, 'logs', 'ws.log'),
      error_file: path.join(CM_HOME, 'logs', 'ws-error.log'),
      out_file: path.join(CM_HOME, 'logs', 'ws-out.log'),
      merge_logs: true,
      time: true,
    },
  ],
};
