# Synthetic Webcam CIE Back Good Fixture

This fixture is a generated, non-private test card for the strict OCR fixture
matrix target:

```bash
accept webcam cie_back good
```

It is image-backed, not replay-only. `verify.sh` loads `capture.png`, validates
orientation and frame-quality metadata against the PNG, replays recorded OCR
item bounds through the production parser/capture gate, and runs Vision OCR on
the image through the static capture path.

The image uses synthetic identity/MRZ data only:

- `ROSSI MARIO`
- `RSSMRA90A15H501Y`
- `CA00000AA`
