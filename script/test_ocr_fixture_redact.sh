#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/scanid-ocr-redact-tests.XXXXXX")"

cleanup() {
  rm -rf "$TMP_ROOT"
}

trap cleanup EXIT

source "$ROOT_DIR/script/ocr_fixture_test_lib.sh"

source_export="$TMP_ROOT/source-export"
redacted_export="$TMP_ROOT/redacted-export"

write_manifest "$source_export" '{
  "fixtures": [
    {
      "name": "scanid-private",
      "image": "scanid-private.png",
      "expect": "accept",
      "quality": "usable",
      "ocrProvider": "vision",
      "captureSource": "continuity",
      "documentSide": "tessera_front",
      "condition": "good",
      "matrixTarget": "accept continuity tessera_front good",
      "orientation": {
        "ocrVisionOrientation": "up",
        "snapshotDisplayOrientation": "left",
        "basePreviewRotationAngle": 180,
        "scanPreviewRotationAngle": 270,
        "baseCaptureRotationAngle": 0,
        "scanCaptureRotationAngle": 90,
        "rawImageWidth": 1080,
        "rawImageHeight": 1920,
        "imageWidth": 1920,
        "imageHeight": 1080
      },
      "diagnostics": {
        "frameQuality": "usable (sharpness 12.00, glare 0.000, dark 0.000, mean 180.0)",
        "frameQualityMetrics": {
          "sharpness": 12.0,
          "glareRatio": 0.0,
          "darkRatio": 0.0,
          "meanLuma": 180.0,
          "usable": true,
          "failureReasons": []
        },
        "canCapture": true,
        "canGuideLiveScan": true,
        "score": 31,
        "markerCount": 7,
        "itemCount": 7,
        "missingFrontNames": false,
        "reasons": []
      },
      "expected": {
        "documentType": "TESSERA_SANITARIA_FRONT",
        "surname": "ESPOSITO",
        "name": "MARIO",
        "codiceFiscale": "SPSMRA71C05G023H",
        "documentNumber": null,
        "dateOfBirth": "05/03/1971",
        "placeOfBirth": "OLEVANO SUL TUSCIANO",
        "gender": "M",
        "expiryDate": "07/07/2031",
        "nationality": null,
        "cardNumber": null
      },
      "observed": {
        "documentType": "TESSERA_SANITARIA_FRONT",
        "surname": "ESPOSITO",
        "name": "MARIO",
        "codiceFiscale": "SPSMRA71C05G023H",
        "documentNumber": null,
        "dateOfBirth": "05/03/1971",
        "placeOfBirth": "OLEVANO SUL TUSCIANO",
        "gender": "M",
        "expiryDate": "07/07/2031",
        "nationality": null,
        "cardNumber": null
      },
      "observedItems": [
        {"text": "TESSERA SANITARIA", "confidence": 0.98, "boundingBox": {"x": 0.1, "y": 0.8, "width": 0.3, "height": 0.05}, "imageBounds": {"x": 100, "y": 80, "width": 300, "height": 50}},
        {"text": "Codice SPSMRA71C05G023H", "confidence": 0.95, "boundingBox": {"x": 0.1, "y": 0.7, "width": 0.4, "height": 0.05}, "imageBounds": {"x": 100, "y": 180, "width": 400, "height": 50}},
        {"text": "Cognome", "confidence": 0.9, "boundingBox": {"x": 0.1, "y": 0.6, "width": 0.2, "height": 0.05}, "imageBounds": {"x": 100, "y": 280, "width": 200, "height": 50}},
        {"text": "ESPOSITO", "confidence": 0.94, "boundingBox": {"x": 0.3, "y": 0.6, "width": 0.2, "height": 0.05}, "imageBounds": {"x": 300, "y": 280, "width": 200, "height": 50}},
        {"text": "Nome MARIO", "confidence": 0.94, "boundingBox": {"x": 0.1, "y": 0.5, "width": 0.2, "height": 0.05}, "imageBounds": {"x": 100, "y": 380, "width": 200, "height": 50}},
        {"text": "OLEVANO SUL TUSCIANO", "confidence": 0.91, "boundingBox": {"x": 0.1, "y": 0.4, "width": 0.3, "height": 0.05}, "imageBounds": {"x": 100, "y": 480, "width": 300, "height": 50}},
        {"text": "05/03/1971", "confidence": 0.91, "boundingBox": {"x": 0.1, "y": 0.3, "width": 0.2, "height": 0.05}, "imageBounds": {"x": 100, "y": 580, "width": 200, "height": 50}}
      ],
      "observedBarcodes": []
    }
  ]
}'
touch "$source_export/scanid-private.png"

redact_output="$(make_output)"
assert_exit 0 "$redact_output" "$ROOT_DIR/script/redact_ocr_fixture.rb" "$source_export" "$redacted_export"
assert_contains "$redact_output" "Wrote replay-only redacted fixture"

ruby -rjson -e '
  manifest = JSON.parse(File.read(ARGV.fetch(0)))
  fixture = manifest.fetch("fixtures").fetch(0)
  raise "expected replayOnly" unless fixture.fetch("replayOnly") == true
  raise "image should be removed" if fixture.key?("image")
  raise "orientation should be removed" if fixture.key?("orientation")
  content = JSON.generate(manifest)
  %w[ESPOSITO MARIO SPSMRA71C05G023H 05/03/1971 OLEVANO].each do |private_value|
    raise "private value leaked: #{private_value}" if content.include?(private_value)
  end
  expected = fixture.fetch("expected")
  raise "expected synthetic surname" unless expected.fetch("surname") == "ROSSI"
  raise "expected synthetic name" unless expected.fetch("name") == "LUCA"
  raise "expected synthetic codice fiscale" unless expected.fetch("codiceFiscale") == "RSSLCU90A15H501A"
' "$redacted_export/manifest.json"

validator_output="$(make_output)"
assert_exit 0 "$validator_output" env MANIFEST="$redacted_export/manifest.json" SOURCE_DIR="$redacted_export" EXPECTED_TARGET="accept continuity tessera_front good" ruby "$ROOT_DIR/script/import_ocr_fixture_manifest.rb" validate
