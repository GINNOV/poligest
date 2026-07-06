#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
SOURCE_PROJECT_FILE="$PROJECT_ROOT/QuickNotes.xcodeproj/project.pbxproj"
SOURCE_INFO_PLIST="$PROJECT_ROOT/QuickNotes/QuickNotes/Info.plist"

read_version() {
  /usr/bin/awk -F '= ' '/CURRENT_PROJECT_VERSION = [0-9]+;/{ gsub(/;/, "", $2); print $2; exit }' "$1"
}

read_versions() {
  /usr/bin/awk -F '= ' '/CURRENT_PROJECT_VERSION = [0-9]+;/{ gsub(/;/, "", $2); print $2 }' "$1"
}

read_plist_build_number() {
  /usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$1"
}

assert_equal() {
  if [ "$1" != "$2" ]; then
    echo "Expected $1 to equal $2" >&2
    exit 1
  fi
}

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

release_project_file="$tmpdir/release.pbxproj"
release_info_plist="$tmpdir/release-Info.plist"
cp "$SOURCE_PROJECT_FILE" "$release_project_file"
cp "$SOURCE_INFO_PLIST" "$release_info_plist"
release_before=$(read_version "$release_project_file")
CONFIGURATION=Release PROJECT_FILE_PATH="$release_project_file" INFOPLIST_FILE="$release_info_plist" /bin/sh "$SCRIPT_DIR/increment_build_number.sh" >/dev/null
release_after=$(read_version "$release_project_file")
assert_equal "$release_after" "$((release_before + 1))"
assert_equal "$(read_plist_build_number "$release_info_plist")" "$release_after"
if [ "$(read_versions "$release_project_file" | sort -u | wc -l | tr -d ' ')" != "1" ]; then
  echo "Expected all Release build-number entries to be normalized." >&2
  exit 1
fi

debug_project_file="$tmpdir/debug.pbxproj"
debug_info_plist="$tmpdir/debug-Info.plist"
cp "$SOURCE_PROJECT_FILE" "$debug_project_file"
cp "$SOURCE_INFO_PLIST" "$debug_info_plist"
debug_before=$(read_version "$debug_project_file")
CONFIGURATION=Debug PROJECT_FILE_PATH="$debug_project_file" INFOPLIST_FILE="$debug_info_plist" /bin/sh "$SCRIPT_DIR/increment_build_number.sh" >/dev/null
debug_after=$(read_version "$debug_project_file")
assert_equal "$debug_after" "$((debug_before + 1))"
assert_equal "$(read_plist_build_number "$debug_info_plist")" "$debug_after"

skip_project_file="$tmpdir/skip.pbxproj"
skip_info_plist="$tmpdir/skip-Info.plist"
cp "$SOURCE_PROJECT_FILE" "$skip_project_file"
cp "$SOURCE_INFO_PLIST" "$skip_info_plist"
skip_before=$(read_version "$skip_project_file")
skip_plist_before=$(read_plist_build_number "$skip_info_plist")
CONFIGURATION=Release SKIP_AUTO_INCREMENT_BUILD=1 PROJECT_FILE_PATH="$skip_project_file" INFOPLIST_FILE="$skip_info_plist" /bin/sh "$SCRIPT_DIR/increment_build_number.sh" >/dev/null
skip_after=$(read_version "$skip_project_file")
assert_equal "$skip_after" "$skip_before"
assert_equal "$(read_plist_build_number "$skip_info_plist")" "$skip_plist_before"

echo "Build number increment script tests passed."
