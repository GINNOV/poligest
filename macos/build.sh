#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "=== Building ScanID.app ==="

# Clean existing build if any
rm -rf ScanID.app

# Create directory structure
mkdir -p ScanID.app/Contents/MacOS
mkdir -p ScanID.app/Contents/Resources

echo "1. Compiling Swift files..."
SDK_PATH=$(xcrun --show-sdk-path --sdk macosx)

swiftc -O \
  -sdk "$SDK_PATH" \
  -o ScanID.app/Contents/MacOS/ScanID \
  App.swift \
  MainView.swift \
  CameraView.swift \
  ZoomableImageWrapper.swift \
  UpdateInstaller.swift \
  Scanner.swift \
  Parser.swift \
  BelfioreCodes.swift

echo "2. Copying Info.plist and compiling asset catalog..."
cp Info.plist ScanID.app/Contents/Info.plist
if [ ! -d Assets.xcassets ]; then
  echo "Error: Assets.xcassets not found. Run ./generate-icon.sh first."
  exit 1
fi
PARTIAL_PLIST="$(mktemp)"
xcrun actool Assets.xcassets \
  --compile ScanID.app/Contents/Resources \
  --platform macosx \
  --minimum-deployment-target 14.0 \
  --app-icon AppIcon \
  --output-partial-info-plist "$PARTIAL_PLIST" \
  --notices --warnings
# Merge icon name from actool into Info.plist (asset catalog embedding)
ICON_NAME=$(/usr/libexec/PlistBuddy -c "Print :CFBundleIconName" "$PARTIAL_PLIST" 2>/dev/null || true)
if [ -n "$ICON_NAME" ]; then
  /usr/libexec/PlistBuddy -c "Delete :CFBundleIconFile" ScanID.app/Contents/Info.plist 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :CFBundleIconFile string $ICON_NAME" ScanID.app/Contents/Info.plist 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Set :CFBundleIconFile $ICON_NAME" ScanID.app/Contents/Info.plist
  /usr/libexec/PlistBuddy -c "Delete :CFBundleIconName" ScanID.app/Contents/Info.plist 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :CFBundleIconName string $ICON_NAME" ScanID.app/Contents/Info.plist 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Set :CFBundleIconName $ICON_NAME" ScanID.app/Contents/Info.plist
fi
rm -f "$PARTIAL_PLIST"
cp BelfioreCodes.json ScanID.app/Contents/Resources/BelfioreCodes.json
cp countdown.wav ScanID.app/Contents/Resources/countdown.wav

# Allow overriding the version for releases: VERSION=1.2.0 bash build.sh
if [ -n "${VERSION:-}" ]; then
  echo "   Overriding version to ${VERSION}..."
  /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString ${VERSION}" ScanID.app/Contents/Info.plist 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Set :CFBundleVersion ${VERSION}" ScanID.app/Contents/Info.plist 2>/dev/null || true
fi

echo "3. Setting execution permissions..."
chmod +x ScanID.app/Contents/MacOS/ScanID

echo "4. Ad-hoc code signing app bundle..."
codesign -s - --force ScanID.app/Contents/MacOS/ScanID
codesign -s - --force ScanID.app

echo "=== Build Completed Successfully! ==="
echo "You can launch the app using: open ScanID.app"
echo ""
echo "To create a distributable DMG for users:"
echo "  ./create-dmg.sh"
echo ""
echo "  (The DMG name will include the version from Info.plist)"
