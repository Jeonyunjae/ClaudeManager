#!/bin/bash
PROJECT_PATH="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="$1"
MISSING=0

check_file() {
  if [ ! -f "$1" ]; then
    echo "  ❌ 누락: $1"
    MISSING=$((MISSING+1))
  else
    SIZE=$(wc -c < "$1" | tr -d " ")
    if [ "$SIZE" -lt 50 ]; then
      echo "  ⚠️  내용 부족: $1 (${SIZE}bytes)"
      MISSING=$((MISSING+1))
    else
      echo "  ✅ 확인: $1"
    fi
  fi
}

echo ""
echo "====== 단계 $STAGE 완료 조건 검증 ======"
echo ""

case "$STAGE" in
  "02")
    check_file "$PROJECT_PATH/01_planning/📄 PRD.md"
    check_file "$PROJECT_PATH/01_planning/🗂️ domain-analysis.md"
    check_file "$PROJECT_PATH/01_planning/📝 feature-list.md"
    check_file "$PROJECT_PATH/01_planning/📊 feature-tracking.md"
    ;;
  "05")
    check_file "$PROJECT_PATH/03_design/📖 scenarios.md"
    ;;
  "06")
    check_file "$PROJECT_PATH/03_design/🎬 storyboard.md"
    ;;
  "07")
    check_file "$PROJECT_PATH/03_design/🎨 ui-concept.md"
    check_file "$PROJECT_PATH/03_design/🔀 user-flow.md"
    check_file "$PROJECT_PATH/03_design/🖥️ screen-list.md"
    check_file "$PROJECT_PATH/03_design/🏗️ architecture.md"
    check_file "$PROJECT_PATH/03_design/🗄️ ERD.md"
    check_file "$PROJECT_PATH/03_design/🔌 API.md"
    ;;
  "08")
    check_file "$PROJECT_PATH/04_development/📊 progress.md"
    check_file "$PROJECT_PATH/04_development/📏 coding-rules.md"
    ;;
  "09")
    check_file "$PROJECT_PATH/05_testing/unit/📋 unit-test-results.md"
    ;;
  "10")
    check_file "$PROJECT_PATH/05_testing/scenario/📋 scenario-test-results.md"
    ;;
  "11")
    check_file "$PROJECT_PATH/05_testing/integration/📋 integration-test-results.md"
    ;;
esac

echo ""
if [ "$MISSING" -gt 0 ]; then
  echo "⛔ 미충족 항목 ${MISSING}개 — 완료 보고 불가"
  exit 1
else
  echo "✅ 모든 완료 조건 충족"
  exit 0
fi
