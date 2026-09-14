#!/usr/bin/env bash
# 기동 상태 점검 — 포트·응답·백업.
#
# 검사할 값(포트·랜 주소)은 facts 문서에서 읽는다. 스크립트에 숫자를 적으면
# 그것이 또 하나의 "값이 적힌 곳"이 되어 같은 방식으로 썩는다.
#
# 사용: bash .scripts/check-runtime.sh

set -uo pipefail
cd "$(dirname "$0")/.."

FACTS="99_reference/📇 facts.md"
row_port() { grep -E "^\| $1 " "$FACTS" | grep -oE '[0-9]{4}' | head -1; }

web=$(row_port '웹 앱')
ws=$(row_port 'WebSocket')
pg=$(row_port 'PostgreSQL')
host=$(grep -oE '192\.168\.[0-9]+\.[0-9]+' "$FACTS" | head -1)
backup_dir="$HOME/.claudemanager/backups"

fail=0
ok()   { printf '  ✔ %s\n' "$1"; }
bad()  { printf '  ✖ %s\n' "$1"; fail=$((fail+1)); }

echo "포트"
for pair in "웹 앱:$web" "WebSocket:$ws" "PostgreSQL:$pg"; do
  name=${pair%%:*}; port=${pair##*:}
  if ss -ltn 2>/dev/null | grep -qE "[:.]$port\b"; then ok "$name $port LISTEN"
  else bad "$name $port 안 떠 있음"; fi
done

echo "응답"
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://$host:$web/" 2>/dev/null)
[ "$code" = "200" ] && ok "http://$host:$web → 200" || bad "http://$host:$web → ${code:-연결 실패}"

echo "백업"
# 크기로 본다 — 0바이트 덤프가 completed 로 기록되던 버그가 있었으므로
# DB 기록만 믿지 않는다
latest=$(ls -t "$backup_dir"/db-*.sql 2>/dev/null | head -1)
if [ -z "$latest" ]; then
  bad "덤프 파일 없음 ($backup_dir)"
else
  size=$(stat -c %s "$latest")
  age=$(( ( $(date +%s) - $(stat -c %Y "$latest") ) / 3600 ))
  [ "$size" -gt 0 ] && ok "$(basename "$latest") ${size}B (${age}시간 전)" \
                    || bad "$(basename "$latest") 가 0바이트"
  [ "$age" -gt 48 ] && bad "최근 백업이 ${age}시간 전 — 스케줄러 확인 필요"
fi

echo
[ "$fail" -eq 0 ] && echo "✔ 이상 없음" || echo "✖ $fail 건 이상"
exit $((fail > 0))
