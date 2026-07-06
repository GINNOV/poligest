#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CORPUS_DIR="$ROOT_DIR/apps/macos/OCRFixtures"
EXPORT_DIR=""
EXPORTS_ROOT="${SCANID_COLLECT_EXPORTS_DIR:-$ROOT_DIR/exports}"
DRY_RUN=0
OPEN_APP=0
LATEST_EXPORT=0
REDACT_REPLAY=0
AUDIT_EXPORTS=0
EXPECTED_TARGET=""
RUN_COMMAND="${SCANID_COLLECT_RUN_COMMAND:-$ROOT_DIR/script/build_and_run.sh}"

usage() {
  echo "usage: $0 [--fixtures-dir <dir>] [--export-dir <exported-fixture-dir>|--latest-export] [--expect-target <matrix-target>] [--redact-replay] [--dry-run] [--open-app] [--audit-exports]" >&2
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --fixtures-dir)
      if [[ -z "${2:-}" ]]; then
        usage
        exit 2
      fi
      if [[ ! -d "$2" ]]; then
        echo "error: fixtures directory not found: $2" >&2
        exit 1
      fi
      CORPUS_DIR="$(cd "$2" && pwd)"
      shift 2
      ;;
    --export-dir)
      if [[ -z "${2:-}" ]]; then
        usage
        exit 2
      fi
      EXPORT_DIR="$2"
      shift 2
      ;;
    --latest-export)
      LATEST_EXPORT=1
      shift
      ;;
    --expect-target)
      if [[ -z "${2:-}" ]]; then
        usage
        exit 2
      fi
      EXPECTED_TARGET="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --redact-replay)
      REDACT_REPLAY=1
      shift
      ;;
    --audit-exports)
      AUDIT_EXPORTS=1
      shift
      ;;
    --open-app)
      OPEN_APP=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      exit 2
      ;;
  esac
done

if [[ "$LATEST_EXPORT" -eq 1 && -n "$EXPORT_DIR" ]]; then
  usage
  exit 2
fi

if [[ "$LATEST_EXPORT" -eq 1 ]]; then
  if [[ ! -d "$EXPORTS_ROOT" ]]; then
    echo "error: exports directory not found: $EXPORTS_ROOT" >&2
    exit 1
  fi
  set +e
  EXPORT_DIR="$(
    ruby -e '
      manifests = Dir.glob(File.join(ARGV.fetch(0), "*", "manifest.json"))
        .select { |path| File.file?(path) }
      exit 1 if manifests.empty?
      puts File.dirname(manifests.max_by { |path| File.mtime(path) })
    ' "$EXPORTS_ROOT"
  )"
  latest_status=$?
  set -e
  if [[ "$latest_status" -ne 0 || -z "$EXPORT_DIR" ]]; then
    echo "error: no exported fixture manifests found under: $EXPORTS_ROOT" >&2
    exit 1
  fi
  echo "Using latest exported fixture: $EXPORT_DIR"
fi

next_target="$("$ROOT_DIR/script/ocr_fixture_matrix.sh" --fixtures-dir "$CORPUS_DIR" --next)"
matrix_json="$("$ROOT_DIR/script/ocr_fixture_matrix.sh" --fixtures-dir "$CORPUS_DIR" --json || true)"

echo "ScanID OCR fixture collection"
echo "Corpus: $CORPUS_DIR"
echo "Next target: $next_target"

if [[ "$AUDIT_EXPORTS" -eq 1 ]]; then
  if [[ ! -d "$EXPORTS_ROOT" ]]; then
    echo "Exports: none ($EXPORTS_ROOT does not exist)"
    exit 0
  fi
  MATRIX_JSON="$matrix_json" EXPORTS_ROOT="$EXPORTS_ROOT" ROOT_DIR="$ROOT_DIR" ruby <<'RUBY'
require "json"
require "shellwords"

matrix = JSON.parse(ENV.fetch("MATRIX_JSON"))
missing_targets = matrix.fetch("nextCaptureTargets", []).select { |target| target.start_with?("accept ", "reject ") }
missing_lookup = missing_targets.to_h { |target| [target, true] }
manifests = Dir.glob(File.join(ENV.fetch("EXPORTS_ROOT"), "*", "manifest.json")).sort
matches = []
duplicates = Hash.new(0)

manifests.each do |manifest_path|
  manifest = JSON.parse(File.read(manifest_path))
  manifest.fetch("fixtures", []).each do |fixture|
    target = fixture["matrixTarget"].to_s
    next if target.empty?

    export_dir = File.dirname(manifest_path)
    if missing_lookup[target]
      matches << [target, export_dir]
    else
      duplicates[target] += 1
    end
  end
rescue JSON::ParserError
  warn "warning: skipped invalid export manifest: #{manifest_path}"
end

puts
puts "Export audit:"
if manifests.empty?
  puts "- no exported fixture manifests found under #{ENV.fetch("EXPORTS_ROOT")}"
elsif matches.empty?
  puts "- no exported fixtures match the current missing matrix targets"
else
  puts "- exported fixtures that fill missing targets:"
  matches.each do |target, export_dir|
    command = [
      File.join(ENV.fetch("ROOT_DIR"), "script/collect_ocr_fixture.sh"),
      "--export-dir", export_dir,
      "--expect-target", target,
      "--redact-replay",
      "--dry-run"
    ].map { |part| Shellwords.escape(part) }.join(" ")
    puts "  - #{target}"
    puts "    #{command}"
  end
end

unless duplicates.empty?
  puts "- already-covered or out-of-order exported targets:"
  duplicates.sort.each do |target, count|
    puts "  - #{target}: #{count}"
  end
end
RUBY
  exit 0
fi

if [[ "$next_target" != accept\ * && "$next_target" != reject\ * ]]; then
  echo "Action: $next_target"
  exit 1
fi

if [[ -z "$EXPORT_DIR" ]]; then
  echo
  echo "Capture this target in ScanID, export it with File > Export OCR Fixture..., then run:"
  printf '  %q --fixtures-dir %q --export-dir /path/to/exported-fixture-folder\n' "$0" "$CORPUS_DIR"
  echo
  echo "For an out-of-order failure sample, pass the exported matrix target explicitly:"
  printf '  %q --fixtures-dir %q --export-dir /path/to/exported-fixture-folder --expect-target %q\n' "$0" "$CORPUS_DIR" "reject continuity negative partial-frame"
  echo
  echo "To import a commit-safe parser/capture replay fixture without the private image, add --redact-replay."
  echo
  echo "For a preflight-only import, add --dry-run."
  if [[ "$OPEN_APP" -eq 1 ]]; then
    default_export_dir="$EXPORTS_ROOT"
    mkdir -p "$default_export_dir"
    launchctl setenv SCANID_OCR_EXPORTS_DIR "$default_export_dir" >/dev/null 2>&1 || true
    echo
    echo "Opening ScanID for capture..."
    echo "Default export folder: $default_export_dir"
    SCANID_OCR_EXPORTS_DIR="$default_export_dir" "$RUN_COMMAND" run
  fi
  exit 0
fi

import_args=()
if [[ "$DRY_RUN" -eq 1 ]]; then
  import_args+=(--dry-run)
fi

if [[ -n "$EXPECTED_TARGET" ]]; then
  import_args+=(--expect-target "$EXPECTED_TARGET")
else
  import_args+=(--expect-next)
fi

IMPORT_SOURCE_DIR="$EXPORT_DIR"
REDACT_TMP_DIR=""
if [[ "$REDACT_REPLAY" -eq 1 ]]; then
  REDACT_TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/scanid-redacted-replay.XXXXXX")"
  redacted_name="$(basename "$EXPORT_DIR")-replay-redacted"
  IMPORT_SOURCE_DIR="$REDACT_TMP_DIR/$redacted_name"
  "$ROOT_DIR/script/redact_ocr_fixture.rb" "$EXPORT_DIR" "$IMPORT_SOURCE_DIR"
fi

"$ROOT_DIR/script/import_ocr_fixture.sh" "${import_args[@]}" "$IMPORT_SOURCE_DIR" "$CORPUS_DIR"
