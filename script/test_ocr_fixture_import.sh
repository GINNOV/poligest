#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/scanid-ocr-import-tests.XXXXXX")"

cleanup() {
  rm -rf "$TMP_ROOT"
}

trap cleanup EXIT

source "$ROOT_DIR/script/ocr_fixture_test_lib.sh"

no_args_output="$(make_output)"
assert_exit 2 "$no_args_output" "$ROOT_DIR/script/import_ocr_fixture.sh"
assert_contains "$no_args_output" "usage: "

dry_run_no_args_output="$(make_output)"
assert_exit 2 "$dry_run_no_args_output" "$ROOT_DIR/script/import_ocr_fixture.sh" --dry-run
assert_contains "$dry_run_no_args_output" "usage: "

help_output="$(make_output)"
assert_exit 0 "$help_output" "$ROOT_DIR/script/import_ocr_fixture.sh" --help
assert_contains "$help_output" "[--expect-target <matrix-target>|--expect-next]"

missing_expected_target_output="$(make_output)"
assert_exit 2 "$missing_expected_target_output" "$ROOT_DIR/script/import_ocr_fixture.sh" --expect-target
assert_contains "$missing_expected_target_output" "usage: "

conflicting_target_mode_output="$(make_output)"
assert_exit 2 "$conflicting_target_mode_output" "$ROOT_DIR/script/import_ocr_fixture.sh" --expect-target "accept webcam cie_front good" --expect-next "$TMP_ROOT/missing-export"
assert_contains "$conflicting_target_mode_output" "usage: "

invalid_json_dir="$TMP_ROOT/invalid-json"
write_manifest "$invalid_json_dir" "{"
invalid_json_output="$(make_output)"
assert_exit 1 "$invalid_json_output" "$ROOT_DIR/script/import_ocr_fixture.sh" "$invalid_json_dir" "$TMP_ROOT/corpus"
assert_contains "$invalid_json_output" "manifest.json is not valid JSON"

invalid_json_dry_run_output="$(make_output)"
assert_exit 1 "$invalid_json_dry_run_output" "$ROOT_DIR/script/import_ocr_fixture.sh" --dry-run "$invalid_json_dir" "$TMP_ROOT/corpus"
assert_contains "$invalid_json_dry_run_output" "manifest.json is not valid JSON"

empty_export_parent="$TMP_ROOT/empty-export-parent"
mkdir -p "$empty_export_parent"
empty_export_parent_output="$(make_output)"
assert_exit 1 "$empty_export_parent_output" "$ROOT_DIR/script/import_ocr_fixture.sh" --dry-run "$empty_export_parent" "$TMP_ROOT/corpus"
assert_contains "$empty_export_parent_output" "exported fixture directory must contain manifest.json"
assert_contains "$empty_export_parent_output" "export a fixture from ScanID into this folder"

duplicate_export_dir="$TMP_ROOT/duplicate-export"
write_manifest "$duplicate_export_dir" "{}"
mkdir -p "$TMP_ROOT/corpus/duplicate-export"
duplicate_import_output="$(make_output)"
assert_exit 1 "$duplicate_import_output" "$ROOT_DIR/script/import_ocr_fixture.sh" --dry-run "$duplicate_export_dir" "$TMP_ROOT/corpus"
assert_contains "$duplicate_import_output" "destination already exists"

accepted_bad_condition_dir="$TMP_ROOT/accepted-bad-condition"
write_manifest "$accepted_bad_condition_dir" '{
  "fixtures": [
    {
      "name": "accepted-bad-condition",
      "image": "capture.png",
      "expect": "accept",
      "captureSource": "webcam",
      "documentSide": "cie_front",
      "condition": "glare"
    }
  ]
}'
accepted_bad_condition_output="$(make_output)"
assert_exit 1 "$accepted_bad_condition_output" "$ROOT_DIR/script/import_ocr_fixture.sh" "$accepted_bad_condition_dir" "$TMP_ROOT/corpus"
assert_contains "$accepted_bad_condition_output" "accepted fixtures must use condition good"

rejected_bad_side_dir="$TMP_ROOT/rejected-bad-side"
write_manifest "$rejected_bad_side_dir" '{
  "fixtures": [
    {
      "name": "rejected-bad-side",
      "image": "capture.png",
      "expect": "reject",
      "captureSource": "continuity",
      "documentSide": "cie_front",
      "condition": "glare"
    }
  ]
}'
rejected_bad_side_output="$(make_output)"
assert_exit 1 "$rejected_bad_side_output" "$ROOT_DIR/script/import_ocr_fixture.sh" "$rejected_bad_side_dir" "$TMP_ROOT/corpus"
assert_contains "$rejected_bad_side_output" "rejected camera fixtures must use documentSide negative"

missing_ocr_provider_dir="$TMP_ROOT/missing-ocr-provider"
write_manifest "$missing_ocr_provider_dir" '{
  "fixtures": [
    {
      "name": "missing-ocr-provider",
      "image": "capture.png",
      "expect": "reject",
      "captureSource": "webcam",
      "documentSide": "negative",
      "condition": "glare",
      "matrixTarget": "reject webcam negative glare"
    }
  ]
}'
missing_ocr_provider_output="$(make_output)"
assert_exit 1 "$missing_ocr_provider_output" "$ROOT_DIR/script/import_ocr_fixture.sh" "$missing_ocr_provider_dir" "$TMP_ROOT/corpus"
assert_contains "$missing_ocr_provider_output" "camera fixtures must declare ocrProvider"

missing_image_dir="$TMP_ROOT/missing-image"
write_manifest "$missing_image_dir" '{
  "fixtures": [
    {
      "name": "missing-image",
      "expect": "reject",
      "captureSource": "webcam",
      "ocrProvider": "vision",
      "documentSide": "negative",
      "condition": "non-document",
      "matrixTarget": "reject webcam negative non-document"
    }
  ]
}'
missing_image_output="$(make_output)"
assert_exit 1 "$missing_image_output" env MANIFEST="$missing_image_dir/manifest.json" SOURCE_DIR="$missing_image_dir" EXPECTED_TARGET="" ruby "$ROOT_DIR/script/import_ocr_fixture_manifest.rb" validate
assert_contains "$missing_image_output" "must declare an image path"

replay_only_no_image_dir="$TMP_ROOT/replay-only-no-image"
write_manifest "$replay_only_no_image_dir" '{
  "fixtures": [
    {
      "name": "replay-only-no-image",
      "replayOnly": true,
      "expect": "reject",
      "captureSource": "webcam",
      "ocrProvider": "vision",
      "documentSide": "negative",
      "condition": "non-document",
      "matrixTarget": "reject webcam negative non-document"
    }
  ]
}'
replay_only_no_image_output="$(make_output)"
assert_exit 0 "$replay_only_no_image_output" env MANIFEST="$replay_only_no_image_dir/manifest.json" SOURCE_DIR="$replay_only_no_image_dir" EXPECTED_TARGET="reject webcam negative non-document" ruby "$ROOT_DIR/script/import_ocr_fixture_manifest.rb" validate

replay_only_with_image_dir="$TMP_ROOT/replay-only-with-image"
write_manifest "$replay_only_with_image_dir" '{"fixtures":[{"name":"replay-only-with-image","replayOnly":true,"image":"capture.png","expect":"reject","captureSource":"webcam","ocrProvider":"vision","documentSide":"negative","condition":"non-document","matrixTarget":"reject webcam negative non-document"}]}'
touch "$replay_only_with_image_dir/capture.png"
replay_only_with_image_output="$(make_output)"
assert_exit 1 "$replay_only_with_image_output" env MANIFEST="$replay_only_with_image_dir/manifest.json" SOURCE_DIR="$replay_only_with_image_dir" EXPECTED_TARGET="" ruby "$ROOT_DIR/script/import_ocr_fixture_manifest.rb" validate
assert_contains "$replay_only_with_image_output" "replay-only fixtures must not declare an image path"

replay_only_with_orientation_dir="$TMP_ROOT/replay-only-with-orientation"
write_manifest "$replay_only_with_orientation_dir" '{"fixtures":[{"name":"replay-only-with-orientation","replayOnly":true,"expect":"reject","captureSource":"webcam","ocrProvider":"vision","documentSide":"negative","condition":"non-document","matrixTarget":"reject webcam negative non-document","orientation":{}}]}'
replay_only_with_orientation_output="$(make_output)"
assert_exit 1 "$replay_only_with_orientation_output" env MANIFEST="$replay_only_with_orientation_dir/manifest.json" SOURCE_DIR="$replay_only_with_orientation_dir" EXPECTED_TARGET="" ruby "$ROOT_DIR/script/import_ocr_fixture_manifest.rb" validate
assert_contains "$replay_only_with_orientation_output" "replay-only fixtures must not declare orientation metadata"

matrix_target_mismatch_dir="$TMP_ROOT/matrix-target-mismatch"
write_manifest "$matrix_target_mismatch_dir" '{
  "fixtures": [
    {
      "name": "matrix-target-mismatch",
      "image": "capture.png",
      "expect": "reject",
      "captureSource": "webcam",
      "ocrProvider": "vision",
      "documentSide": "negative",
      "condition": "glare",
      "matrixTarget": "reject webcam negative tilted"
    }
  ]
}'
touch "$matrix_target_mismatch_dir/capture.png"
matrix_target_mismatch_output="$(make_output)"
assert_exit 1 "$matrix_target_mismatch_output" "$ROOT_DIR/script/import_ocr_fixture.sh" "$matrix_target_mismatch_dir" "$TMP_ROOT/corpus"
assert_contains "$matrix_target_mismatch_output" "matrixTarget mismatch"

unexpected_target_dir="$TMP_ROOT/unexpected-target"
write_manifest "$unexpected_target_dir" '{
  "fixtures": [
    {
      "name": "unexpected-target",
      "image": "capture.png",
      "expect": "reject",
      "captureSource": "webcam",
      "ocrProvider": "vision",
      "documentSide": "negative",
      "condition": "glare",
      "matrixTarget": "reject webcam negative glare"
    }
  ]
}'
touch "$unexpected_target_dir/capture.png"
unexpected_target_output="$(make_output)"
assert_exit 1 "$unexpected_target_output" "$ROOT_DIR/script/import_ocr_fixture.sh" --expect-target "accept webcam cie_front good" "$unexpected_target_dir" "$TMP_ROOT/corpus"
assert_contains "$unexpected_target_output" "expected matrix target 'accept webcam cie_front good' not found"

empty_corpus="$TMP_ROOT/empty-corpus"
mkdir -p "$empty_corpus"
unexpected_next_target_output="$(make_output)"
assert_exit 1 "$unexpected_next_target_output" "$ROOT_DIR/script/import_ocr_fixture.sh" --expect-next "$unexpected_target_dir" "$empty_corpus"
assert_contains "$unexpected_next_target_output" "Expected current next matrix target: accept webcam cie_front good"
assert_contains "$unexpected_next_target_output" "expected matrix target 'accept webcam cie_front good' not found"

helper_valid_dir="$TMP_ROOT/helper-valid"
write_manifest "$helper_valid_dir" '{
  "fixtures": [
    {
      "name": "helper-valid",
      "image": "capture.png",
      "expect": "accept",
      "captureSource": "webcam",
      "ocrProvider": "vision",
      "documentSide": "cie_front",
      "condition": "good",
      "matrixTarget": "accept webcam cie_front good"
    }
  ]
}'
touch "$helper_valid_dir/capture.png"
helper_targets_output="$(make_output)"
assert_exit 0 "$helper_targets_output" env MANIFEST="$helper_valid_dir/manifest.json" ruby "$ROOT_DIR/script/import_ocr_fixture_manifest.rb" targets
assert_contains "$helper_targets_output" "- accept webcam cie_front good"
helper_validate_output="$(make_output)"
assert_exit 0 "$helper_validate_output" env MANIFEST="$helper_valid_dir/manifest.json" SOURCE_DIR="$helper_valid_dir" EXPECTED_TARGET="accept webcam cie_front good" ruby "$ROOT_DIR/script/import_ocr_fixture_manifest.rb" validate
helper_wrong_target_output="$(make_output)"
assert_exit 1 "$helper_wrong_target_output" env MANIFEST="$helper_valid_dir/manifest.json" SOURCE_DIR="$helper_valid_dir" EXPECTED_TARGET="accept webcam cie_back good" ruby "$ROOT_DIR/script/import_ocr_fixture_manifest.rb" validate
assert_contains "$helper_wrong_target_output" "expected matrix target 'accept webcam cie_back good' not found"

nested_parent_dir="$TMP_ROOT/nested-parent"
nested_export_dir="$nested_parent_dir/helper-valid"
mkdir -p "$nested_export_dir"
ditto "$helper_valid_dir" "$nested_export_dir"
nested_parent_output="$(make_output)"
assert_exit 1 "$nested_parent_output" "$ROOT_DIR/script/import_ocr_fixture.sh" --dry-run --expect-target "accept webcam cie_front good" "$nested_parent_dir" "$TMP_ROOT/corpus"
assert_contains "$nested_parent_output" "Using nested exported fixture directory:"
assert_contains "$nested_parent_output" "exported fixture failed isolated verifier preflight"
assert_contains "$nested_parent_output" "rebuild ScanID, reprocess the image, and export a fresh fixture"

escaped_image_dir="$TMP_ROOT/escaped-image"
write_manifest "$escaped_image_dir" '{
  "fixtures": [
    {
      "name": "escaped-image",
      "image": "../capture.png",
      "expect": "reject",
      "captureSource": "webcam",
      "ocrProvider": "vision",
      "documentSide": "negative",
      "condition": "glare"
    }
  ]
}'
escaped_image_output="$(make_output)"
assert_exit 1 "$escaped_image_output" "$ROOT_DIR/script/import_ocr_fixture.sh" "$escaped_image_dir" "$TMP_ROOT/corpus"
assert_contains "$escaped_image_output" "image path must stay inside the exported folder"
