# Wacom Signature Capture Requirements

We want in-browser signature capture for Wacom STU-430 in the React app.

Options described:
- Ink SDK for Signatures (JavaScript): cross-platform, no client install, paid per-signature.
- Ink SDK for Signatures for Windows (SigCaptX): Windows-only, requires install, browser component works with Chrome/Firefox/Edge.
- STU SigCaptX (STU SDK): Windows-only, free, requires install, no built-in UI (must build in JS).

Decision target:
- Prefer STU SigCaptX (free, Windows-only) if acceptable.
- Alternative: Ink SDK JS if cross-platform or paid licensing is required.

Integration needs:
- Local service URL/port and security constraints.
- Sample JS integration (from Wacom sample repo).
- Replace mouse-based signature capture in patient consent flow.

JS SDK implementation notes:
- Use Wacom Signature SDK for JavaScript via WebHID for STU-430.
- Copy SDK files from Wacom download into `public/wacom/`:
  - `signature_sdk.js`
  - `signature_sdk.wasm`
- Configure license in env:
  - `NEXT_PUBLIC_WACOM_SIGNATURE_KEY`
  - `NEXT_PUBLIC_WACOM_SIGNATURE_SECRET`
