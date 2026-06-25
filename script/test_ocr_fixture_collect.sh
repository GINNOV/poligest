#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/scanid-ocr-collect-tests.XXXXXX")"

cleanup() {
  rm -rf "$TMP_ROOT"
}

trap cleanup EXIT

source "$ROOT_DIR/script/ocr_fixture_test_lib.sh"

empty_corpus="$TMP_ROOT/empty-corpus"
mkdir -p "$empty_corpus"

help_output="$(make_output)"
assert_exit 0 "$help_output" "$ROOT_DIR/script/collect_ocr_fixture.sh" --help
assert_contains "$help_output" "[--fixtures-dir <dir>]"
assert_contains "$help_output" "[--export-dir <exported-fixture-dir>|--latest-export]"
assert_contains "$help_output" "[--expect-target <matrix-target>]"
assert_contains "$help_output" "[--redact-replay]"
assert_contains "$help_output" "[--open-app]"

missing_corpus_output="$(make_output)"
assert_exit 1 "$missing_corpus_output" "$ROOT_DIR/script/collect_ocr_fixture.sh" --fixtures-dir "$TMP_ROOT/missing-corpus"
assert_contains "$missing_corpus_output" "fixtures directory not found"

empty_corpus_output="$(make_output)"
assert_exit 0 "$empty_corpus_output" "$ROOT_DIR/script/collect_ocr_fixture.sh" --fixtures-dir "$empty_corpus"
assert_contains "$empty_corpus_output" "Next target: accept webcam cie_front good"
assert_contains "$empty_corpus_output" "--export-dir /path/to/exported-fixture-folder"
assert_contains "$empty_corpus_output" "--expect-target"
assert_contains "$empty_corpus_output" "--redact-replay"
assert_contains "$empty_corpus_output" "For a preflight-only import, add --dry-run."

audit_exports_root="$TMP_ROOT/audit-exports"
write_manifest "$audit_exports_root/matching-export" '{"fixtures":[{"matrixTarget":"accept webcam cie_front good"}]}'
write_manifest "$audit_exports_root/out-of-order-export" '{"fixtures":[{"matrixTarget":"accept continuity unknown good"}]}'
audit_exports_output="$(make_output)"
assert_exit 0 "$audit_exports_output" env \
  SCANID_COLLECT_EXPORTS_DIR="$audit_exports_root" \
  "$ROOT_DIR/script/collect_ocr_fixture.sh" --fixtures-dir "$empty_corpus" --audit-exports
assert_contains "$audit_exports_output" "Export audit:"
assert_contains "$audit_exports_output" "exported fixtures that fill missing targets"
assert_contains "$audit_exports_output" "accept webcam cie_front good"
assert_contains "$audit_exports_output" "--redact-replay --dry-run"
assert_contains "$audit_exports_output" "already-covered or out-of-order exported targets"
assert_contains "$audit_exports_output" "accept continuity unknown good: 1"

fake_run_command="$TMP_ROOT/fake-build-and-run.sh"
fake_run_log="$TMP_ROOT/fake-run.log"
cat >"$fake_run_command" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >"$SCANID_FAKE_RUN_LOG"
EOF
chmod +x "$fake_run_command"
open_app_output="$(make_output)"
assert_exit 0 "$open_app_output" env \
  SCANID_COLLECT_RUN_COMMAND="$fake_run_command" \
  SCANID_FAKE_RUN_LOG="$fake_run_log" \
  "$ROOT_DIR/script/collect_ocr_fixture.sh" --fixtures-dir "$empty_corpus" --open-app
assert_contains "$open_app_output" "Opening ScanID for capture..."
assert_contains "$open_app_output" "Default export folder:"
assert_contains "$fake_run_log" "run"

missing_expected_target_output="$(make_output)"
assert_exit 2 "$missing_expected_target_output" "$ROOT_DIR/script/collect_ocr_fixture.sh" --fixtures-dir "$empty_corpus" --expect-target
assert_contains "$missing_expected_target_output" "usage: "

latest_with_export_dir_output="$(make_output)"
assert_exit 2 "$latest_with_export_dir_output" "$ROOT_DIR/script/collect_ocr_fixture.sh" --fixtures-dir "$empty_corpus" --latest-export --export-dir "$TMP_ROOT/export"
assert_contains "$latest_with_export_dir_output" "usage: "

missing_exports_root_output="$(make_output)"
assert_exit 1 "$missing_exports_root_output" env \
  SCANID_COLLECT_EXPORTS_DIR="$TMP_ROOT/missing-exports" \
  "$ROOT_DIR/script/collect_ocr_fixture.sh" --fixtures-dir "$empty_corpus" --latest-export
assert_contains "$missing_exports_root_output" "exports directory not found"

empty_exports_root="$TMP_ROOT/empty-exports"
mkdir -p "$empty_exports_root"
empty_exports_root_output="$(make_output)"
assert_exit 1 "$empty_exports_root_output" env \
  SCANID_COLLECT_EXPORTS_DIR="$empty_exports_root" \
  "$ROOT_DIR/script/collect_ocr_fixture.sh" --fixtures-dir "$empty_corpus" --latest-export
assert_contains "$empty_exports_root_output" "no exported fixture manifests found"

latest_exports_root="$TMP_ROOT/latest-exports"
older_export="$latest_exports_root/scanid-older"
newer_export="$latest_exports_root/scanid-newer"
write_manifest "$older_export" "{}"
sleep 1
write_manifest "$newer_export" "{"
latest_export_output="$(make_output)"
assert_exit 1 "$latest_export_output" env \
  SCANID_COLLECT_EXPORTS_DIR="$latest_exports_root" \
  "$ROOT_DIR/script/collect_ocr_fixture.sh" --fixtures-dir "$empty_corpus" --latest-export
assert_contains "$latest_export_output" "Using latest exported fixture: $newer_export"
assert_contains "$latest_export_output" "manifest.json is not valid JSON"

redactable_export="$TMP_ROOT/redactable-export"
write_manifest "$redactable_export" '{
  "fixtures": [
    {
      "name": "redactable-export",
      "image": "capture.png",
      "expect": "reject",
      "quality": "ignore",
      "ocrProvider": "vision",
      "captureSource": "continuity",
      "documentSide": "negative",
      "condition": "non-document",
      "matrixTarget": "reject continuity negative non-document",
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
        "canCapture": false,
        "canGuideLiveScan": false,
        "score": 3,
        "markerCount": 0,
        "itemCount": 0,
        "missingFrontNames": false,
        "reasons": ["unknownDocumentType", "missingIdentifier"]
      },
      "observed": {
        "documentType": "UNKNOWN",
        "surname": null,
        "name": null,
        "codiceFiscale": null,
        "documentNumber": null,
        "dateOfBirth": null,
        "placeOfBirth": null,
        "gender": null,
        "expiryDate": null,
        "nationality": null,
        "cardNumber": null
      },
      "observedItems": [],
      "observedBarcodes": []
    }
  ]
}'
touch "$redactable_export/capture.png"
redacted_collect_output="$(make_output)"
assert_exit 0 "$redacted_collect_output" "$ROOT_DIR/script/collect_ocr_fixture.sh" \
  --fixtures-dir "$empty_corpus" \
  --export-dir "$redactable_export" \
  --expect-target "reject continuity negative non-document" \
  --redact-replay \
  --dry-run
assert_contains "$redacted_collect_output" "Wrote replay-only redacted fixture"
assert_contains "$redacted_collect_output" "Fixture preflight passed."
assert_contains "$redacted_collect_output" "Dry run complete; fixture was not imported."
