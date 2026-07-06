#!/bin/sh
set -eu

if [ "${SKIP_AUTO_INCREMENT_BUILD:-}" = "1" ]; then
  [ -n "${SCRIPT_OUTPUT_FILE_0:-}" ] && /usr/bin/touch "$SCRIPT_OUTPUT_FILE_0"
  exit 0
fi

BUILD_NUMBER_CONFIG="${BUILD_NUMBER_CONFIG:-${PROJECT_DIR:-}/QuickNotes/BuildNumber.xcconfig}"
if [ -n "$BUILD_NUMBER_CONFIG" ] && [ "${BUILD_NUMBER_CONFIG#/}" = "$BUILD_NUMBER_CONFIG" ]; then
  BUILD_NUMBER_CONFIG="${PROJECT_DIR:-}/$BUILD_NUMBER_CONFIG"
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

CURRENT_VERSION=""

if [ -f "$BUILD_NUMBER_CONFIG" ]; then
  CURRENT_VERSION=$(/usr/bin/awk -F '= *' '/CURRENT_PROJECT_VERSION = *[0-9]+/{ gsub(/[[:space:]]/, "", $2); print $2; exit }' "$BUILD_NUMBER_CONFIG")
fi

case "$CURRENT_VERSION" in
  ''|*[!0-9]*)
    CURRENT_VERSION=$(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$INFO_PLIST" 2>/dev/null || true)
    ;;
esac

case "$CURRENT_VERSION" in
  ''|*[!0-9]*)
    CURRENT_VERSION="${CURRENT_PROJECT_VERSION:-}"
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

if [ -n "$BUILD_NUMBER_CONFIG" ]; then
  /bin/mkdir -p "$(/usr/bin/dirname "$BUILD_NUMBER_CONFIG")"
  if [ -f "$BUILD_NUMBER_CONFIG" ]; then
    tmp_config_file="${BUILD_NUMBER_CONFIG}.tmp"
    /usr/bin/sed -E "s/CURRENT_PROJECT_VERSION = *[0-9]+/CURRENT_PROJECT_VERSION = $NEXT_VERSION/g" "$BUILD_NUMBER_CONFIG" > "$tmp_config_file"
    /bin/mv "$tmp_config_file" "$BUILD_NUMBER_CONFIG"
  else
    /bin/echo "CURRENT_PROJECT_VERSION = $NEXT_VERSION" > "$BUILD_NUMBER_CONFIG"
  fi
fi

/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $NEXT_VERSION" "$INFO_PLIST" >/dev/null
[ -n "${SCRIPT_OUTPUT_FILE_0:-}" ] && /usr/bin/touch "$SCRIPT_OUTPUT_FILE_0"
echo "Incremented build number from $CURRENT_VERSION to $NEXT_VERSION in BuildNumber.xcconfig and app Info.plist."
