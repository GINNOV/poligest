# Synthetic Webcam CIE Front Good Fixture

This fixture is a generated, non-private test card for the strict OCR fixture
matrix target:

```bash
accept webcam cie_front good
```

It is intentionally image-backed, not replay-only. `verify.sh` loads
`capture.png`, checks orientation and frame-quality metadata against the PNG,
replays the recorded OCR items through the production parser/capture gate, and
runs Vision OCR on the image through the static capture path.

The image uses synthetic identity data only:

- `ROSSI MARIO`
- `RSSMRA90M15H501Y`
- `CA12345AA`

