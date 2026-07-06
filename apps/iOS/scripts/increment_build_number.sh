#!/bin/sh
set -eu

if [ "${SKIP_AUTO_INCREMENT_BUILD:-}" = "1" ]; then
  [ -n "${SCRIPT_OUTPUT_FILE_0:-}" ] && /usr/bin/touch "$SCRIPT_OUTPUT_FILE_0"
  exit 0
fi

if [ "${AUTO_INCREMENT_BUILD_NUMBER:-}" != "1" ]; then
  echo "Skipping build number increment. Set AUTO_INCREMENT_BUILD_NUMBER=1 to enable it."
  [ -n "${SCRIPT_OUTPUT_FILE_0:-}" ] && /usr/bin/touch "$SCRIPT_OUTPUT_FILE_0"
  exit 0
fi

INFO_PLIST="${INFOPLIST_FILE:-}"
if [ -n "$INFO_PLIST" ] && [ "${INFO_PLIST#/}" = "$INFO_PLIST" ]; then
  INFO_PLIST="${PROJECT_DIR:-}/$INFO_PLIST"
fi

if [ -z "$INFO_PLIST" ] || [ ! -f "$INFO_PLIST" ]; then
  INFO_PLIST="${PROJECT_DIR:-}/QuickNotes/QuickNotes/Info.plist"
fi

if [ -z "$INFO_PLIST" ] || [ ! -f "$INFO_PLIST" ]; then
  echo "warning: Cannot find Info.plist for build number increment."
  exit 0
fi

CURRENT_VERSION="${CURRENT_PROJECT_VERSION:-}"
case "$CURRENT_VERSION" in
  ''|*[!0-9]*)
    CURRENT_VERSION=$(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$INFO_PLIST" 2>/dev/null || true)
    ;;
esac

case "$CURRENT_VERSION" in
  ''|*[!0-9]*)
    echo "warning: Cannot find numeric build number for increment."
    [ -n "${SCRIPT_OUTPUT_FILE_0:-}" ] && /usr/bin/touch "$SCRIPT_OUTPUT_FILE_0"
    exit 0
    ;;
esac

NEXT_VERSION=$((CURRENT_VERSION + 1))
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $NEXT_VERSION" "$INFO_PLIST" >/dev/null
[ -n "${SCRIPT_OUTPUT_FILE_0:-}" ] && /usr/bin/touch "$SCRIPT_OUTPUT_FILE_0"
echo "Incremented build number from $CURRENT_VERSION to $NEXT_VERSION."
