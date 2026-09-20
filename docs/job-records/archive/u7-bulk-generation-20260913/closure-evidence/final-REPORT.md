# U7 final integration report

## Candidate identity

- Worktree: `/tmp/worklazy-u7-impl`
- Base/HEAD: `5ac8b6473d1786691fff7a83c5fde126f16e6af1`
- Final changed-file freeze: `/tmp/worklazy-u7-final/source-freeze.json`
- Changed files: 51; aggregate `3c6a62f0189a57c7ebd5f06931db7269a81aa949c608521f15f45592d610c54e`; fixed core 19 mismatch: 0.
- `git diff --check`: exit 0. Local execution Node: `v22.17.1`. This is not a claim about the GitHub Action runner; the workflow specifies Node 22.

## Reused immutable evidence

- Core: `/tmp/worklazy-u7-core-review/REPORT.md`; fixed 19 paths and dependency inputs match. It covers unit 11, browser 16, actual DOCX/ZIP/XLSX manifest reopening, cancellation, delayed persistence, partial commit, C1/C2/C3/C4 and two-DOCX independent oracle.
- UI: `/tmp/worklazy-u7-ui-prep/u7-2/ui-smoke-dist4-run2.log` exit 0, 19 flows/9 screenshots/6 downloads/external 0; `/tmp/worklazy-u7-ui-core-review/REPORT.md` independently closes stale-sample and old-ZIP-anchor counterexamples at exit 0.
- Visual: `/tmp/worklazy-u7-gemini-visual/ROOT-DECISION.md`, `/tmp/worklazy-u7-gemini-baselines/REPORT.md`, and `/tmp/worklazy-u7-viewport/REPORT.json` accept the frozen 9-screen UI corpus, 6 new initial/bottom baselines, and five viewport profiles with no new blocker.
- `@xmldom/xmldom` direct consumers: `/tmp/worklazy-u7-xmp-review/REPORT.md`; old/new synthetic JPEG cleanup is byte-identical. The final unchanged Vite configuration resolves the same ExifReader 4.42.0 browser/module sources (`src/exif-reader.js` SHA `7f8e4e67…`, `src/dom-parser.js` SHA `af3208e6…`) through the unchanged product worker SHA `55e9c054…` into `image-privacy.worker-COYs5HqS.js` SHA `c0de4bcc…`. The worker's existing empty-XMP limitation remains scoped and is not presented as full metadata support.
- These results remain valid because their tested core/UI source hashes match this freeze. Registration/test-list/doc-only changes do not invalidate their geometry, ownership, output, or cancellation paths.

## Generated inputs and production candidate

- `ZETAOFFICE_ASSET_BASE_URL=http://127.0.0.1:4498/ npm run prebuild`: exit 0 (`prebuild.log`). Owner scripts verified/copied fixed vendor inputs and regenerated notices; no generated vendor or notice was hand-edited.
- The generated license inventory has 731 package sections versus 728 at the base: additions are docxtemplater 3.69.3, pizzip 3.2.0, and its pako 2.2.0; `@xmldom/xmldom` 0.9.11 is replaced by 0.9.12; no other section was removed. The generator input carries the three direct-dependency notices and PizZip MIT-option statement.
- `env -u VITE_LOCAL_QA -u LOCAL_QA ZETAOFFICE_ASSET_BASE_URL=http://127.0.0.1:4498/ npm run build`: exit 0, 75 static pages (`build.log`).
- Production identity (`production-identity.json`): HTML `7937f5dd…`, entry JS `5089e130…`, CSS `60288b4b…`, U7 route `5d2228c8…`, generator worker `2161a601…`.

## Final commands

- `npm run test:unit`: first exit 1, 535 pass/3 stale registration-count assertions (`unit.log`); corrected inventory/scenario inputs, then exit 0, 538/538 (`unit-attempt2.log`). Product/build inputs did not change.
- `npm run test:static`: exit 0 (`static.log`).
- `node tests/tool-registry-routes.mjs`: exit 0, 22 tools (`registry.log`).
- `TEST_BASE_URL=http://127.0.0.1:4392 npm run test:excel-compare`: exit 0 (`excel-compare-intercepted.log`), external HTTP(S) observed and blocked before execution: 12.
- `TEST_BASE_URL=http://127.0.0.1:4392 npm run test:excel-cleaner`: exit 0 (`excel-cleaner-intercepted.log`), external HTTP(S) observed and blocked before execution: 27.
- `npm run test:qr-bulk`: exit 0 (`qr-bulk.log`), external requests 0.
- `TEST_BASE_URL=http://127.0.0.1:4392 npm run test:utilities`: exit 0 (`utilities-final-intercepted-attempt3.log`), external HTTP(S) observed and blocked before execution: 128. Normal analytics-loader presence is verified by its script DOM and the intercepted provider requests; the scripts were not executed. The isolated video document still verifies analytics markers, excludes ads, and exercises its runtime boundary.
- `npm run test:recovery`: exit 0, 155 cases (`recovery.log`), external 0 where asserted.
- `BUNDLE_BASELINE=.../bundle-baseline.json BUNDLE_ROUTES=document-generator npm run bundle:measure`: exit 0 (`bundle.log`, `bundle-summary.json`). 로그의 `affected routes: document-generator`가 실제 선택값을 확인한다.

Earlier Excel and utilities runs with granted consent and unblocked providers are retained only as functional observations. They are not the privacy-safe final evidence. The first interception attempts are also retained: empty fulfillment conflicted with the old Naver beacon-execution assertion, and a blob-worker over-broad block timed out. The final harness blocks only external HTTP(S) before execution and permits local/blob/data resources.

The named Excel/QR/recovery checks are the directly affected C1/C2/C3/shared-shell consumers. Fixed core evidence covers generator output itself. Unchanged office/video/legacy engines and utilities outside these connection surfaces reuse their source-bound prior evidence; no whole-browser or whole-office sweep was repeated merely due to registration.

## Visual baseline boundary

`VISUAL_ONLY=document-generator UPDATE_VISUAL_BASELINES=1 npm run test:visual` and the ordinary filtered comparison each generated/compared exactly six U7 initial/bottom images with U7 diff 0. Both overall commands exit 1 solely because the global inventory already lacks seven U6 document-redactor baselines. Raw logs are `visual-baseline-u7.log` and `visual-compare-u7.log`. No U6 baseline was fabricated and no global assertion was weakened. U7 selected/result interaction coverage remains in the immutable 9-screen corpus.

## Bundle attribution

Canonical baseline SHA is `4caaa9c6…`; all five limits are `null`, overrides `{}`, multiplier 1. Current gzip bytes are entry 321,518, affected U7 route 546,784, shared 2,217,089, app 6,693,956, CSS 39,220. Canonical deltas are 22,241 / 546,784 / 244,346 / 850,241 / 1,533. Against the prior U6 release, entry is +3,194, app +550,429, shared +272,897, and CSS +47. The new U7 route is not subtracted from the unrelated redactor route. Attribution/inventory passed; no capacity cleanup was performed.

## Result

U7 implementation and its affected final integration gates pass. The only nonzero final command is the scoped visual command's inherited global U6 missing-baseline assertion; its six U7 comparisons themselves pass and were independently viewed. No commit or push was made in this worktree at report time.
