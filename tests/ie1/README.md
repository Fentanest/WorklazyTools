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

## Transparent canvas / eraser regression

`transparent-eraser.mjs` serves UI checks from the completed `dist` automatically
(`IE_DIST` changes that path). `IE_UI_BASE_URL` may instead point to an immutable
production preview. A Vite-client UI is rejected, because dependency discovery
can reload the page during a gesture. `TEST_BASE_URL` is only the QA engine host
for the direct engine cases (for example Vite on 4214). Run `npm run build` first.

Mobile coordinates wait for fonts and six stable animation frames after instant
scrolling; all original hit-test and PNG alpha assertions remain. To stress the
four mobile variants without the engine host:

```
IE_MOBILE_CPU_THROTTLE=4 IE_TRANSPARENT_OUTPUT=/tmp/ie-mobile-run-01   node --test --test-name-pattern='^transparent sample and real eraser UI .*mobile$' tests/ie1/transparent-eraser.mjs
```

The throttle changes renderer scheduling only. There is no automatic failed-case
retry. Consecutive-run evidence must preserve each command, exit and four-case TAP
summary; a failed run breaks the streak.
