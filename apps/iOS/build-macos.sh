#!/bin/bash
#
# build-macos.sh
#
# Builds QuickNotes.app for macOS via Mac Catalyst.
#
# Usage:
#   ./build-macos.sh
#   VERSION=1.1.0 ./build-macos.sh
#
# Environment:
#   VERSION                        Override CFBundleShortVersionString / MARKETING_VERSION
#   QUICKNOTES_CODE_SIGN_IDENTITY  Code signing identity (default: Xcode automatic signing)
#   QUICKNOTES_ADHOC_SIGN=1        Build without provisioning (used on CI)
#   DERIVED_DATA_PATH              Xcode derived data location (default: build/DerivedData)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PROJECT="QuickNotes.xcodeproj"
SCHEME="QuickNotes"
DERIVED_DATA_PATH="${DERIVED_DATA_PATH:-build/DerivedData}"
BUILD_PRODUCTS_DIR="$DERIVED_DATA_PATH/Build/Products/Release-maccatalyst"
BUILT_APP="$BUILD_PRODUCTS_DIR/QuickNotes.app"
OUTPUT_APP="QuickNotes.app"

echo "=== Building QuickNotes.app (Mac Catalyst) ==="

XCODEBUILD_ARGS=(
  -project "$PROJECT"
  -scheme "$SCHEME"
  -destination "platform=macOS,variant=Mac Catalyst"
  -configuration Release
  -derivedDataPath "$DERIVED_DATA_PATH"
)

if [ -n "${VERSION:-}" ]; then
  echo "   Overriding version to ${VERSION}..."
  XCODEBUILD_ARGS+=(MARKETING_VERSION="$VERSION")
fi

if [ -n "${CI:-}" ] || [ "${QUICKNOTES_ADHOC_SIGN:-}" = "1" ]; then
  echo "   Building without code signing (CI/ad-hoc distribution)..."
  XCODEBUILD_ARGS+=(
    CODE_SIGNING_ALLOWED=NO
    CODE_SIGNING_REQUIRED=NO
  )
elif [ -n "${QUICKNOTES_CODE_SIGN_IDENTITY:-}" ]; then
  echo "   Using code sign identity: ${QUICKNOTES_CODE_SIGN_IDENTITY}"
  XCODEBUILD_ARGS+=(
    CODE_SIGN_IDENTITY="$QUICKNOTES_CODE_SIGN_IDENTITY"
    CODE_SIGN_STYLE=Manual
  )
fi

xcodebuild "${XCODEBUILD_ARGS[@]}" build

if [ ! -d "$BUILT_APP" ]; then
  echo "Error: expected build product at '$BUILT_APP'."
  exit 1
fi

echo "==> Copying built app to ${OUTPUT_APP}"
rm -rf "$OUTPUT_APP"
cp -R "$BUILT_APP" "$OUTPUT_APP"

codesign --verify --deep --strict "$OUTPUT_APP" 2>/dev/null || true

VERSION_BUILT=$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$OUTPUT_APP/Contents/Info.plist")
echo "=== Build Completed Successfully! ==="
echo "    App:     $OUTPUT_APP"
echo "    Version: $VERSION_BUILT"
echo ""
echo "To create a distributable DMG for users:"
echo "  ./create-dmg.sh"