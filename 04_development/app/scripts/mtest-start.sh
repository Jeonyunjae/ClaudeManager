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

if ! node "$APP_DIR/scripts/mtest-env-check.mjs" "$ENV_LOCAL"; then
  echo "[mtest-start] 안전 검증 실패로 기동을 거부한다 (DF-008 재발 방지)." >&2
  exit 1
fi

exec env -i HOME="$HOME" PATH="$PATH" USER="${USER:-}" LANG="${LANG:-C.UTF-8}" TERM=dumb \
  bash "$APP_DIR/scripts/pm2-start.sh"
