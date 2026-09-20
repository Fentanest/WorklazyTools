| 실행 | exit | 초 | 명령 | 출력 |
|---|---:|---:|---|---|
| tsc | 0 | 18.92 | `npx tsc -b` | [log](logs/tsc.log) |
| unit | 0 | 4.835 | `npm run test:unit` | [log](logs/unit.log) |
| build-production | 0 | 111.101 | `npm run build` | [log](logs/build-production.log) |
| static-production | 0 | 0.897 | `npm run test:static` | [log](logs/static-production.log) |
| pdf-finish | 0 | 149.342 | `npm run test:pdf-finish` | [log](logs/pdf-finish.log) |
| browser-pdf | 0 | 9.446 | `TEST_SCOPE=pdf npm run test:browser` | [log](logs/browser-pdf.log) |
| browser | 0 | 55.223 | `npm run test:browser` | [log](logs/browser.log) |
| new-tools | 0 | 120.554 | `npm run test:new-tools` | [log](logs/new-tools.log) |
| utilities | 0 | 103.682 | `npm run test:utilities` | [log](logs/utilities.log) |
| office | 0 | 26.734 | `npm run test:office` | [log](logs/office.log) |
| office-repeat-01 | 0 | 27.417 | `npm run test:office` | [log](logs/office-repeat-01.log) |
| office-repeat-02 | 0 | 28.177 | `npm run test:office` | [log](logs/office-repeat-02.log) |
| office-repeat-03 | 0 | 27.241 | `npm run test:office` | [log](logs/office-repeat-03.log) |
| office-repeat-04 | 0 | 26.434 | `npm run test:office` | [log](logs/office-repeat-04.log) |
| office-repeat-05 | 0 | 27.448 | `npm run test:office` | [log](logs/office-repeat-05.log) |
| office-repeat-06 | 0 | 28.616 | `npm run test:office` | [log](logs/office-repeat-06.log) |
| office-repeat-07 | 0 | 26.555 | `npm run test:office` | [log](logs/office-repeat-07.log) |
| office-repeat-08 | 0 | 25.834 | `npm run test:office` | [log](logs/office-repeat-08.log) |
| office-repeat-09 | 0 | 27.474 | `npm run test:office` | [log](logs/office-repeat-09.log) |
| office-repeat-10 | 0 | 26.553 | `npm run test:office` | [log](logs/office-repeat-10.log) |
| qr-bulk | 0 | 48.906 | `npm run test:qr-bulk` | [log](logs/qr-bulk.log) |
| qr-font-render | 0 | 39.303 | `npm run test:qr-font-render` | [log](logs/qr-font-render.log) |
| recovery | 0 | 276.287 | `npm run test:recovery` | [log](logs/recovery.log) |
| legacy-oracle | 0 | 5.212 | `npm run fixtures:pdf-legacy-oracle` | [log](logs/legacy-oracle.log) |
| excel-cleaner | 0 | 53.241 | `npm run test:excel-cleaner` | [log](logs/excel-cleaner.log) |
| excel-compare | 0 | 20.576 | `npm run test:excel-compare` | [log](logs/excel-compare.log) |
| visual-ko | 0 | 438.383 | `npm run test:visual` | [log](logs/visual-ko.log) |
| visual-en | 0 | 440.063 | `npm run test:visual` | [log](logs/visual-en.log) |
| bundle | 0 | 77.403 | `npm run bundle:measure` | [log](logs/bundle.log) |
| css-orphans | 0 | 0.636 | `npm run css:orphans` | [log](logs/css-orphans.log) |
| legacy-manifest | 0 | 0.337 | `npm run legacy:manifest` | [log](logs/legacy-manifest.log) |
| registry | 0 | 0.521 | `node tests/tool-registry-routes.mjs` | [log](logs/registry.log) |
| build-qa | 0 | 94.711 | `VITE_LOCAL_QA=1 npm run build` | [log](logs/build-qa.log) |
| a11y | 0 | 30.843 | `A11Y_MAX_TOTAL=0 npm run test:a11y` | [log](logs/a11y.log) |
| rendering | 0 | 75.567 | `npm run test:rendering` | [log](logs/rendering.log) |
| engine-original | 0 | 4.24 | `bwrap --bind / / --dev-bind /dev /dev --bind /tmp/worklazy-u4-3-review4 /tmp/worklazy-u4-3-review --chdir /tmp/worklazy-u4-3-review/repo node --experimental-strip-types /tmp/worklazy-u4-3-review/probes/engine.mjs` | [log](logs/engine-original.log) |
| qr-compare-original | 0 | 5.767 | `bwrap --bind / / --dev-bind /dev /dev --bind /tmp/worklazy-u4-3-review4 /tmp/worklazy-u4-3-review --chdir /tmp/worklazy-u4-3-review/repo node --experimental-strip-types /tmp/worklazy-u4-3-review/probes/qr-compare.mjs` | [log](logs/qr-compare-original.log) |
| supplement-engine-original | 0 | 1.74 | `bwrap --bind / / --dev-bind /dev /dev --bind /tmp/worklazy-u4-3-review4 /tmp/worklazy-u4-3-review2 --chdir /tmp/worklazy-u4-3-review2/repo node --experimental-strip-types /tmp/worklazy-u4-3-review2/probes/supplement-engine.mjs` | [log](logs/supplement-engine-original.log) |
| focused-browser-original | 0 | 11.642 | `bwrap --bind / / --dev-bind /dev /dev --bind /tmp/worklazy-u4-3-review4 /tmp/worklazy-u4-3-review --chdir /tmp/worklazy-u4-3-review/repo node --experimental-strip-types /tmp/worklazy-u4-3-review/probes/focused-browser.mjs` | [log](logs/focused-browser-original.log) |
| supplement-browser-original | 0 | 149.355 | `bwrap --bind / / --dev-bind /dev /dev --bind /tmp/worklazy-u4-3-review4 /tmp/worklazy-u4-3-review2 --chdir /tmp/worklazy-u4-3-review2/repo node --experimental-strip-types /tmp/worklazy-u4-3-review2/probes/supplement-browser.mjs` | [log](logs/supplement-browser-original.log) |
| independent-browser | 0 | 33.44 | `node /tmp/worklazy-u4-3-review4/probes/independent-browser.mjs` | [log](logs/independent-browser.log) |
| preflight-after | 1 | 18.208 | `node /tmp/worklazy-u4-3-review4/probes/preflight-measure.mjs` | [log](logs/preflight-after.log) |
| office-timing-1 | 0 | 25.623 | `node /tmp/worklazy-u4-3-review4/probes/office-timing.mjs` | [log](logs/office-timing-1.log) |
| office-timing-2 | 0 | 25.508 | `node /tmp/worklazy-u4-3-review4/probes/office-timing.mjs` | [log](logs/office-timing-2.log) |
| office-timing-3 | 0 | 24.312 | `node /tmp/worklazy-u4-3-review4/probes/office-timing.mjs` | [log](logs/office-timing-3.log) |
| build-before-qa | 0 | 106.629 | `VITE_LOCAL_QA=1 npm run build` | [log](logs/build-before-qa.log) |
| preflight-before | 1 | 19.971 | `node /tmp/worklazy-u4-3-review4/probes/preflight-measure.mjs` | [log](logs/preflight-before.log) |
| preflight-before-rerun | 0 | 67.031 | `node /tmp/worklazy-u4-3-review4/probes/preflight-measure.mjs` | [log](logs/preflight-before-rerun.log) |
| preflight-after-rerun | 0 | 72.38 | `node /tmp/worklazy-u4-3-review4/probes/preflight-measure.mjs` | [log](logs/preflight-after-rerun.log) |
