#!/bin/bash
PROJECT_PATH="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="$1"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M")
BACKUP_DIR="$PROJECT_PATH/.rollback_backup"

if [ -z "$STAGE" ]; then
  echo ""
  echo "롤백할 단계를 선택하세요:"
  echo "  01 — 요구사항 단계로"
  echo "  02 — 기획 단계로"
  echo "  03 — 컨셉 결정 단계로"
  echo "  04 — 기술 결정 단계로"
  echo "  05 — 시나리오 단계로"
  echo "  06 — 스토리보드 단계로"
  echo "  07 — 화면설계 단계로"
  echo "  08 — 개발 단계로"
  echo "  09 — 단위 테스트 단계로"
  echo "  10 — 시나리오 테스트 단계로"
  echo "  11 — 통합 테스트 단계로"
  echo ""
  read -p "단계 번호 입력 (01~11): " STAGE
fi

case "$STAGE" in
  "01") STAGE_NAME="요구사항 정의" ;;
  "02") STAGE_NAME="기획 (planner)" ;;
  "03") STAGE_NAME="컨셉 결정" ;;
  "04") STAGE_NAME="기술 결정" ;;
  "05") STAGE_NAME="시나리오 (scenario-writer)" ;;
  "06") STAGE_NAME="스토리보드 (storyboard-writer)" ;;
  "07") STAGE_NAME="화면설계 (designer)" ;;
  "08") STAGE_NAME="개발 (developer)" ;;
  "09") STAGE_NAME="단위 테스트 (tester)" ;;
  "10") STAGE_NAME="시나리오 테스트 (tester)" ;;
  "11") STAGE_NAME="통합 테스트 (tester)" ;;
  *) echo "올바른 단계번호를 입력하세요 (01~11)"; exit 1 ;;
esac

echo ""
echo "======================================"
echo " 롤백: $STAGE_NAME 단계로 되돌아가기"
echo "======================================"
echo ""
read -p "롤백 이유를 입력하세요: " REASON
echo ""
read -p "계속하시겠습니까? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "취소되었습니다."
  exit 0
fi

mkdir -p "$BACKUP_DIR"
BACKUP_NAME="rollback-to-${STAGE}-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR/$BACKUP_NAME"

# 해당 단계 이후의 feedback.md 초기화
FOLDERS=(01_planning 02_concept 03_design 04_development 05_testing 06_deployment)
STAGE_NUM=$((10#$STAGE))

for folder in "${FOLDERS[@]}"; do
  FEEDBACK=$(find "$PROJECT_PATH/$folder" -name "💬 feedback.md" 2>/dev/null)
  if [ -n "$FEEDBACK" ]; then
    cp "$FEEDBACK" "$BACKUP_DIR/$BACKUP_NAME/$(basename $folder)-feedback.md" 2>/dev/null
  fi
done

bash "$PROJECT_PATH/.scripts/notify.sh" "롤백 완료" "$STAGE_NAME 단계로 롤백" "질문" 2>/dev/null

echo ""
echo "======================================"
echo " 롤백 완료: $STAGE_NAME"
echo "======================================"
echo ""
echo "Claude Code에서 입력하세요:"
echo "  > 롤백 완료. 이유: $REASON"
echo "    $STAGE_NAME 단계부터 다시 시작해줘."
echo ""
