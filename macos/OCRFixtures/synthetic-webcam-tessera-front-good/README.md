# Synthetic Webcam Tessera Front Good Fixture

This fixture is a generated, non-private test card for the strict OCR fixture
matrix target:

```bash
accept webcam tessera_front good
```

It is image-backed, not replay-only. `verify.sh` loads `capture.png`, validates
orientation and frame-quality metadata against the PNG, replays recorded OCR
item bounds through the production parser/capture gate, and runs Vision OCR on
the image through the static capture path.

The image uses synthetic identity data only:

- `ROSSI MARIA`
- `RSSMRA95T64F205W`
