# ScanID OCR Reliability Plan

## Target

ScanID should capture only when the app has stable evidence that a physical Italian ID document is in frame and enough trusted fields were extracted to create or review a patient record.

## Capture Pipeline

1. Detect the document before trusting OCR.
   - Prefer a stable ID-card rectangle with an aspect ratio near 1.586.
   - Reject clipped, tiny, unstable, or low-text frames.
   - Use OCR labels only as supporting evidence, never as the capture trigger by themselves.

2. Normalize the capture image.
   - Crop to the card bounds.
   - Prefer the detected rectangle when OCR bounds spread across the full frame.
   - Run accurate OCR on the normalized image.

3. Score final parse quality.
   - Strong identifiers: codice fiscale, Tessera card number, CIE document number.
   - Identity evidence: surname, name, date/place of birth, gender.
   - Document evidence: classified document type or multiple document labels.
   - Reject single-field parses and header-only frames.

4. Keep live OCR conservative.
   - Live fast OCR can update feedback and overlays.
   - Capture requires repeated ready frames.
   - Auto-create must use the stricter final parse gate.

5. Build a fixture corpus.
   - Include CIE front/back and Tessera front/back.
   - Cover webcam, Continuity Camera, glare, blur, tilted cards, partial frame, dark and light backgrounds.
   - Store expected parsed JSON and run it in CI.
   - Use `OCRFixtures/manifest.json` for real captured images; `verify.sh` runs it when present.
   - Include both `accept` fixtures for readable documents and `reject` fixtures for bad/non-document frames.
   - Attach `quality` expectations to real fixtures so blur/glare/exposure thresholds can be tuned from captured images.

## Current Implementation Stage

- Card-bound filtering and rectangle fallback exist in `Scanner.swift`.
- Post-capture accurate OCR can run on a perspective-corrected card image in `ScanCaptureLogic.swift`.
- Capture acceptance is now confidence based instead of accepting any single parsed field.
- Live capture requires repeated ready frames through `LiveScanController`.
- Live capture now rejects unusable frame quality signals: blur-like low edge detail, heavy glare, and extreme exposure.
- Parser cleanup now respects the classified document side so back-side scans do not inherit front-only fields from nearby labels.
- `verify.sh` now includes generated image fixtures that render synthetic ID cards, run Vision OCR, and assert expected `IDData`.
- Static capture now runs Vision barcode detection alongside accurate OCR and feeds decoded payload lines into the same parser, so MRZ/card-number payloads can beat fragile text heuristics.
- CIE-back MRZ parsing now treats the structured MRZ identity as authoritative and only attaches a visible codice fiscale line when it is name-consistent with the MRZ surname/name, preventing a wrong-person CF line from polluting a strong MRZ parse.
- `OCRFixtures/` now defines the real-image fixture corpus contract and `verify.sh` runs `OCRFixtures/manifest.json` when real captures are present.
- Real-image fixtures now support explicit `accept` and `reject` expectations, so the corpus can prove both successful extraction and bad-frame rejection through the final capture gate.
- Static images now use the same frame-quality assessment as live camera buffers, and real fixtures can assert `usable`, `unusable`, or ignored quality expectations.
- Frame-quality results now expose rejection reasons and metric summaries, so failed real fixtures identify whether thresholds rejected blur, glare, darkness, or exposure.
- The app can export the current scan as a timestamped OCR fixture folder containing `capture.png` plus a ready `manifest.json` entry.
- `verify.sh` discovers nested `OCRFixtures/**/manifest.json` files, so exported fixture folders can be dropped into the corpus without hand-merging manifests.
- Real fixtures now carry coverage metadata for capture source, document side, and condition; `verify.sh` reports the aggregate coverage matrix.
- Camera snapshots now apply the same resolved display orientation as the preview before post-capture OCR or fixture export, while AVCaptureVideoDataOutput buffers stay raw so live OCR receives base Vision orientation and captured images are not double-rotated.
- Exported webcam and Continuity Camera fixtures now include an orientation audit block with OCR orientation, display snapshot orientation, preview angles, capture angles, raw camera-buffer dimensions, and PNG dimensions; exported OCR items also include pixel bounds on the saved PNG. Strict fixture verification treats missing camera-orientation metadata, stale preview/capture angle metadata, invalid dimensions, raw/display dimension mismatches, PNG dimension mismatches, or OCR item bounds that no longer project onto the saved PNG as incomplete.
- Exported fixtures now include readiness diagnostics: frame-quality summary, structured frame-quality metrics, capture/guidance booleans, score, marker/item counts, and missing-front-name status. Strict real-camera coverage treats missing or stale diagnostics as incomplete so rejected captures remain actionable and quality thresholds can be tuned from verified metrics.
- Exported fixtures also preserve observed parsed fields separately from expected ground truth, so rejected captures retain the partial OCR output needed for parser and capture-gate debugging.
- Exported fixtures now preserve raw OCR item text, confidence, and normalized bounding boxes, so real camera regressions can be diagnosed from layout evidence instead of only final parsed fields.
- Exported fixtures now preserve barcode/MRZ/card payload evidence and strict replay feeds those payloads back into the parser, so Tessera-back and CIE-back captures that depend on Vision barcode detection are reproducible from the manifest instead of only from the original image.
- Strict fixture coverage now validates that camera OCR item evidence is well formed and consistent with diagnostics, preventing empty text, invalid confidence, out-of-range boxes, or stale item counts from entering the corpus as usable evidence.
- Capture readiness now carries stable rejection reason codes, and exported camera fixtures preserve them so rejected real captures explain whether the blocker was layout, confidence, frame quality, missing names, weak document evidence, or codice fiscale conflicts.
- Exported fixture condition labels now come from frame-quality failures and capture-readiness reasons, so rejected samples land in coverage buckets like `glare`, `slight-blur`, `dark-background`, `light-background`, `partial-frame`, and `non-document` instead of a generic negative bucket; codice-fiscale consistency conflicts are classified as `partial-frame` because they indicate mixed or contradictory document evidence.
- The fixture export dialog now lets the collector keep the computed condition label or choose a strict-matrix label such as `tilted`, avoiding hand-edited manifests for real capture coverage.
- Real fixture replay now preserves recognized OCR items and uses the same item-aware final capture gate as the app, so fixture acceptance exercises card-layout plausibility instead of only parsed field content.
- Card-layout plausibility now allows valid cropped/full-card OCR text to span most of the normalized card image while still rejecting scattered text that spills across the frame.
- Strict camera fixture metadata now rejects stale diagnostics when `canCapture` disagrees with the fixture expectation or `missingFrontNames` disagrees with the observed front-side parsed fields.
- Strict camera fixture metadata now replays readiness diagnostics against the exported OCR items and frame-quality metrics, including rejection reason codes, so stale or hand-edited failure explanations cannot enter the corpus.
- Strict camera fixture metadata now rejects stale `observed` fields when they no longer match production parser replay from the exported `observedItems`.
- Real fixtures with exported `observedItems` now replay those OCR items through the production parser and final capture gate: camera `observed` fields must match replay, accepted fixtures must match `expected`, and rejected fixtures must still be rejected. This gives deterministic parser/gate coverage in addition to real-image Vision OCR replay.
- Live capture now requires OCR bounding boxes to form a plausible card-like layout, so strong-looking identity text scattered across the frame cannot trigger capture by itself.
- Post-capture OCR now evaluates rotated card-image candidates and keeps the strongest parse, so sideways card captures like portrait/Continuity Camera frames are not trusted in the wrong orientation.
- Auto-zoom/crop defaults on for new installs, so post-capture OCR tries card-edge crop or perspective correction before the accurate OCR pass while still falling back to the full image when no reliable crop is found.
- `verify.sh` includes a rotated synthetic Tessera Sanitaria static-capture fixture that must pass frame quality, final capture gating, and exact field assertions after orientation recovery.
- Final capture selection no longer accepts stale live fallback OCR over contradictory OCR from the frozen snapshot. Fallback can still rescue an empty snapshot OCR result, but once snapshot OCR has document evidence it must stand or fail on that evidence so the frozen image, exported fixture, and trusted fields stay aligned.
- Final capture selection now treats generic frozen OCR text as noise instead of document evidence, so an accepted live fallback can still rescue a frozen frame that recognized only unrelated text while document-marker snapshots continue to block stale fallback data.
- Final capture now rejects parsed surname/name, birth-date/gender, birth-date-only, or resolved birthplace fields that conflict with the codice fiscale code, preventing sideways/noisy OCR fields from being accepted alongside an otherwise strong identifier.
- Parser output now clears surname/name, codice-fiscale-inconsistent birth dates, and resolved birthplace mismatches, so the extracted-fields panel does not present OCR hallucinations such as `ARTO`/`pinn`, impossible dates, or the wrong comune as trusted data.
- Spatial name extraction now requires unvalidated label-adjacent names to look like printed ID text, so lowercase OCR fragments such as `arto`/`pinn` cannot become trusted surname/name values when no codice fiscale confirms them.
- Barcode payload merging and replacement are now conservative: a decoded back-side payload cannot override visible front-side OCR, even when the decoded payload scores higher than weak or partial visible OCR, and a decoded codice fiscale from a back-side payload only fills missing front OCR when visible names can validate it.
- Tessera Sanitaria side classification now treats visible front-side name labels as front evidence even when OCR misses the codice fiscale, so weak front captures do not get misclassified as back-side documents.
- Front-side CIE and Tessera Sanitaria captures now require a reliable surname/name pair before completion, so a valid codice fiscale plus birth fields cannot create a successful scan with missing patient names.
- Capture readiness now checks OCR-item evidence for direct identity and identifier fields, so high-confidence labels cannot hide low-confidence or missing surname/name/codice fiscale values and trigger capture. Derived fields such as birth date and gender can still come from a validated codice fiscale.
- Parser-only final capture decisions are now rejected when direct identity or identifier fields have no OCR item evidence, so a plausible parsed payload cannot bypass the card-layout and field-evidence gates.
- Capture readiness now also requires matched direct field evidence to sit inside the detected document/label anchor region, so matching patient text from UI panels or background clutter outside the card cannot satisfy the capture gate.
- Low-confidence extracted fields now show a sharp-text live prompt and export as `slight-blur` fixture conditions, so collectors get actionable operator feedback and usable threshold-tuning samples.
- Live scan feedback now gives a specific name/surname prompt when a front-side document has identifier evidence but is missing reliable patient names, instead of showing a generic field-reading or identity message.
- `SCANID_REQUIRE_REAL_OCR_FIXTURES=1 ./verify.sh` now turns the real-image corpus into a strict coverage gate for webcam and Continuity Camera coverage of every accepted document side, rejected frames, and condition labels.
- Strict fixture coverage now requires an explicit `non-document` rejection condition, so background/UI/text noise is part of the reliability proof instead of only bad document photos.
- Strict fixture coverage now tracks required condition labels per camera source, so degraded-frame behavior must be proven separately for webcam and Continuity Camera captures.
- Strict fixture coverage now separates accepted `good` samples from rejected degraded samples, so mislabelled captures cannot satisfy the reliability matrix.
- The fixture export dialog now mirrors those rules by offering only `good` for accepted captures and degraded condition labels for rejected captures.
- The export dialog now previews the full fixture matrix target and updates it when the condition changes, so collectors can confirm the exact accept/reject source, side, and condition slot before saving.
- The fixture export workflow now remembers the last collection directory and confirms the strict matrix target in the success status, reducing repetitive folder picking and making each captured sample easier to match against `./script/ocr_fixture_matrix.sh`.
- Exported fixture folders now include a self-describing `README.md` and `matrixTarget` manifest field, so each capture carries its import command, strict coverage slot, an isolated pre-import matrix check, and next-target collection guidance even after it leaves the app.
- Strict fixture metadata now requires `matrixTarget` for webcam and Continuity Camera fixtures, and rejects stale target values when they disagree with `expect`, capture source, document side, or condition.
- Strict fixture metadata now also rejects accepted fixtures whose declared `documentSide` disagrees with the expected or replayed OCR document type, preventing a mislabeled CIE/Tessera side from satisfying the coverage matrix.
- When strict mode runs before any real manifests exist, `verify.sh` now prints the full missing fixture checklist instead of only reporting that the corpus is empty.
- `./script/ocr_fixture_matrix.sh` now gives collectors a focused matrix-status command without reading the full verifier log, including a short `Next capture targets` list derived from the strict verifier gaps, a `--next` single-target query mode for operator loops, a `--next-command <exported-fixture-dir>` mode that prints target-locked dry-run/import commands, a `--json` mode for app or automation integration, and `--fixtures-dir` for isolated/custom corpus checks. Custom fixture paths are canonicalized before the helper enters `apps/macos/`, so relative paths work from the caller's current directory. If any imported fixture has incomplete metadata, the helper prioritizes fixing that stale fixture before suggesting new captures.
- `./script/import_ocr_fixture.sh` now rejects impossible accept/reject condition pairs, duplicate destination folders, stale `matrixTarget` values, wrong-slot `--expect-target` and `--expect-next` imports, and image symlinks that resolve outside the exported folder up front, then preflights each exported folder in an isolated fixture corpus before staging it into `apps/macos/OCRFixtures/`, so incomplete metadata, parser/capture-gate failures, misleading strict-matrix labels, repeated imports, stale next-target commands, wrong matrix-slot captures, and accidental external/private image references are rejected before they pollute the real corpus. The same preflight can run with `--dry-run` before copying anything, and successful dry-runs print the exact destination they would import to; successful imports print matrix targets and immediately report matrix status, reducing manual copy mistakes during capture sessions.
- `./script/test_ocr_fixture_scripts.sh` now covers the fixture import fast-fail validations and the matrix command against an isolated empty corpus, so collection tooling regressions are caught without requiring physical camera samples.
- `./script/build_and_run.sh --smoke` now builds and launches ScanID with a prompt-free smoke-test environment, and smoke mode disables camera access at the `CameraManager` boundary so startup verification does not discover devices, start a session, or block on the macOS camera permission dialog.
- Post-capture OCR now goes through an injectable `OCRProvider`, with Vision as the default provider, so a commercial engine such as KBY can be evaluated behind the same crop/orientation/barcode/parser/capture-gate pipeline instead of requiring a rewrite.
- Exported camera fixtures now record `ocrProvider` and strict fixture verification requires it, so future Vision-vs-SDK comparisons cannot mix OCR evidence without naming the engine that produced it.
- The fixture import validator now fast-fails camera exports missing `ocrProvider`, catching mixed-engine evidence before the slower isolated Swift preflight runs.
- `./script/collect_ocr_fixture.sh` now wraps the operator loop by printing the current next strict-matrix target and, after export, running the target-locked dry-run/import path against that same target.
- The same collection helper supports `--open-app`, which prints the next target and launches ScanID through the existing build/run entrypoint for an operator capture session.
- The collection helper also supports `--latest-export`, so after an operator exports a fresh ScanID folder into `exports/`, the preflight/import command can select the newest generated fixture folder without copying the timestamped path.
- Exported fixture README files now point at `./script/collect_ocr_fixture.sh --export-dir ...`, so each exported sample carries the same guided import command as the collection workflow.
- Camera mode now exposes a manual `Freeze Current Camera Frame` action, so rejected or never-completing Continuity Camera frames can still be frozen, reprocessed once, and exported as OCR fixtures with the same orientation, diagnostics, observed fields, OCR items, and barcode evidence as auto-captured frames.
- `./script/collect_ocr_fixture.sh --open-app` now creates the repository `exports/` folder and launches ScanID with that as the default OCR fixture export location; `--expect-target` lets an urgent out-of-order failure sample such as `reject continuity negative partial-frame` be imported without pretending it satisfies the current next matrix slot.
- The importer now detects parser/diagnostic drift in exported manifests and prints a stale-export hint. This intentionally rejects pre-fix exports such as `exports/scanid-20260623-133717-spsmra71c05g023h`, whose old manifest still claims `Dati sanitari regionali` as the birthplace even though current parser replay correctly clears it.
- Export success in camera mode now returns to a fresh live camera scan instead of leaving the app in a frozen one-shot export state. Camera session start/stop/restart operations are serialized through a dedicated session-control queue, and menu-state sync is deferred until camera state publishes have landed, so `Freeze Current Camera Frame` re-enables after export/new-scan instead of remaining greyed out.
- Tessera Sanitaria front classification now recognizes cropped regional-service-card headers such as `CARTA REGIONALE DEI SERVIZI`, so Continuity Camera crops that miss the literal `TESSERA SANITARIA` header still classify as `TESSERA_SANITARIA_FRONT`.
- Parser sanitization now derives missing gender from a validated codice fiscale birth-day code, including omocodia-normalized date positions, so captures that miss the printed `Sesso` value still export stable expected gender when the codice fiscale is trusted.
- CIE front nationality parsing now prefers the same-line `Cittadinanza` suffix before nearby spatial candidates and rejects label/gender rows as nationality values, preventing distorted OCR geometry from turning `SESSO M` into the nationality.
- CIE-back compact MRZ OCR now counts as direct field evidence for document number and identity names during final capture readiness, so Vision output such as `I<ITACA00000AA...` and `ROSSI<<MARIO...` can satisfy the strict item-aware capture gate without requiring space-separated text.
- Real fixture manifests now support an explicit `replayOnly: true` mode. These fixtures do not require an image path and skip Vision/static-image replay, but still replay `observedItems` and barcode payloads through the production parser and final capture gate. This gives a privacy-preserving path for redacted/anonymized CI fixtures without weakening normal image-backed fixture validation.
- Replay-only fixture validation now rejects manifests that still declare image paths or orientation metadata, so private capture images and device-specific orientation details cannot be smuggled into the committed replay corpus.
- `./script/redact_ocr_fixture.rb` converts a private exported fixture into a replay-only fixture by removing image/orientation data and replacing identity fields plus OCR item text with a fixed synthetic identity. This lets private capture evidence be turned into commit-safe parser/capture-gate regression fixtures.
- `./script/collect_ocr_fixture.sh --redact-replay` now folds that sanitizer into the guided collection loop, so operators can preflight or import a target-locked replay-only fixture from `--latest-export` without manually creating temporary redacted folders.
- `./script/collect_ocr_fixture.sh --audit-exports` now compares local exported fixture manifests against the current strict matrix, prints redacted dry-run commands only for exports that fill missing slots, and summarizes already-covered or out-of-order targets so duplicate captures do not waste collection time.

## Verified Evidence on 2026-06-23

- `bash verify.sh` passes with the current parser, capture gate, orientation, synthetic OCR, fixture metadata, frame-quality, and live-scan unit coverage.
- `./script/build_and_run.sh --smoke` passes and launches without macOS camera permission prompts because smoke mode disables camera access at the `CameraManager` boundary.
- `git diff --check` passes for the OCR/capture/script/report files touched by this reliability work.
- The rebuilt app was relaunched from `apps/macos/build/DerivedData/Build/Products/Debug/ScanID.app`, and macOS menu automation reported the expected live-camera idle state: `New Scan` enabled, `Freeze Current Camera Frame` enabled, and `Export OCR Fixture...` disabled until a frame is frozen.
- The latest fresh export, `exports/scanid-20260623-180942-spsmra71c05g023h`, passes isolated preflight with `./script/collect_ocr_fixture.sh --latest-export --expect-target "accept continuity tessera_front good" --dry-run`.
- Redacted replay-only fixtures in `apps/macos/OCRFixtures/` now prove these real-capture parser/capture-gate slots without committing private images: accepted Continuity Camera Tessera-front good, rejected Continuity Camera non-document, and rejected Continuity Camera partial-frame. They also prove that multiple freeze/export cycles can occur in one app session after the menu-state fix.
- Non-private image-backed fixtures now cover `accept webcam cie_front good`, `accept webcam cie_back good`, and `accept webcam tessera_front good`. They exercise committed PNGs through Vision OCR/static capture, validate orientation metadata, validate frame-quality metrics against each image, and replay recorded OCR item bounds through the parser/capture gate.
- The imported redacted fixtures pass a privacy scan for the source identity strings from the private exports.
- `./script/test_ocr_fixture_scripts.sh` passes with import-validator, redaction, matrix, and collection coverage proving that missing images fail by default, only explicit replay-only fixtures may omit an image path, replay-only fixtures may not retain image/orientation metadata, the redactor removes source identity strings from expected fields and OCR item text, and `collect_ocr_fixture.sh --redact-replay --dry-run` drives the full target-locked preflight path.
- `./script/collect_ocr_fixture.sh --audit-exports` reports no remaining local exports that match the current missing matrix targets; the existing private exports are duplicates/out-of-order for Continuity Tessera-front good, Continuity non-document, Continuity partial-frame, and one unknown Continuity accept.

## Release Gate Status

The OCR reliability goal is improved but not yet release-complete. The strict real-fixture matrix is still incomplete. The private real captures under `exports/` remain local-only; three sanitized replay-only derivatives have been imported into `apps/macos/OCRFixtures/` for commit-safe parser/capture-gate regression coverage, and one non-private image-backed synthetic fixture now proves the webcam CIE-front good path. More image-backed fixtures are still needed before release to prove the remaining document sides and degraded conditions.

Current strict-matrix gaps from the committed replay plus synthetic-image corpus:

- Accepted Tessera back captures are still missing.
- Accepted webcam Tessera back is still missing.
- Accepted Continuity Camera CIE front, CIE back, and Tessera back captures are missing.
- Rejected degraded Continuity Camera conditions are still missing for glare, slight blur, dark background, light background, and tilted captures.
- Webcam rejected conditions are missing for every strict condition, including non-document and partial-frame.
- Additional image-backed fixtures are still needed before release to prove Vision OCR, orientation metadata, frame-quality metrics, and OCR item image bounds for the remaining matrix slots.

## Next Highest-Impact Work

1. Continue converting usable private exports into replay-only redacted fixtures when they cover parser/capture-gate slots, and collect synthetic/test-card image fixtures for the image-backed Vision/orientation/frame-quality release gate.
2. Continue the strict matrix from the current next targets: `accept webcam tessera_back good`, `accept continuity cie_front good`, `accept continuity cie_back good`, and `accept continuity tessera_back good`.
3. Collect rejected degraded samples for webcam and Continuity Camera: `tilted`, `glare`, `slight-blur`, `dark-background`, `light-background`, `partial-frame`, and `non-document`.
4. Run `./script/collect_ocr_fixture.sh --latest-export --expect-target "<app-reported matrix target>" --dry-run` for each fresh export before importing it into any corpus.
5. For commit-safe parser/capture-gate coverage, rerun that import with `--redact-replay`; for image-backed release evidence, import only synthetic/test-card images or explicitly approved non-private captures.
6. Run `./script/ocr_fixture_matrix.sh` for the full checklist, then `SCANID_REQUIRE_REAL_OCR_FIXTURES=1 ./verify.sh` before treating the matrix as proven.
7. Build a contained SDK spike by adapting KBY or another document-recognition SDK to `OCRProvider`; compare it against the same fixture matrix before replacing the Vision default.
8. Tune frame-quality thresholds against real webcam and Continuity Camera captures using fixture `quality` expectations.
9. Verify the exported Continuity Camera PNGs visually against the phone orientation and keep those images in the fixture corpus as orientation regressions.
10. Continue splitting parser extraction by side as the fixture corpus exposes side-specific edge cases.
