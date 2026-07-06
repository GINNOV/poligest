#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_CORPUS_DIR="$ROOT_DIR/apps/macos/OCRFixtures"
DRY_RUN=0
EXPECTED_TARGET=""
EXPECT_NEXT=0

usage() {
  echo "usage: $0 [--dry-run] [--expect-target <matrix-target>|--expect-next] <exported-fixture-dir> [corpus-dir]" >&2
}

args=()
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --expect-target)
      if [[ "$#" -lt 2 || -z "${2:-}" ]]; then
        usage
        exit 2
      fi
      EXPECTED_TARGET="$2"
      shift 2
      ;;
    --expect-next)
      EXPECT_NEXT=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      while [[ "$#" -gt 0 ]]; do
        args+=("$1")
        shift
      done
      ;;
    -*)
      usage
      exit 2
      ;;
    *)
      args+=("$1")
      shift
      ;;
  esac
done

if [[ "${#args[@]}" -gt 2 ]]; then
  usage
  exit 2
fi

if [[ "$EXPECT_NEXT" -eq 1 && -n "$EXPECTED_TARGET" ]]; then
  usage
  exit 2
fi

SOURCE_DIR="${args[0]:-}"
CORPUS_DIR="${args[1]:-$DEFAULT_CORPUS_DIR}"

if [[ -z "$SOURCE_DIR" ]]; then
  usage
  exit 2
fi

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "error: exported fixture directory not found: $SOURCE_DIR" >&2
  exit 1
fi

if [[ ! -f "$SOURCE_DIR/manifest.json" ]]; then
  nested_manifests=()
  while IFS= read -r manifest_path; do
    nested_manifests+=("$manifest_path")
  done < <(find "$SOURCE_DIR" -mindepth 2 -maxdepth 2 -name manifest.json -type f | sort)
  if [[ "${#nested_manifests[@]}" -eq 1 ]]; then
    SOURCE_DIR="$(cd "$(dirname "${nested_manifests[0]}")" && pwd)"
    echo "Using nested exported fixture directory: $SOURCE_DIR"
  elif [[ "${#nested_manifests[@]}" -eq 0 ]]; then
    echo "error: exported fixture directory must contain manifest.json" >&2
    echo "hint: export a fixture from ScanID into this folder, then pass the generated scanid-* subfolder or its parent if it contains exactly one export." >&2
    exit 1
  else
    echo "error: exported fixture parent contains multiple manifest.json files; pass one generated fixture subfolder explicitly" >&2
    printf 'found: %s\n' "${nested_manifests[@]}" >&2
    exit 1
  fi
fi

fixture_name="$(basename "$SOURCE_DIR")"
DEST_DIR="$CORPUS_DIR/$fixture_name"

if [[ -e "$DEST_DIR" ]]; then
  echo "error: destination already exists: $DEST_DIR" >&2
  exit 1
fi

if [[ "$EXPECT_NEXT" -eq 1 ]]; then
  if [[ ! -d "$CORPUS_DIR" ]]; then
    echo "error: --expect-next requires an existing corpus directory: $CORPUS_DIR" >&2
    exit 1
  fi
  EXPECTED_TARGET="$("$ROOT_DIR/script/ocr_fixture_matrix.sh" --fixtures-dir "$CORPUS_DIR" --next)"
  if [[ "$EXPECTED_TARGET" != accept\ * && "$EXPECTED_TARGET" != reject\ * ]]; then
    echo "error: current next matrix action is not an import target: $EXPECTED_TARGET" >&2
    exit 1
  fi
  echo "Expected current next matrix target: $EXPECTED_TARGET"
fi

MANIFEST="$SOURCE_DIR/manifest.json"
PREVIEW_CORPUS_DIR="$(mktemp -d "${TMPDIR:-/tmp}/scanid-ocr-fixture-preflight.XXXXXX")"
PREFLIGHT_LOG="$(mktemp "${TMPDIR:-/tmp}/scanid-ocr-fixture-preflight.XXXXXX")"

cleanup() {
  rm -rf "$PREVIEW_CORPUS_DIR"
  rm -f "$PREFLIGHT_LOG"
}

trap cleanup EXIT

MANIFEST="$MANIFEST" SOURCE_DIR="$SOURCE_DIR" EXPECTED_TARGET="$EXPECTED_TARGET" \
  ruby "$ROOT_DIR/script/import_ocr_fixture_manifest.rb" validate

PREVIEW_DIR="$PREVIEW_CORPUS_DIR/$fixture_name"
ditto "$SOURCE_DIR" "$PREVIEW_DIR"

set +e
(
  cd "$ROOT_DIR/apps/macos"
  SCANID_OCR_FIXTURES_DIR="$PREVIEW_CORPUS_DIR" \
    SCANID_FAIL_INCOMPLETE_OCR_FIXTURE_METADATA=1 \
    bash verify.sh >"$PREFLIGHT_LOG" 2>&1
)
preflight_status=$?
set -e

if [[ "$preflight_status" -ne 0 ]]; then
  echo "error: exported fixture failed isolated verifier preflight" >&2
  grep -E "OCR fixture metadata incomplete|WARNING: Fixtures with incomplete metadata" "$PREFLIGHT_LOG" >&2 || true
  if grep -Eq "observed OCR replay mismatch|readiness score mismatch|readiness reasons mismatch|stale observed metadata|stale readiness" "$PREFLIGHT_LOG"; then
    echo "hint: this export's parser or capture diagnostics are stale; rebuild ScanID, reprocess the image, and export a fresh fixture before importing." >&2
  fi
  tail -n 80 "$PREFLIGHT_LOG" >&2
  exit "$preflight_status"
fi

echo "Fixture preflight passed."

MANIFEST="$MANIFEST" ruby "$ROOT_DIR/script/import_ocr_fixture_manifest.rb" targets

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Would import OCR fixture: $DEST_DIR"
  echo "Dry run complete; fixture was not imported."
  exit 0
fi

mkdir -p "$CORPUS_DIR"

ditto "$SOURCE_DIR" "$DEST_DIR"
echo "Imported OCR fixture: $DEST_DIR"

if [[ "$(cd "$CORPUS_DIR" && pwd)" == "$(cd "$DEFAULT_CORPUS_DIR" && pwd)" ]]; then
  set +e
  "$ROOT_DIR/script/ocr_fixture_matrix.sh"
  matrix_status=$?
  set -e
  if [[ "$matrix_status" -ne 0 ]]; then
    echo "Fixture imported; matrix is still incomplete."
  fi
  exit 0
fi

echo "Matrix report skipped for custom corpus: $CORPUS_DIR"
