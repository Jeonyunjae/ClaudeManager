#!/usr/bin/env bash
#
# 테스트 인스턴스(claudemanager-mtest) 전용 기동 래퍼 — DF-008 재발 방지.
#
# 사고 경위 (2026-09-24): `pm2 start ecosystem.mtest.config.js`를 운영
# next-server의 자식 셸에서 실행하면, 그 셸이 상속한 운영 env
# (DATABASE_URL·JWT_SECRET·ENCRYPTION_KEY·HOOKS_SECRET·WS_PORT·PORT 등)를
# pm2 CLI가 새 앱 프로세스에 그대로 넘겼다. Next는 이미 있는 env를
# `.env.local`로 덮지 않고, `__NEXT_PROCESSED_ENV`가 있으면 env 파일 로딩을
# 건너뛰므로 CM_BACKGROUND_JOBS=off도 무시됐고, 테스트 인스턴스가 운영 DB에
# 붙었다.
#
# 대응:
#   1) 기동 전에 `.env.local` 내용만으로 안전 검증을 한다(상속 env는 보지
#      않는다 — scripts/mtest-env-check.mjs). 하나라도 위반하면 기동을
#      거부한다(exit 1).
#   2) 검증을 통과하면 `env -i`로 상속받은 모든 env를 비우고(HOME·PATH·
#      USER·LANG·TERM만 최소로 다시 채운다) 운영과 같은
#      `scripts/pm2-start.sh`를 그 깨끗한 환경에서 실행한다. Next가 이때
#      직접 `.env.local`을 읽으므로, 어떤 셸에서 pm2를 띄웠든 결과가
#      같아진다.
#
# ecosystem.mtest.config.js는 `filter_env: true`도 함께 켜서, pm2 CLI를
# 부른 셸의 env를 애초에 앱에 넘기지 않는다 — 이 스크립트는 그 안전장치가
# 없었거나 뚫렸을 경우를 대비한 두 번째 방어선이다.

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_LOCAL="$APP_DIR/.env.local"

# BUG-001: 운영 .env.local과 비밀값·DB명이 같은지 비교해 두 번째 안전망을 건다.
# 경로 하드코딩은 이 mtest 전용 스크립트에 한해서만 둔다 — 그 외 코드는 항상
# 환경변수/설정으로 경로를 받는다. MTEST_PROD_ENV_FILE이 환경에 있으면 그것을
# 우선하고, 없으면 이 기본 경로가 실제로 "존재할 때만" 비교에 쓴다(없는 환경에서
# 굳이 실패시키지 않기 위함 — mtest-env-check.mjs 쪽에서도 파일이 없으면 그냥
# 건너뛴다).
DEFAULT_PROD_ENV_FILE="/home/dmoa/Desktop/00.jyj/01.project/02.LLMManager/04_development/app/.env.local"
PROD_ENV_ARG="${MTEST_PROD_ENV_FILE:-}"
if [ -z "$PROD_ENV_ARG" ] && [ -f "$DEFAULT_PROD_ENV_FILE" ]; then
  PROD_ENV_ARG="$DEFAULT_PROD_ENV_FILE"
fi

if ! node "$APP_DIR/scripts/mtest-env-check.mjs" "$ENV_LOCAL" "$PROD_ENV_ARG"; then
  echo "[mtest-start] 안전 검증 실패로 기동을 거부한다 (DF-008 재발 방지)." >&2
  exit 1
fi

# BUG-015: env -i가 상속 env를 비우는 것(DF-008 격리 목적)은 유지하되, 실행에
# 꼭 필요한 실행 경로(PATH)까지 통째로 비워지면 안 된다. 이전에는 env -i에
# 넘기는 PATH="$PATH"가 이 스크립트를 부른 셸의 PATH를 그대로 썼는데, 그 셸에
# claude CLI 위치(~/.local/bin)가 없으면(예: 좁은 PATH로 재기동된 경우)
# src/lib/agent-manager.ts의 spawn('claude', ...)이 매 채팅마다 ENOENT로
# 실패했다(BUG-015). node 실행 경로와 ~/.local/bin(claude 바이너리 위치, 있을
# 때만)을 명시적으로 앞에 붙여, 어떤 셸에서 이 스크립트를 불렀든 CLI를 찾을 수
# 있게 한다.
NODE_BIN_DIR="$(dirname "$(command -v node)")"
CLAUDE_LOCAL_BIN="$HOME/.local/bin"
SAFE_PATH="$PATH"
if [ -d "$CLAUDE_LOCAL_BIN" ]; then
  SAFE_PATH="$CLAUDE_LOCAL_BIN:$SAFE_PATH"
fi
if [ -n "$NODE_BIN_DIR" ] && [ -d "$NODE_BIN_DIR" ]; then
  SAFE_PATH="$NODE_BIN_DIR:$SAFE_PATH"
fi

if ! command -v claude >/dev/null 2>&1 && [ ! -x "$CLAUDE_LOCAL_BIN/claude" ]; then
  echo "[mtest-start] 경고: claude CLI를 찾을 수 없다 (PATH: $SAFE_PATH) — chat 실행이 ENOENT로 실패할 수 있다 (BUG-015)." >&2
fi

exec env -i HOME="$HOME" PATH="$SAFE_PATH" USER="${USER:-}" LANG="${LANG:-C.UTF-8}" TERM=dumb \
  bash "$APP_DIR/scripts/pm2-start.sh"
