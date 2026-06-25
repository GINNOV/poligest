# ScanID OCR Fixture Corpus

This directory is for real camera captures used by `verify.sh`.

The verifier looks for `manifest.json` files under `OCRFixtures/`. If none are
present, the real-image corpus is skipped. Once real captures are added, each
manifest becomes a strict test input and OCR/parser mismatches fail verification.

## Exporting Captures

In ScanID, scan or import a card, correct extracted fields if needed, then use
`File > Export OCR Fixture...`. The app writes a timestamped folder containing:

- a PNG capture image
- a `manifest.json` with one fixture entry
- a `README.md` with the matrix target, import command, isolated matrix check,
  and next-target collection guidance

The export dialog only offers `good` for accepted captures and degraded
condition labels for rejected captures, matching the strict matrix rules.
Rejected exports keep `documentSide: negative`, but their `condition` must be a
specific matrix label such as `partial-frame`, `non-document`, or a frame-quality
label, not a generic negative bucket.
The same dialog shows the full fixture matrix target (`accept|reject`,
`captureSource`, `documentSide`, and `condition`) before saving, and updates it
when the condition changes so the collector can confirm the sample belongs to
the intended matrix slot.
During a collection session, ScanID remembers the last export directory and the
success status includes the exported matrix target, such as `accept webcam
tessera_front good` or `reject continuity negative glare`.
The same target is stored in the manifest as `matrixTarget`, so external tools
can associate the export with the strict coverage slot.

When the sample uses test or redacted data, preflight the entire exported folder
from the repository root without copying it into the corpus:

```bash
./script/import_ocr_fixture.sh --dry-run --expect-next /path/to/exported-fixture-folder
```

Then import the same folder:

```bash
./script/import_ocr_fixture.sh --expect-next /path/to/exported-fixture-folder
```

For capture sessions, the guided wrapper keeps the current matrix target and
target-locked import step together:

```bash
./script/collect_ocr_fixture.sh
```

To print the target and launch ScanID for capture in one step:

```bash
./script/collect_ocr_fixture.sh --open-app
```

The launcher also creates `exports/` at the repository root and points ScanID's
fixture export panel there by default. If live capture never completes, use
`Freeze Current Camera Frame` from the toolbar or press `Command-Shift-F`, then
export the frozen frame with `File > Export OCR Fixture...`.

After exporting a fixture folder from ScanID, rerun it with that export:

```bash
./script/collect_ocr_fixture.sh --export-dir /path/to/exported-fixture-folder
```

If the export was written under the repository `exports/` folder, use the newest
generated export without copying the timestamped path:

```bash
./script/collect_ocr_fixture.sh --latest-export --dry-run
```

Add `--dry-run` to run only the target-locked preflight before importing. For an
out-of-order failure sample, import the app-reported matrix target explicitly:

```bash
./script/collect_ocr_fixture.sh --export-dir exports/scanid-... --expect-target "reject continuity negative partial-frame"
```

Before importing, the exported README also includes a command like this to check
only the export's parent directory:

```bash
./script/ocr_fixture_matrix.sh --fixtures-dir /path/to/export-parent --next
```

The importer validates that `manifest.json` is parseable, has fixture entries,
references image files inside the exported folder, and has no stale
`matrixTarget` values. Camera exports must also declare `ocrProvider`, so SDK
comparison fixtures cannot enter the corpus without engine identity. When
`--expect-target` or `--expect-next` is provided, it also rejects exports that do not contain the exact target the collector
intended to fill. `--expect-next` resolves that target from the current corpus,
so stale export instructions fail instead of filling the wrong slot. It rejects
contradictory target metadata: accepted fixtures must use
`condition: good`, rejected fixtures must use a degraded condition, and rejected
webcam/Continuity fixtures must keep `documentSide: negative`. Image paths must
also resolve inside the exported folder, so symlinks cannot pull unrelated local
files into the corpus. It then runs an isolated `verify.sh` preflight against
only that export, so bad expected fields, parser regressions, capture-gate
mismatches, incomplete camera metadata, and missing images are rejected before
the folder enters the corpus. If the manifest was generated before parser or
capture-gate changes, the importer reports stale observed/diagnostic metadata;
rebuild ScanID, reprocess the image, and export a fresh fixture instead of
hand-editing the manifest.
With `--dry-run`, the importer also checks for an existing destination folder,
then stops after that preflight and target report without copying anything.
Without `--dry-run`, after preflight passes, it copies the folder under
`OCRFixtures/`, prints the matrix targets, and runs the focused matrix
report. You can still copy the folder manually when needed; `verify.sh`
discovers nested manifests automatically.

## Required Capture Matrix

Add at least one accepted fixture for each document side from each camera
source:

- CIE front
- CIE back
- Tessera Sanitaria front
- Tessera Sanitaria back

Cover both capture sources before treating OCR reliability as proven:

- built-in or USB webcam
- iPhone Continuity Camera

For threshold tuning, include degraded-but-real samples:

- tilted card
- mild glare
- slight blur
- dark background
- light background
- partial frame that should not capture
- non-document/background text that should not capture

Collect each condition from both webcam and Continuity Camera. Differences in
focus, rotation, exposure, and compression can make one source pass while the
other fails.
The `good` condition must come from accepted fixtures. Degraded conditions
(`tilted`, `glare`, `slight-blur`, `dark-background`, `light-background`,
`partial-frame`, and `non-document`) must come from rejected fixtures.

## Manifest Format

Use `manifest.example.json` as the template. Image paths are relative to the
manifest file that declares them and must stay inside the fixture folder; do not
use absolute paths or `..` path components. Expected dates use `dd/MM/yyyy`.

Each fixture has an `expect` value:

- `accept`: the image must pass the final capture gate and match every expected field.
- `reject`: the image must fail the final capture gate. Use this for partial cards, heavy glare, heavy blur, background text, and non-document images.

Each fixture can also set `quality`:

- `usable`: the image must pass the frame-quality gate.
- `unusable`: the image must fail the frame-quality gate.
- `ignore`: the verifier does not assert frame quality directly.

Accepted fixtures default to `usable`. Rejected fixtures default to `ignore`,
because some rejected images are sharp but incomplete or not documents.

When a quality expectation fails, `verify.sh` prints the frame-quality summary:
sharpness, glare ratio, dark ratio, mean luma, and the rejection reason. Use
those values to tune thresholds only after adding representative webcam and
Continuity Camera samples.

For accepted fixtures, include `expected` and list every field. For fields that
must be absent, use `null`. The verifier checks every expected field, so do not
omit fields to hide a weak parse.

Rejected fixtures do not need `expected`.

For coverage reporting, include:

- `captureSource`: `webcam`, `continuity`, `imported`, or `unknown`
- `documentSide`: `cie_front`, `cie_back`, `tessera_front`, `tessera_back`, `negative`, or `unknown`
- `condition`: keep the app-generated condition label when exporting, or choose the closest label in the export dialog when collecting a specific matrix sample such as `tilted`. Common labels include `good`, `tilted`, `glare`, `slight-blur`, `dark-background`, `light-background`, `partial-frame`, and `non-document`. Accepted fixtures must use `good`; rejected fixtures must use a degraded condition.
- `matrixTarget`: app-generated collection slot in the form `accept|reject captureSource documentSide condition`. Webcam and Continuity Camera fixtures must include it, and when present it must match `expect`, `captureSource`, `documentSide`, and `condition`.
- `ocrProvider`: OCR engine used to produce the exported OCR evidence, currently `vision`. Webcam and Continuity Camera fixtures must include it so Vision and SDK-backed captures can be compared without mixing evidence.
- `orientation`: for webcam and Continuity Camera exports, keep the app-generated block with OCR orientation, display snapshot orientation, preview angles, capture angles, raw camera-buffer dimensions, and exported image dimensions. The snapshot orientation must agree with the recorded preview angle, the OCR orientation must agree with the capture angle, raw dimensions must be positive, the raw/display dimension relationship must match the snapshot orientation, and the exported dimensions must match the PNG. This is the audit trail that proves captures use the same orientation as the preview.
- `diagnostics`: keep the app-generated readiness block with frame-quality summary, structured frame-quality metrics, capture booleans, score, marker/item counts, `missingFrontNames`, and `reasons`. Rejected fixtures are much easier to tune when this explains why capture failed.
- `observed`: keep the app-generated parsed fields exactly as ScanID saw them. This is not used as ground truth; it preserves partial or rejected OCR output so parser and capture-gate failures are reproducible.
- `observedItems`: keep the app-generated raw OCR items with text, confidence, normalized bounding boxes, and exported-image pixel bounds. This is the evidence needed to debug card-layout detection, scattered-text rejection, and orientation/crop regressions.
- `observedBarcodes`: keep the app-generated barcode/MRZ/card payloads with confidence, normalized bounding boxes, and exported-image pixel bounds. Barcode payloads are parser evidence for Tessera backs and CIE backs, so dropping them makes fixture replay weaker than the app capture path.

For every fixture with `observedItems`, `verify.sh` also replays those OCR items
and `observedBarcodes` through the production parser and final capture gate.
Camera `observed` fields must match that replay, accepted fixtures must match
`expected`, and rejected fixtures must remain rejected. This gives a
deterministic parser/gate regression check alongside the real-image Vision OCR
replay.
Accepted fixtures must declare the same `documentSide` as their expected and
replayed OCR document type, so mislabeled sides cannot satisfy the matrix.
Accepted camera fixtures must also have OCR-item evidence for direct identity
and identifier fields such as surname, name, codice fiscale, document number,
or card number. Derived fields such as birth date and gender may come from a
validated codice fiscale, but direct patient identity cannot be accepted from
labels alone.

`verify.sh` prints a coverage summary for all discovered real fixtures. Treat
`unknown`, `unspecified`, missing camera orientation metadata, or missing camera
diagnostics/observed/observedItems metadata as unfinished fixture work.
Camera fixtures with missing or stale `matrixTarget` values are also unfinished
because the manifest no longer identifies the strict matrix slot it actually
satisfies.
Camera orientation metadata is considered unfinished when its names disagree
with the recorded angles, its raw or exported dimensions are not positive, its
raw/display dimensions do not match the snapshot orientation, or its exported
dimensions do not match the PNG. Camera `observedItems` are also considered
unfinished when text is blank, confidence is outside `0...1`, bounding boxes are
outside the normalized `0...1` image space, exported-image pixel bounds are
missing or do not match the PNG dimensions, or `diagnostics.itemCount` does not
match the number of exported OCR items. Camera `observedBarcodes` are considered
unfinished when payloads are blank, confidence is outside `0...1`, normalized
boxes are invalid, or exported-image pixel bounds do not match the PNG
dimensions.
Camera diagnostics are considered unfinished when `reasons` is missing, when
structured frame-quality metrics are missing, invalid, or stale against the PNG,
when a rejected fixture has an empty `reasons` array, when an accepted fixture
still has rejection reasons, when marker/item counts are negative, or when
`markerCount` no longer matches the exported OCR items. Camera `observed` fields
are considered unfinished when they no longer match production parser replay
from `observedItems`. For fixtures with a concrete `usable` or `unusable`
quality expectation, the recorded readiness score, capture decision, and
live-guidance decision must also match replayed `observedItems` evidence.
Camera diagnostics must also agree with the fixture expectation: accepted
fixtures require `canCapture: true`, rejected fixtures require `canCapture:
false`, and `missingFrontNames` must match the observed front-side fields.

To enforce the full real-capture matrix, run:

```bash
SCANID_REQUIRE_REAL_OCR_FIXTURES=1 ./verify.sh
```

For a shorter collection checklist from the repository root, run:

```bash
./script/ocr_fixture_matrix.sh
```

To print only the next capture target for an operator or automation loop, run:

```bash
./script/ocr_fixture_matrix.sh --next
```

After exporting a candidate fixture folder, generate target-locked dry-run and
import commands for the current next target with:

```bash
./script/ocr_fixture_matrix.sh --next-command /path/to/exported-fixture-folder
```

When fixtures exist, the checklist includes accepted document-side rows and
condition rows for each camera source, marking every required item as `ok` or
`missing`. The same command also prints `Next capture targets`, a short
collector-facing list such as `accept webcam cie_front good` or `reject
continuity negative non-document`.

For automation or app integration, use:

```bash
./script/ocr_fixture_matrix.sh --json
```

The JSON output includes `status`, the raw `missing` verifier gaps,
`incompleteMetadata`, and `nextCaptureTargets`.
When `incompleteMetadata` is not empty, fix those entries first; the matrix
helper reports that as the next action before suggesting more captures.

To check a temporary or isolated corpus instead of `macos/OCRFixtures`, pass:

```bash
./script/ocr_fixture_matrix.sh --fixtures-dir /path/to/OCRFixtures --json
```

Relative `--fixtures-dir` paths are resolved from the shell's current directory
before the helper runs `verify.sh`.

To regression-test the fixture import, matrix, and collection helper scripts
without real camera samples, run:

```bash
./script/test_ocr_fixture_scripts.sh
```

Strict mode fails when manifests are missing, metadata is incomplete, webcam or
Continuity Camera coverage is absent, any accepted document side is missing for
either camera source, or the required condition labels are not represented,
including `non-document` rejection samples for each camera source. Mislabelled
samples do not satisfy this gate: accepted captures only count toward `good`,
and rejected captures only count toward degraded conditions.

## Privacy

Use test IDs or redacted/generated documents only. Do not commit real patient
identity data.
