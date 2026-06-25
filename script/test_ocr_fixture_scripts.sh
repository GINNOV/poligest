#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"$ROOT_DIR/script/test_ocr_fixture_import.sh"
"$ROOT_DIR/script/test_ocr_fixture_matrix.sh"
"$ROOT_DIR/script/test_ocr_fixture_collect.sh"
"$ROOT_DIR/script/test_ocr_fixture_redact.sh"

echo "OCR fixture script tests passed."
