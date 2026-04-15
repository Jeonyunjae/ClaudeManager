#!/bin/bash
DASHBOARD="/Users/jeon-yunjae/Documents/윤재 자료 정리/04.Project/05.ClaudeManager/ClaudeManager/ClaudeManager/00_overview/🏠 ClaudeManager.md"
STAGE="$1"
STATUS="$2"
DATE="${3:-$(date +%Y-%m-%d)}"
case "$STAGE" in
  "01") sed -i "" "s/| 01. 요구사항.*|/| 01. 요구사항 정의 | 사람 | $STATUS | $DATE |/" "$DASHBOARD" 2>/dev/null ;;
  "02") sed -i "" "s/| 02. 기획.*|/| 02. 기획 (PRD) | planner | $STATUS | $DATE |/" "$DASHBOARD" 2>/dev/null ;;
  "03") sed -i "" "s/| 03. 컨셉.*|/| 03. 컨셉 결정 | 사람 | $STATUS | $DATE |/" "$DASHBOARD" 2>/dev/null ;;
  "04") sed -i "" "s/| 04. 기술.*|/| 04. 기술 결정 | 사람 | $STATUS | $DATE |/" "$DASHBOARD" 2>/dev/null ;;
  "05") sed -i "" "s/| 05. 시나리오.*|/| 05. 시나리오 작성 | scenario-writer | $STATUS | $DATE |/" "$DASHBOARD" 2>/dev/null ;;
  "06") sed -i "" "s/| 06. 스토리보드.*|/| 06. 스토리보드 | storyboard-writer | $STATUS | $DATE |/" "$DASHBOARD" 2>/dev/null ;;
  "07") sed -i "" "s/| 07. 화면설계.*|/| 07. 화면설계 + 설계 | designer | $STATUS | $DATE |/" "$DASHBOARD" 2>/dev/null ;;
  "08") sed -i "" "s/| 08. 개발.*|/| 08. 개발 | developer | $STATUS | $DATE |/" "$DASHBOARD" 2>/dev/null ;;
  "09") sed -i "" "s/| 09. 단위.*|/| 09. 단위 테스트 | tester | $STATUS | $DATE |/" "$DASHBOARD" 2>/dev/null ;;
  "10") sed -i "" "s/| 10. 시나리오.*|/| 10. 시나리오 테스트 | tester | $STATUS | $DATE |/" "$DASHBOARD" 2>/dev/null ;;
  "11") sed -i "" "s/| 11. 통합.*|/| 11. 통합 테스트 | tester | $STATUS | $DATE |/" "$DASHBOARD" 2>/dev/null ;;
  "12") sed -i "" "s/| 12. 배포.*|/| 12. 배포 | deployer | $STATUS | $DATE |/" "$DASHBOARD" 2>/dev/null ;;
esac
