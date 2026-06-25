#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="ScanID"
BUNDLE_ID="com.poligest.ScanID"
DERIVED_DATA="$ROOT_DIR/macos/build/DerivedData"
APP_BUNDLE="$DERIVED_DATA/Build/Products/Debug/$APP_NAME.app"

usage() {
  echo "usage: $0 [run|--verify|--smoke|--logs|--telemetry|--debug]" >&2
}

kill_app() {
  pkill -x "$APP_NAME" >/dev/null 2>&1 || true
}

build_app() {
  xcodebuild \
    -project "$ROOT_DIR/macos/ScanID.xcodeproj" \
    -scheme "$APP_NAME" \
    -configuration Debug \
    -destination 'platform=macOS' \
    -derivedDataPath "$DERIVED_DATA" \
    build
}

open_app() {
  /usr/bin/open -n "$APP_BUNDLE"
}

open_app_for_smoke() {
  launchctl setenv SCANID_LAUNCH_SMOKE_TEST 1
  open_app
}

cleanup_smoke_environment() {
  launchctl unsetenv SCANID_LAUNCH_SMOKE_TEST >/dev/null 2>&1 || true
}

verify_started() {
  sleep 4
  pgrep -x "$APP_NAME" >/dev/null
}

kill_app
build_app

case "$MODE" in
  run)
    open_app
    ;;
  --verify|verify|--smoke|smoke)
    trap cleanup_smoke_environment EXIT
    open_app_for_smoke
    verify_started
    kill_app
    ;;
  --logs|logs)
    open_app
    /usr/bin/log stream --info --style compact --predicate "process == \"$APP_NAME\""
    ;;
  --telemetry|telemetry)
    open_app
    /usr/bin/log stream --info --style compact --predicate "subsystem == \"$BUNDLE_ID\""
    ;;
  --debug|debug)
    lldb -- "$APP_BUNDLE/Contents/MacOS/$APP_NAME"
    ;;
  *)
    usage
    exit 2
    ;;
esac
