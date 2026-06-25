#!/usr/bin/env bash

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_contains() {
  local file="$1"
  local needle="$2"
  if ! rg -q --fixed-strings -- "$needle" "$file"; then
    echo "Expected output to contain: $needle" >&2
    echo "--- output ---" >&2
    cat "$file" >&2
    fail "missing expected output"
  fi
}

assert_exit() {
  local expected_status="$1"
  local output_file="$2"
  shift 2

  set +e
  "$@" >"$output_file" 2>&1
  local status=$?
  set -e

  if [[ "$status" -ne "$expected_status" ]]; then
    echo "Expected status $expected_status, got $status for: $*" >&2
    echo "--- output ---" >&2
    cat "$output_file" >&2
    fail "unexpected exit status"
  fi
}

write_manifest() {
  local dir="$1"
  local body="$2"
  mkdir -p "$dir"
  printf '%s\n' "$body" >"$dir/manifest.json"
}

make_output() {
  mktemp "$TMP_ROOT/output.XXXXXX"
}
