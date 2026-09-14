#!/usr/bin/env bash
# 문서 검사 — (1) 값이 facts 밖에 하드코딩됐는지 (2) 개행이 이스케이프됐는지.
#
# 왜: DB 포트가 5433 인 채로 네 문서에 박혀 있었고, 실제 값은 5434 로 바뀐 지
# 오래였다. 문서대로 접속하면 이 장비의 5432 에 떠 있는 다른 프로젝트의 DB 에
# 붙는 상태였다. 값이 여러 곳에 있으면 반드시 이렇게 썩으므로, 한 곳 밖으로
# 새어나간 것을 기계가 찾는다.
#
# 코드 펜스(``` 블록) 안은 보지 않는다. 콘솔 출력 예시와 설정 조각은 숫자가
# 그대로 보여야 쓸모가 있고, 본문·표와 달리 "설명"이 아니라 "재현"이기 때문이다.
# 실제로 썩었던 5433 도 전부 본문과 표에 있었다.
#
# 사용: bash .scripts/check-doc-facts.sh
# 통과하면 exit 0, 새어나간 값이 있으면 위치를 출력하고 exit 1.

set -uo pipefail
cd "$(dirname "$0")/.."

FACTS="99_reference/📇 facts.md"

# 예외 — 값을 적어도 되는 곳
#   facts  : 단일 소스 그 자체
#   log.md : 지난 일의 기록. 과거 사실이므로 썩지 않는다
EXCLUDE_RE='(99_reference/📇 facts\.md|06_deployment/📜 log\.md)'

# 검사할 값은 facts 에서 읽는다 (여기에 숫자를 또 적으면 같은 실수를 반복한다)
ports=$(grep -oE '\*\*[0-9]{4}\*\*' "$FACTS" | tr -d '*' | sort -u)
host=$(grep -oE '192\.168\.[0-9]+\.[0-9]+' "$FACTS" | head -1)

violations=0

check() {  # check <값> <설명> <앵커>
  local value="$1" label="$2" anchor="$3" file line
  while IFS= read -r file; do
    [[ "$file" =~ $EXCLUDE_RE ]] && continue
    # 코드 펜스 밖의 줄만 남긴다
    while IFS= read -r line; do
      printf '%s : %s\n  %s\n  → 값을 지우고 [[📇 facts%s]] 로 가리킬 것\n' \
             "${file#./}" "$label" "$line" "$anchor"
      violations=$((violations + 1))
    done < <(awk '/^[[:space:]]*```/ { inside = !inside; next } !inside { print FNR": "$0 }' "$file" \
             | grep -F "$value")
  done < <(find . -name '*.md' -not -path './node_modules/*' -not -path '*/app/*' -print)
}

for p in $ports; do check "$p" "포트 $p" "#포트"; done
[ -n "$host" ] && check "$host" "랜 주소" "#호스트"

# 개행이 이스케이프된 채 저장된 문서를 잡는다.
#
# 왜: 문서 두 개가 `# 배포 피드백\n\n## 상태\n...` 처럼 한 줄로 저장돼 있었다.
# 마크다운으로 렌더되지 않아 내용이 있어도 읽을 수 없다. 생성한 스크립트는
# 저장소에 없고 커밋 시점의 일회성 사고였지만, 같은 방식으로 다시 들어오면
# 눈으로는 잘 안 보이므로(파일 크기가 작아 그냥 빈 템플릿처럼 보인다) 기계가 본다.
while IFS= read -r file; do
  [[ "$file" =~ $EXCLUDE_RE ]] && continue
  while IFS= read -r line; do
    printf '%s : 개행이 이스케이프됨 (한 줄로 저장)\n  %s\n  → 실제 개행으로 저장할 것\n' \
           "${file#./}" "$line"
    violations=$((violations + 1))
  done < <(awk '/^[[:space:]]*```/ { inside = !inside; next } !inside { print FNR": "$0 }' "$file" \
           | grep -F '\n' | grep -vF '`' | cut -c1-100)
done < <(find . -name '*.md' -not -path './node_modules/*' -not -path '*/app/*' -print)

if [ "$violations" -gt 0 ]; then
  echo
  echo "✖ 문서 문제 $violations 건."
  exit 1
fi

echo "✔ 값이 facts 한 곳에만 있다 (포트 $(echo $ports | tr '\n' ' '), 랜 주소 $host)"
