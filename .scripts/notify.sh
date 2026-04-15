#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../.env" 2>/dev/null
TITLE="$1"
MESSAGE="$2"
TYPE="${3:-완료}"
PROJECT="ClaudeManager"
case "$TYPE" in
  "완료") EMOJI="✅" ;;
  "질문") EMOJI="❓" ;;
  "오류") EMOJI="🚨" ;;
  "시작") EMOJI="🚀" ;;
  *)      EMOJI="📢" ;;
esac
if [ "$NOTIFY_CHOICE" != "3" ]; then
  osascript -e "display notification \"$MESSAGE\" with title \"$EMOJI $PROJECT — $TITLE\" sound name \"Glass\"" 2>/dev/null
fi
if [ -n "$SLACK_WEBHOOK" ]; then
  curl -s -X POST "$SLACK_WEBHOOK" -H "Content-type: application/json" -d "{\"text\":\"$EMOJI *[$PROJECT] $TITLE*\n$MESSAGE\"}" > /dev/null
fi
