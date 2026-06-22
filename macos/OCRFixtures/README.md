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

Copy the exported image and manifest entry into this corpus when the sample uses
test or redacted data. You can also copy the entire exported folder under
`OCRFixtures/`; `verify.sh` discovers nested manifests automatically. Re-run
`verify.sh` after adding it.

## Required Capture Matrix

Add at least one fixture for each document side:

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

## Manifest Format

Use `manifest.example.json` as the template. Image paths are relative to the
manifest file that declares them. Expected dates use `dd/MM/yyyy`.

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
- `condition`: a short label such as `good`, `tilted`, `glare`, `slight-blur`, `dark-background`, `light-background`, `partial-frame`, or `non-document`

`verify.sh` prints a coverage summary for all discovered real fixtures. Treat
`unknown` or `unspecified` metadata as unfinished fixture work.

## Privacy

Use test IDs or redacted/generated documents only. Do not commit real patient
identity data.
