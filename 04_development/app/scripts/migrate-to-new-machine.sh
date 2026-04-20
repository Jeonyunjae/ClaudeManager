#!/usr/bin/env bash
#
# ClaudeManager Migration Script
# Packages or restores DB, .orchestrator/, .env, and Skills for migration.
#
# Usage:
#   ./scripts/migrate-to-new-machine.sh pack       # Create migration archive
#   ./scripts/migrate-to-new-machine.sh restore     # Restore from archive
#   ./scripts/migrate-to-new-machine.sh verify      # Verify archive integrity
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
CM_HOME="${CLAUDEMANAGER_HOME:-$APP_DIR}"
ARCHIVE_NAME="claudemanager-migration-$(date +%Y%m%d-%H%M%S).tar.gz"
CHECKSUM_FILE="migration-checksum.sha256"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ---------------------------------------------------------------------------
# PACK — create migration archive
# ---------------------------------------------------------------------------
do_pack() {
  info "Creating migration archive..."

  local TEMP_DIR
  TEMP_DIR=$(mktemp -d)
  trap 'rm -rf "$TEMP_DIR"' EXIT

  local STAGING="$TEMP_DIR/claudemanager-migration"
  mkdir -p "$STAGING"

  # 1. Database
  local DB_PATH="$CM_HOME/data/claudemanager.db"
  if [[ -f "$DB_PATH" ]]; then
    info "Copying database..."
    cp "$DB_PATH" "$STAGING/"
    # Also copy WAL and SHM if they exist
    [[ -f "${DB_PATH}-wal" ]] && cp "${DB_PATH}-wal" "$STAGING/"
    [[ -f "${DB_PATH}-shm" ]] && cp "${DB_PATH}-shm" "$STAGING/"
  else
    warn "Database not found at $DB_PATH"
  fi

  # 2. Orchestrator directory
  local ORCH_DIR="$CM_HOME/.orchestrator"
  if [[ -d "$ORCH_DIR" ]]; then
    info "Copying .orchestrator/ directory..."
    cp -r "$ORCH_DIR" "$STAGING/.orchestrator"
  else
    warn ".orchestrator/ directory not found"
  fi

  # 3. Environment file
  if [[ -f "$APP_DIR/.env" ]]; then
    info "Copying .env file..."
    cp "$APP_DIR/.env" "$STAGING/.env"
  elif [[ -f "$APP_DIR/.env.local" ]]; then
    info "Copying .env.local file..."
    cp "$APP_DIR/.env.local" "$STAGING/.env.local"
  else
    warn "No .env file found"
  fi

  # 4. Skills directory
  local SKILLS_DIR="$CM_HOME/skills"
  if [[ -d "$SKILLS_DIR" ]]; then
    info "Copying skills/ directory..."
    cp -r "$SKILLS_DIR" "$STAGING/skills"
  fi

  # 5. Create archive
  info "Compressing to $ARCHIVE_NAME..."
  tar -czf "$APP_DIR/$ARCHIVE_NAME" -C "$TEMP_DIR" "claudemanager-migration"

  # 6. Generate checksum
  local CHECKSUM
  CHECKSUM=$(shasum -a 256 "$APP_DIR/$ARCHIVE_NAME" | awk '{print $1}')
  echo "$CHECKSUM  $ARCHIVE_NAME" > "$APP_DIR/$CHECKSUM_FILE"

  info "Migration archive created: $APP_DIR/$ARCHIVE_NAME"
  info "Checksum: $CHECKSUM"
  info "Checksum file: $APP_DIR/$CHECKSUM_FILE"
  echo ""
  info "Transfer both files to the new machine, then run:"
  echo "  ./scripts/migrate-to-new-machine.sh restore <archive-path>"
}

# ---------------------------------------------------------------------------
# VERIFY — check archive integrity
# ---------------------------------------------------------------------------
do_verify() {
  local ARCHIVE="${2:-}"
  if [[ -z "$ARCHIVE" ]]; then
    # Look for checksum file in current directory
    if [[ -f "$APP_DIR/$CHECKSUM_FILE" ]]; then
      info "Verifying using $CHECKSUM_FILE..."
      cd "$APP_DIR" && shasum -a 256 -c "$CHECKSUM_FILE"
      return $?
    fi
    error "Usage: $0 verify <archive-path>"
  fi

  [[ -f "$ARCHIVE" ]] || error "Archive not found: $ARCHIVE"

  local EXPECTED_CHECKSUM_FILE
  EXPECTED_CHECKSUM_FILE="$(dirname "$ARCHIVE")/$CHECKSUM_FILE"

  if [[ -f "$EXPECTED_CHECKSUM_FILE" ]]; then
    info "Verifying checksum..."
    cd "$(dirname "$ARCHIVE")" && shasum -a 256 -c "$CHECKSUM_FILE"
  else
    info "No checksum file found. Computing checksum:"
    shasum -a 256 "$ARCHIVE"
  fi
}

# ---------------------------------------------------------------------------
# RESTORE — restore from migration archive
# ---------------------------------------------------------------------------
do_restore() {
  local ARCHIVE="${2:-}"
  [[ -n "$ARCHIVE" ]] || error "Usage: $0 restore <archive-path>"
  [[ -f "$ARCHIVE" ]] || error "Archive not found: $ARCHIVE"

  # Verify integrity first
  local CHECKSUM_PATH
  CHECKSUM_PATH="$(dirname "$ARCHIVE")/$CHECKSUM_FILE"
  if [[ -f "$CHECKSUM_PATH" ]]; then
    info "Verifying archive integrity..."
    cd "$(dirname "$ARCHIVE")" && shasum -a 256 -c "$CHECKSUM_FILE" || error "Checksum verification failed!"
    info "Checksum verified."
  else
    warn "No checksum file found — skipping integrity check."
  fi

  local TEMP_DIR
  TEMP_DIR=$(mktemp -d)
  trap 'rm -rf "$TEMP_DIR"' EXIT

  info "Extracting archive..."
  tar -xzf "$ARCHIVE" -C "$TEMP_DIR"

  local STAGING="$TEMP_DIR/claudemanager-migration"
  [[ -d "$STAGING" ]] || error "Invalid archive format — missing claudemanager-migration directory"

  # 1. Database
  if [[ -f "$STAGING/claudemanager.db" ]]; then
    local DB_DIR="$CM_HOME/data"
    mkdir -p "$DB_DIR"
    info "Restoring database..."
    cp "$STAGING/claudemanager.db" "$DB_DIR/"
    [[ -f "$STAGING/claudemanager.db-wal" ]] && cp "$STAGING/claudemanager.db-wal" "$DB_DIR/"
    [[ -f "$STAGING/claudemanager.db-shm" ]] && cp "$STAGING/claudemanager.db-shm" "$DB_DIR/"
  fi

  # 2. Orchestrator
  if [[ -d "$STAGING/.orchestrator" ]]; then
    info "Restoring .orchestrator/ directory..."
    cp -r "$STAGING/.orchestrator" "$CM_HOME/.orchestrator"
  fi

  # 3. Environment file
  if [[ -f "$STAGING/.env" ]]; then
    info "Restoring .env file..."
    cp "$STAGING/.env" "$APP_DIR/.env"
    warn "Review .env and update paths for the new machine!"
  elif [[ -f "$STAGING/.env.local" ]]; then
    info "Restoring .env.local file..."
    cp "$STAGING/.env.local" "$APP_DIR/.env.local"
    warn "Review .env.local and update paths for the new machine!"
  fi

  # 4. Skills
  if [[ -d "$STAGING/skills" ]]; then
    info "Restoring skills/ directory..."
    cp -r "$STAGING/skills" "$CM_HOME/skills"
  fi

  info "Restoration complete!"
  echo ""
  info "Next steps:"
  echo "  1. Review and update .env file for the new machine"
  echo "  2. Run: pnpm install"
  echo "  3. Run: pnpm run db:migrate"
  echo "  4. Run: pnpm run build"
  echo "  5. Start the application: pnpm run start"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
case "${1:-}" in
  pack)    do_pack ;;
  restore) do_restore "$@" ;;
  verify)  do_verify "$@" ;;
  *)
    echo "ClaudeManager Migration Tool"
    echo ""
    echo "Usage:"
    echo "  $0 pack              Create migration archive"
    echo "  $0 restore <archive> Restore from archive"
    echo "  $0 verify [archive]  Verify archive integrity"
    exit 1
    ;;
esac
