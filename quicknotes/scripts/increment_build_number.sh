#!/bin/sh
set -eu

if [ "${SKIP_AUTO_INCREMENT_BUILD:-}" = "1" ]; then
  exit 0
fi

if [ "${CONFIGURATION:-}" != "Release" ]; then
  exit 0
fi

PROJECT_FILE="${PROJECT_FILE_PATH:-}"
if [ -z "$PROJECT_FILE" ] || [ ! -f "$PROJECT_FILE" ]; then
  PROJECT_FILE="${PROJECT_DIR:-}/QuickNotes.xcodeproj/project.pbxproj"
fi

if [ -z "$PROJECT_FILE" ] || [ ! -f "$PROJECT_FILE" ]; then
  echo "warning: Cannot find project file for build number increment."
  exit 0
fi

CURRENT_VERSION=$(/usr/bin/awk -F '= ' '
  /CURRENT_PROJECT_VERSION = [0-9]+;/ {
    gsub(/;/, "", $2)
    if ($2 > max) max = $2
  }
  END {
    if (max != "") print max
  }
' "$PROJECT_FILE")
if [ -z "$CURRENT_VERSION" ]; then
  echo "warning: Cannot find CURRENT_PROJECT_VERSION in $PROJECT_FILE."
  exit 0
fi

NEXT_VERSION=$((CURRENT_VERSION + 1))
/usr/bin/perl -0pi -e "s/CURRENT_PROJECT_VERSION = \\d+;/CURRENT_PROJECT_VERSION = $NEXT_VERSION;/g" "$PROJECT_FILE"
echo "Incremented CURRENT_PROJECT_VERSION from $CURRENT_VERSION to $NEXT_VERSION."
