#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
SOURCE_PROJECT_FILE="$PROJECT_ROOT/QuickNotes.xcodeproj/project.pbxproj"
SOURCE_BUILD_CONFIG="$PROJECT_ROOT/QuickNotes/BuildNumber.xcconfig"
SOURCE_INFO_PLIST="$PROJECT_ROOT/QuickNotes/QuickNotes/Info.plist"

read_config_version() {
  /usr/bin/awk -F '= *' '/CURRENT_PROJECT_VERSION = *[0-9]+/{ gsub(/[[:space:]]/, "", $2); print $2; exit }' "$1"
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
release_build_config="$tmpdir/release-BuildNumber.xcconfig"
release_info_plist="$tmpdir/release-Info.plist"
cp "$SOURCE_PROJECT_FILE" "$release_project_file"
cp "$SOURCE_BUILD_CONFIG" "$release_build_config"
cp "$SOURCE_INFO_PLIST" "$release_info_plist"
release_before=$(read_config_version "$release_build_config")
CONFIGURATION=Release BUILD_NUMBER_CONFIG="$release_build_config" PROJECT_FILE_PATH="$release_project_file" INFOPLIST_FILE="$release_info_plist" /bin/sh "$SCRIPT_DIR/increment_build_number.sh" >/dev/null
release_after=$(read_config_version "$release_build_config")
assert_equal "$release_after" "$((release_before + 1))"
assert_equal "$(read_plist_build_number "$release_info_plist")" "$((release_before + 1))"
if ! cmp -s "$SOURCE_PROJECT_FILE" "$release_project_file"; then
  echo "Expected build-number increment to leave project.pbxproj unchanged." >&2
  exit 1
fi

debug_project_file="$tmpdir/debug.pbxproj"
debug_build_config="$tmpdir/debug-BuildNumber.xcconfig"
debug_info_plist="$tmpdir/debug-Info.plist"
cp "$SOURCE_PROJECT_FILE" "$debug_project_file"
cp "$SOURCE_BUILD_CONFIG" "$debug_build_config"
cp "$SOURCE_INFO_PLIST" "$debug_info_plist"
debug_before=$(read_config_version "$debug_build_config")
CONFIGURATION=Debug BUILD_NUMBER_CONFIG="$debug_build_config" PROJECT_FILE_PATH="$debug_project_file" INFOPLIST_FILE="$debug_info_plist" /bin/sh "$SCRIPT_DIR/increment_build_number.sh" >/dev/null
debug_after=$(read_config_version "$debug_build_config")
assert_equal "$debug_after" "$((debug_before + 1))"
assert_equal "$(read_plist_build_number "$debug_info_plist")" "$((debug_before + 1))"
if ! cmp -s "$SOURCE_PROJECT_FILE" "$debug_project_file"; then
  echo "Expected build-number increment to leave project.pbxproj unchanged." >&2
  exit 1
fi

skip_build_config="$tmpdir/skip-BuildNumber.xcconfig"
skip_info_plist="$tmpdir/skip-Info.plist"
cp "$SOURCE_BUILD_CONFIG" "$skip_build_config"
cp "$SOURCE_INFO_PLIST" "$skip_info_plist"
skip_before=$(read_config_version "$skip_build_config")
skip_plist_before=$(read_plist_build_number "$skip_info_plist")
CONFIGURATION=Release SKIP_AUTO_INCREMENT_BUILD=1 BUILD_NUMBER_CONFIG="$skip_build_config" INFOPLIST_FILE="$skip_info_plist" /bin/sh "$SCRIPT_DIR/increment_build_number.sh" >/dev/null
skip_after=$(read_config_version "$skip_build_config")
assert_equal "$skip_after" "$skip_before"
assert_equal "$(read_plist_build_number "$skip_info_plist")" "$skip_plist_before"

echo "Build number increment script tests passed."
