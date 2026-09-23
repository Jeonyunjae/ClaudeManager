#!/usr/bin/env bash
#
# PM2 설정 스크립트 — Spark 워크스테이션(Linux)용
#
# 부팅 자동 기동은 `pm2 startup`(systemd 시스템 유닛) 대신 사용자 crontab 의
# @reboot 로 건다. `pm2 startup` 은 sudo 가 필요한데, Claude Code 세션은 TTY 가
# 없어 암호를 넣을 수 없다. 사용자 systemd 유닛은 linger 가 꺼져 있어(Linger=no)
# 로그인 전에는 뜨지 않는다. crontab @reboot 는 둘 다 필요 없다.
#
# 사용법:
#   ./scripts/setup-pm2.sh install    # PM2 설치 + 기동 + 저장 + 부팅 등록
#   ./scripts/setup-pm2.sh start      # PM2 로 기동
#   ./scripts/setup-pm2.sh stop       # 중지
#   ./scripts/setup-pm2.sh status     # 상태
#   ./scripts/setup-pm2.sh boot       # 부팅 자동 기동 등록 (crontab @reboot)
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
CM_HOME="${CLAUDEMANAGER_HOME:-$HOME/.claudemanager}"
CRON_TAG="# claudemanager-pm2"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }

do_install() {
  if ! command -v pm2 >/dev/null; then
    info "PM2 설치 (nvm 의 전역 경로, sudo 불필요)"
    npm install -g pm2
  fi
  mkdir -p "$CM_HOME/logs"
  do_start
  pm2 save
  do_boot
  info "완료. pm2 status / pm2 logs claudemanager / pm2 restart claudemanager"
}

do_start() {
  cd "$APP_DIR"
  pm2 start ecosystem.config.js
  pm2 status
}

do_stop() {
  pm2 stop claudemanager
  pm2 status
}

do_status() {
  pm2 status
}

do_boot() {
  # cron 은 로그인 셸이 아니라 nvm 이 PATH 에 없다 — 지금 쓰는 node 경로를 박아 둔다.
  # node 버전을 바꾸면 이 명령을 다시 실행해야 한다.
  local node_bin line
  node_bin="$(dirname "$(command -v pm2)")"
  line="@reboot PATH=$node_bin:/usr/bin:/bin pm2 resurrect >> $CM_HOME/logs/pm2-boot.log 2>&1 $CRON_TAG"
  { crontab -l 2>/dev/null | grep -vF "$CRON_TAG" || true; echo "$line"; } | crontab -
  info "crontab 등록: $line"
}

case "${1:-}" in
  install) do_install ;;
  start)   do_start ;;
  stop)    do_stop ;;
  status)  do_status ;;
  boot)    do_boot ;;
  *)
    sed -n '11,16p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
