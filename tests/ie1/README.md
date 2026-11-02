# IE1 local verification

The headless QA host imports the installed, hash-pinned package and production BG
controller. It is not included in the product build. Fixture manifests and hashes
come unchanged from fork commits 9ca2f30 / 9cd2470, frozen before measurement.
JPEG uses the subsequently approved quality 95; WebP remains 92 and PDF embeds PNG.

Start Vite on 4196. Run `IEF_OUTPUT=/tmp/sol-ie1/g3-synthetic node tests/ie1/measure.mjs`,
then `IEF_OUTPUT=/tmp/sol-ie1/g3-synthetic python3 tests/ie1/metrics.py`.
Repeat with `IEF_MANIFEST=tests/fixtures/redaction-export/scenes-supplement.json`
and a separate output directory. All six scenes, including actual MODNet output,
are evaluated. Metrics require Pillow and Poppler `pdfimages`.
