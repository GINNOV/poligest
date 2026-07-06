#!/bin/bash
# Regenerate icon assets from Assets/AppIcon-1024.png:
#   - Assets.xcassets/AppIcon.appiconset (Xcode / App Store)
#   - Assets/AppIcon.icns (legacy manual installs)
#   - AppStore/MarketingIcon-1024.png (App Store Connect upload)
#   - app/public/scanid-icon.png (web admin)
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
SOURCE="$ROOT/Assets/AppIcon-1024.png"
ICONSET="$ROOT/Assets/AppIcon.iconset"
APPICONSET="$ROOT/Assets.xcassets/AppIcon.appiconset"

if [ ! -f "$SOURCE" ]; then
  echo "Error: $SOURCE not found."
  exit 1
fi

mkdir -p "$ICONSET" "$APPICONSET" "$ROOT/AppStore"

sizes=(
  "16:icon_16x16.png"
  "32:icon_16x16@2x.png"
  "32:icon_32x32.png"
  "64:icon_32x32@2x.png"
  "128:icon_128x128.png"
  "256:icon_128x128@2x.png"
  "256:icon_256x256.png"
  "512:icon_256x256@2x.png"
  "512:icon_512x512.png"
)

for entry in "${sizes[@]}"; do
  px="${entry%%:*}"
  name="${entry##*:}"
  sips -z "$px" "$px" "$SOURCE" --out "$ICONSET/$name" >/dev/null
  sips -z "$px" "$px" "$SOURCE" --out "$APPICONSET/$name" >/dev/null
done

cp "$SOURCE" "$ICONSET/icon_512x512@2x.png"
cp "$SOURCE" "$APPICONSET/icon_512x512@2x.png"
iconutil -c icns "$ICONSET" -o "$ROOT/Assets/AppIcon.icns"

cp "$SOURCE" "$ROOT/AppStore/MarketingIcon-1024.png"
sips -z 256 256 "$SOURCE" --out "$ROOT/Assets/ScanID-256.png" >/dev/null
sips -z 512 512 "$SOURCE" --out "$ROOT/Assets/ScanID-512.png" >/dev/null
cp "$ROOT/Assets/ScanID-256.png" "$ROOT/../app/public/scanid-icon.png"

echo "Generated:"
echo "  Assets.xcassets/AppIcon.appiconset"
echo "  Assets/AppIcon.icns"
echo "  AppStore/MarketingIcon-1024.png"
echo "  Assets/ScanID-{256,512}.png"
echo "  ../app/public/scanid-icon.png"