#!/bin/bash
#
# create-dmg.sh
#
# Creates a nice distributable DMG for ScanID.app
#
# This script turns the built ScanID.app into a professional-looking
# drag-and-drop DMG (with an "Applications" symlink and sensible icon layout).
#
# Usage:
#   ./create-dmg.sh [path/to/ScanID.app] [OutputName.dmg]
#
# Examples:
#   ./create-dmg.sh
#   ./create-dmg.sh ScanID.app
#   ./create-dmg.sh ScanID.app ScanID-1.2.0.dmg
#   VERSION=1.2.0 ./build.sh && ./create-dmg.sh
#
# Requirements:
#   - macOS (uses hdiutil + osascript)
#   - A built ScanID.app (run ./build.sh first, or pass the path)
#
# Notes for distribution:
#   - The resulting DMG is suitable for manual / internal distribution.
#   - For public distribution you will eventually want:
#       * Proper Developer ID signing of the .app (not ad-hoc)
#       * Notarization of the DMG
#       * Stapling
#   - The version is read from the app's Info.plist so the DMG name matches
#     what the in-app update checker expects.
#
#   After creating a DMG you can attach it to a GitHub Release and point
#   SCANID_DOWNLOAD_URL (or the /api/scanid/meta endpoint) at the asset URL.

set -e

APP_PATH="${1:-ScanID.app}"
OUTPUT_DMG="${2:-}"

if [ ! -d "$APP_PATH" ]; then
  echo "Error: '$APP_PATH' not found."
  echo "Build the app first with: ./build.sh"
  echo "Or pass the path: ./create-dmg.sh /path/to/ScanID.app"
  exit 1
fi

# Read the version directly from the built app (same technique used in build.sh)
VERSION=$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$APP_PATH/Contents/Info.plist" 2>/dev/null || echo "unknown")

if [ -z "$OUTPUT_DMG" ]; then
  OUTPUT_DMG="ScanID-${VERSION}.dmg"
fi

VOLUME_NAME="ScanID"
STAGING_DIR=$(mktemp -d)
TEMP_DMG=$(mktemp -u).dmg

echo "==> Preparing DMG staging area for version ${VERSION}..."
cp -R "$APP_PATH" "$STAGING_DIR/"
ln -s /Applications "$STAGING_DIR/Applications"

echo "==> Creating temporary read/write DMG..."
hdiutil create \
  -volname "$VOLUME_NAME" \
  -srcfolder "$STAGING_DIR" \
  -ov \
  -format UDRW \
  "$TEMP_DMG" >/dev/null

MOUNT_DIR="/Volumes/${VOLUME_NAME}"

echo "==> Attaching temporary DMG..."
hdiutil attach "$TEMP_DMG" -mountpoint "$MOUNT_DIR" -nobrowse -quiet

# Give the system a moment to register the volume with Finder
sleep 1

echo "==> Configuring DMG window (icon view + positions)..."
osascript <<APPLESCRIPT
tell application "Finder"
    tell disk "${VOLUME_NAME}"
        open
        set current view of container window to icon view
        set toolbar visible of container window to false
        set statusbar visible of container window to false
        set the bounds of container window to {100, 100, 540, 380}

        set theViewOptions to the icon view options of container window
        set arrangement of theViewOptions to not arranged
        set icon size of theViewOptions to 128

        -- Nice side-by-side layout: app on the left, Applications on the right
        set position of item "ScanID.app" of container window to {130, 160}
        set position of item "Applications" of container window to {370, 160}

        close
        -- Open + close again helps the .DS_Store get written with our settings
        open
        delay 0.8
        close
    end tell
end tell
APPLESCRIPT

echo "==> Detaching temporary DMG..."
hdiutil detach "$MOUNT_DIR" -quiet

echo "==> Converting to final compressed DMG: ${OUTPUT_DMG}"
hdiutil convert "$TEMP_DMG" \
  -format UDZO \
  -imagekey zlib-level=9 \
  -o "$OUTPUT_DMG" \
  -ov >/dev/null

DMG_SIGN_IDENTITY="${SCANID_DMG_CODE_SIGN_IDENTITY:-${SCANID_CODE_SIGN_IDENTITY:-${CODE_SIGN_IDENTITY:-}}}"
if [ -n "$DMG_SIGN_IDENTITY" ] && [ "$DMG_SIGN_IDENTITY" != "-" ]; then
  echo "==> Code signing DMG with identity: ${DMG_SIGN_IDENTITY}"
  codesign -s "$DMG_SIGN_IDENTITY" --force --timestamp "$OUTPUT_DMG"
fi

if [ -n "${SCANID_NOTARY_PROFILE:-}" ]; then
  echo "==> Submitting DMG for notarization with keychain profile: ${SCANID_NOTARY_PROFILE}"
  xcrun notarytool submit "$OUTPUT_DMG" --keychain-profile "$SCANID_NOTARY_PROFILE" --wait
  echo "==> Stapling notarization ticket..."
  xcrun stapler staple "$OUTPUT_DMG"
fi

codesign --verify "$OUTPUT_DMG" 2>/dev/null || true

# Cleanup
rm -f "$TEMP_DMG"
rm -rf "$STAGING_DIR"

# Show the result
SIZE=$(du -h "$OUTPUT_DMG" | cut -f1)
echo ""
echo "==> Done!"
echo "    Created: $OUTPUT_DMG  (${SIZE})"
echo ""
echo "To distribute:"
echo "  - Attach the DMG to a GitHub Release (recommended name matches the version)"
echo "  - Point your SCANID_DOWNLOAD_URL (or the /api/scanid/meta response) at the asset"
echo "  - Users double-click the DMG and drag ScanID.app to /Applications"
echo ""
echo "Tip: You can also run with explicit paths:"
echo "  ./create-dmg.sh ScanID.app MyCustomName.dmg"
