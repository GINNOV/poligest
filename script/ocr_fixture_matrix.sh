#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$(mktemp "${TMPDIR:-/tmp}/scanid-ocr-fixture-matrix.XXXXXX")"
OUTPUT_FORMAT="human"
FIXTURES_DIR=""
NEXT_COMMAND_EXPORT_DIR=""

usage() {
  echo "usage: $0 [--json|--next|--next-command <exported-fixture-dir>] [--fixtures-dir <dir>]" >&2
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --json)
      OUTPUT_FORMAT="json"
      shift
      ;;
    --next)
      OUTPUT_FORMAT="next"
      shift
      ;;
    --next-command)
      if [[ -z "${2:-}" ]]; then
        usage
        exit 2
      fi
      OUTPUT_FORMAT="next-command"
      NEXT_COMMAND_EXPORT_DIR="$2"
      shift 2
      ;;
    --fixtures-dir)
      if [[ -z "${2:-}" ]]; then
        usage
        exit 2
      fi
      if [[ ! -d "$2" ]]; then
        echo "error: fixtures directory not found: $2" >&2
        exit 1
      fi
      FIXTURES_DIR="$(cd "$2" && pwd)"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      exit 2
      ;;
  esac
done

cleanup() {
  rm -f "$LOG_FILE"
}

trap cleanup EXIT

set +e
(
  cd "$ROOT_DIR/apps/macos"
  if [[ -n "$FIXTURES_DIR" ]]; then
    SCANID_REQUIRE_REAL_OCR_FIXTURES=1 \
      SCANID_OCR_FIXTURES_DIR="$FIXTURES_DIR" \
      bash verify.sh >"$LOG_FILE" 2>&1
  else
    SCANID_REQUIRE_REAL_OCR_FIXTURES=1 bash verify.sh >"$LOG_FILE" 2>&1
  fi
)
STATUS=$?
set -e

MISSING_LINE="$(
  rg "Missing strict fixture coverage:|Real fixture strict coverage missing" "$LOG_FILE" || true
)"

if [[ "$OUTPUT_FORMAT" == "json" ]]; then
  VERIFY_STATUS="$STATUS" LOG_FILE="$LOG_FILE" OUTPUT_FORMAT="$OUTPUT_FORMAT" \
    ruby "$ROOT_DIR/script/ocr_fixture_matrix_report.rb"
  exit "$STATUS"
fi

if [[ "$OUTPUT_FORMAT" == "next" || "$OUTPUT_FORMAT" == "next-command" ]]; then
  VERIFY_STATUS="$STATUS" LOG_FILE="$LOG_FILE" OUTPUT_FORMAT="$OUTPUT_FORMAT" \
    EXPORT_DIR="$NEXT_COMMAND_EXPORT_DIR" ruby "$ROOT_DIR/script/ocr_fixture_matrix_report.rb"
  exit 0
fi

echo "ScanID OCR fixture matrix"
if rg -q "✅ PASS: Real fixture strict coverage requirements" "$LOG_FILE"; then
  echo "status: complete"
else
  echo "status: incomplete"
fi

if rg -q "^Real fixture coverage:" "$LOG_FILE"; then
  sed -n '/^Real fixture coverage:/,/^$/p' "$LOG_FILE"
fi

if rg -q "Missing strict fixture coverage:" "$LOG_FILE"; then
  rg "Missing strict fixture coverage:" "$LOG_FILE"
elif rg -q "Real fixture strict coverage missing" "$LOG_FILE"; then
  rg "Real fixture strict coverage missing" "$LOG_FILE"
fi

if rg -q "WARNING: Fixtures with incomplete metadata:" "$LOG_FILE"; then
  rg "WARNING: Fixtures with incomplete metadata:" "$LOG_FILE"
fi

has_missing() {
  local needle="$1"
  [[ "$MISSING_LINE" == *"$needle"* ]]
}

print_next_targets() {
  local printed=0
  local limit=12
  local sources=(webcam continuity)
  local sides=(cie_front cie_back tessera_front tessera_back)
  local rejected_conditions=(tilted glare slight-blur dark-background light-background partial-frame non-document)

  if rg -q "WARNING: Fixtures with incomplete metadata:" "$LOG_FILE"; then
    echo
    echo "Next fixture action:"
    echo "- fix incomplete metadata listed above, then rerun this command"
    return
  fi

  if [[ -z "$MISSING_LINE" ]]; then
    return
  fi

  echo
  echo "Next capture targets:"
  for source in "${sources[@]}"; do
    for side in "${sides[@]}"; do
      if has_missing "accepted $source document side $side"; then
        echo "- accept $source $side good"
        printed=$((printed + 1))
        [[ "$printed" -ge "$limit" ]] && return
      fi
    done
  done

  for source in "${sources[@]}"; do
    for condition in "${rejected_conditions[@]}"; do
      if has_missing "rejected condition $source $condition"; then
        echo "- reject $source negative $condition"
        printed=$((printed + 1))
        [[ "$printed" -ge "$limit" ]] && return
      fi
    done
  done

  if [[ "$printed" -eq 0 ]]; then
    if has_missing "at least one real fixture manifest"; then
      echo "- export and import the first redacted/test capture fixture"
    else
      echo "- resolve remaining missing coverage listed above"
    fi
  fi
}

print_next_targets

exit "$STATUS"
