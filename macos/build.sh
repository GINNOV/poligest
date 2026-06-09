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
  Scanner.swift \
  Parser.swift \
  BelfioreCodes.swift

echo "2. Copying Info.plist..."
cp Info.plist ScanID.app/Contents/Info.plist

echo "3. Setting execution permissions..."
chmod +x ScanID.app/Contents/MacOS/ScanID

echo "4. Ad-hoc code signing app bundle..."
codesign -s - --force ScanID.app/Contents/MacOS/ScanID
codesign -s - --force ScanID.app

echo "=== Build Completed Successfully! ==="
echo "You can launch the app using: open ScanID.app"
