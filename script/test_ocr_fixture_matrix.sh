#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/scanid-ocr-matrix-tests.XXXXXX")"

cleanup() {
  rm -rf "$TMP_ROOT"
}

trap cleanup EXIT

source "$ROOT_DIR/script/ocr_fixture_test_lib.sh"

empty_corpus="$TMP_ROOT/empty-corpus"
mkdir -p "$empty_corpus"

missing_fixtures_output="$(make_output)"
assert_exit 1 "$missing_fixtures_output" "$ROOT_DIR/script/ocr_fixture_matrix.sh" --fixtures-dir "$TMP_ROOT/missing-corpus" --next
assert_contains "$missing_fixtures_output" "fixtures directory not found"

matrix_next_output="$(make_output)"
assert_exit 0 "$matrix_next_output" "$ROOT_DIR/script/ocr_fixture_matrix.sh" --fixtures-dir "$empty_corpus" --next
assert_contains "$matrix_next_output" "accept webcam cie_front good"

relative_matrix_next_output="$(make_output)"
(
  cd "$TMP_ROOT"
  assert_exit 0 "$relative_matrix_next_output" "$ROOT_DIR/script/ocr_fixture_matrix.sh" --fixtures-dir "empty-corpus" --next
)
assert_contains "$relative_matrix_next_output" "accept webcam cie_front good"

matrix_next_command_output="$(make_output)"
export_dir_with_space="$TMP_ROOT/export with space"
assert_exit 0 "$matrix_next_command_output" "$ROOT_DIR/script/ocr_fixture_matrix.sh" --fixtures-dir "$empty_corpus" --next-command "$export_dir_with_space"
assert_contains "$matrix_next_command_output" "--dry-run --expect-next"
assert_contains "$matrix_next_command_output" "$TMP_ROOT/export\\ with\\ space"

matrix_json_output="$(make_output)"
assert_exit 1 "$matrix_json_output" "$ROOT_DIR/script/ocr_fixture_matrix.sh" --fixtures-dir "$empty_corpus" --json
ruby -rjson -e '
  data = JSON.parse(File.read(ARGV.fetch(0)))
  raise "expected incomplete status" unless data.fetch("status") == "incomplete"
  raise "expected missing real fixture manifest" unless data.fetch("missing").include?("at least one real fixture manifest")
  raise "expected first next target" unless data.fetch("nextCaptureTargets").first == "accept webcam cie_front good"
' "$matrix_json_output"

incomplete_metadata_corpus="$TMP_ROOT/incomplete-metadata-corpus"
mkdir -p "$incomplete_metadata_corpus/bad-export"
write_manifest "$incomplete_metadata_corpus/bad-export" '{
  "fixtures": [
    {
      "name": "bad-export",
      "image": "capture.png",
      "expect": "reject",
      "quality": "ignore",
      "captureSource": "webcam",
      "documentSide": "negative",
      "condition": "glare",
      "matrixTarget": "reject webcam negative glare"
    }
  ]
}'
touch "$incomplete_metadata_corpus/bad-export/capture.png"

incomplete_metadata_next_output="$(make_output)"
assert_exit 0 "$incomplete_metadata_next_output" "$ROOT_DIR/script/ocr_fixture_matrix.sh" --fixtures-dir "$incomplete_metadata_corpus" --next
assert_contains "$incomplete_metadata_next_output" "fix incomplete metadata listed in incompleteMetadata"

incomplete_metadata_json_output="$(make_output)"
assert_exit 1 "$incomplete_metadata_json_output" "$ROOT_DIR/script/ocr_fixture_matrix.sh" --fixtures-dir "$incomplete_metadata_corpus" --json
ruby -rjson -e '
  data = JSON.parse(File.read(ARGV.fetch(0)))
  raise "expected incomplete metadata" if data.fetch("incompleteMetadata").empty?
  expected = "fix incomplete metadata listed in incompleteMetadata"
  raise "expected metadata fix to be first next target" unless data.fetch("nextCaptureTargets").first == expected
' "$incomplete_metadata_json_output"
