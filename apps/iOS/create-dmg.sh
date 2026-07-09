#!/bin/bash
#
# create-dmg.sh
#
# Creates a distributable DMG for QuickNotes.app (Mac Catalyst).
#
# Usage:
#   ./create-dmg.sh [path/to/QuickNotes.app] [OutputName.dmg]
#
# Examples:
#   ./build-macos.sh && ./create-dmg.sh
#   ./create-dmg.sh QuickNotes.app QuickNotes-1.0.0.dmg
#
# Requirements:
#   - macOS (uses hdiutil + osascript)
#   - A built QuickNotes.app (run ./build-macos.sh first, or pass the path)
#
# Notes for distribution:
#   - The resulting DMG is suitable for manual / internal distribution.
#   - For public distribution you will eventually want:
#       * Proper Developer ID signing of the .app (not ad-hoc)
#       * Notarization of the DMG
#       * Stapling
#   - The version is read from the app's Info.plist so the DMG name matches
#     what the /api/quicknotes/meta endpoint reports.
#
#   After creating a DMG you can attach it to a GitHub Release and point
#   QUICKNOTES_DOWNLOAD_URL (or the /api/quicknotes/meta endpoint) at the asset URL.

set -e

APP_PATH="${1:-QuickNotes.app}"
OUTPUT_DMG="${2:-}"

if [ ! -d "$APP_PATH" ]; then
  echo "Error: '$APP_PATH' not found."
  echo "Build the app first with: ./build-macos.sh"
  echo "Or pass the path: ./create-dmg.sh /path/to/QuickNotes.app"
  exit 1
fi

VERSION=$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$APP_PATH/Contents/Info.plist" 2>/dev/null || echo "unknown")

if [ -z "$OUTPUT_DMG" ]; then
  OUTPUT_DMG="QuickNotes-${VERSION}.dmg"
fi

VOLUME_NAME="QuickNotes"
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

        set position of item "QuickNotes.app" of container window to {130, 160}
        set position of item "Applications" of container window to {370, 160}

        close
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

DMG_SIGN_IDENTITY="${QUICKNOTES_DMG_CODE_SIGN_IDENTITY:-${QUICKNOTES_CODE_SIGN_IDENTITY:-${CODE_SIGN_IDENTITY:-}}}"
if [ -n "$DMG_SIGN_IDENTITY" ] && [ "$DMG_SIGN_IDENTITY" != "-" ]; then
  echo "==> Code signing DMG with identity: ${DMG_SIGN_IDENTITY}"
  codesign -s "$DMG_SIGN_IDENTITY" --force --timestamp "$OUTPUT_DMG"
fi

if [ -n "${QUICKNOTES_NOTARY_PROFILE:-}" ]; then
  echo "==> Submitting DMG for notarization with keychain profile: ${QUICKNOTES_NOTARY_PROFILE}"
  xcrun notarytool submit "$OUTPUT_DMG" --keychain-profile "$QUICKNOTES_NOTARY_PROFILE" --wait
  echo "==> Stapling notarization ticket..."
  xcrun stapler staple "$OUTPUT_DMG"
fi

codesign --verify "$OUTPUT_DMG" 2>/dev/null || true

rm -f "$TEMP_DMG"
rm -rf "$STAGING_DIR"

SIZE=$(du -h "$OUTPUT_DMG" | cut -f1)
echo ""
echo "==> Done!"
echo "    Created: $OUTPUT_DMG  (${SIZE})"
echo ""
echo "To distribute:"
echo "  - Attach the DMG to a GitHub Release (recommended tag: quicknotes-v{version})"
echo "  - Point QUICKNOTES_DOWNLOAD_URL (or the /api/quicknotes/meta response) at the asset"
echo "  - Users double-click the DMG and drag QuickNotes.app to /Applications"