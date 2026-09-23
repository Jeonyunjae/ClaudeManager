#!/usr/bin/env bash
#
# PM2 가 부르는 기동 스크립트 — 남은 인스턴스를 치우고 Next dev 를 띄운다.
#
# 왜 필요한가: `next dev` 는 next-server 자식을 따로 띄운다. 부모가 비정상
# 종료(kill -9·크래시)하면 자식이 고아로 남아 3010/3001 을 계속 잡고, PM2 가
# 새로 띄우는 인스턴스는 EADDRINUSE 로 재시작만 반복한다 (2026-09-23 재현).
# 고아를 막을 방법은 없으므로, 기동할 때마다 먼저 치운다.
#
# 안전장치: 포트를 잡은 프로세스라도 작업 디렉터리가 이 앱일 때만 죽인다.
# 3000 의 Open WebUI 처럼 남의 프로세스가 포트를 잡고 있으면 건드리지 않고 실패한다.
#
# 포트의 진실 소스는 .env.local 이다 (next-with-env.mjs 와 같은 이유).

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

env_value() { grep -E "^$1=" .env.local 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"'"'"; }
PORT="$(env_value PORT)"; PORT="${PORT:-3000}"
WS_PORT="$(env_value WS_PORT)"; WS_PORT="${WS_PORT:-3001}"

stale_pids() {
  local port pid
  for port in "$PORT" "$WS_PORT"; do
    for pid in $(ss -ltnpH "sport = :$port" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u); do
      [[ "$(readlink "/proc/$pid/cwd" 2>/dev/null)" == "$APP_DIR" ]] && echo "$pid"
    done
  done | sort -u
}

pids="$(stale_pids)"
if [[ -n "$pids" ]]; then
  echo "[pm2-start] 이전 인스턴스가 포트를 잡고 있어 정리한다: $(echo $pids)"
  kill $pids 2>/dev/null || true
  for _ in $(seq 1 20); do [[ -z "$(stale_pids)" ]] && break; sleep 0.5; done
  pids="$(stale_pids)"
  [[ -n "$pids" ]] && kill -9 $pids 2>/dev/null || true
fi

exec node node_modules/next/dist/bin/next dev --port "$PORT"
