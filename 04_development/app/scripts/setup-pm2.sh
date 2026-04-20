#!/usr/bin/env bash
#
# PM2 Setup Script for ClaudeManager
#
# Installs PM2 globally, starts the application, sets up auto-start with launchd.
#
# Usage:
#   ./scripts/setup-pm2.sh install    # Full setup
#   ./scripts/setup-pm2.sh start      # Start with PM2
#   ./scripts/setup-pm2.sh stop       # Stop all
#   ./scripts/setup-pm2.sh status     # Show status
#   ./scripts/setup-pm2.sh launchd    # Install launchd plist
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
PLIST_SRC="$APP_DIR/com.claudemanager.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/com.claudemanager.plist"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }

do_install() {
  info "Installing PM2 globally..."
  npm install -g pm2

  info "Building application..."
  cd "$APP_DIR"
  pnpm run build

  info "Building WebSocket server..."
  pnpm run ws:build 2>/dev/null || warn "ws:build skipped (tsconfig.ws.json may not exist)"

  info "Creating log directory..."
  mkdir -p "${CLAUDEMANAGER_HOME:-$APP_DIR}/logs"

  do_start

  info "Saving PM2 process list..."
  pm2 save

  info "Setup complete!"
  echo ""
  info "Commands:"
  echo "  pm2 status          — View process status"
  echo "  pm2 logs            — View logs"
  echo "  pm2 restart all     — Restart all"
  echo "  pm2 stop all        — Stop all"
  echo ""
  info "To enable auto-start on login, run:"
  echo "  ./scripts/setup-pm2.sh launchd"
}

do_start() {
  info "Starting ClaudeManager with PM2..."
  cd "$APP_DIR"
  pm2 start ecosystem.config.js
  pm2 status
}

do_stop() {
  info "Stopping all PM2 processes..."
  pm2 stop all
  pm2 status
}

do_status() {
  pm2 status
}

do_launchd() {
  if [[ ! -f "$PLIST_SRC" ]]; then
    warn "Plist template not found at $PLIST_SRC"
    exit 1
  fi

  info "Installing launchd plist..."
  mkdir -p "$HOME/Library/LaunchAgents"

  # Update the plist with actual username and PM2 path
  local PM2_PATH
  PM2_PATH=$(which pm2 2>/dev/null || echo "/usr/local/bin/pm2")
  local USERNAME
  USERNAME=$(whoami)
  local CM_HOME="${CLAUDEMANAGER_HOME:-$HOME/claudemanager}"

  sed -e "s|/usr/local/bin/pm2|$PM2_PATH|g" \
      -e "s|REPLACE_WITH_USERNAME|$USERNAME|g" \
      -e "s|/Users/REPLACE_WITH_USERNAME/claudemanager|$CM_HOME|g" \
      "$PLIST_SRC" > "$PLIST_DEST"

  info "Plist installed at $PLIST_DEST"

  # Load the plist
  launchctl unload "$PLIST_DEST" 2>/dev/null || true
  launchctl load "$PLIST_DEST"

  info "launchd agent loaded. ClaudeManager will auto-start on login."
}

case "${1:-}" in
  install) do_install ;;
  start)   do_start ;;
  stop)    do_stop ;;
  status)  do_status ;;
  launchd) do_launchd ;;
  *)
    echo "PM2 Setup for ClaudeManager"
    echo ""
    echo "Usage:"
    echo "  $0 install    Full setup (install PM2, build, start)"
    echo "  $0 start      Start with PM2"
    echo "  $0 stop       Stop all"
    echo "  $0 status     Show status"
    echo "  $0 launchd    Install macOS auto-start"
    exit 1
    ;;
esac
