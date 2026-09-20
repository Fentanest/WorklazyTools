# U8 R4 UI lifecycle repair — Codx

**The two reported blockers are repaired and scoped checks are complete. Product writing is stopped for independent review.** No commit/push/deploy. Source `/tmp/worklazy-u8-impl`; new QA build `/tmp/worklazy-u8-ui-fix/qa-dist`. Original R3 build and17 PNGs remain intact.

## Cause and change

R3 `invalidate()` canceled only the compare session, leaving an in-flight report promise alive. `run()` also left the previous React result state visible while the next read was pending. Independent original observations and downloaded XLSX are retained in `/tmp/worklazy-u8-ui-review/`.

Only product change: `src/features/pdf-compare/PdfComparePage.tsx`. A UI generation ref guards late run/progress/error/finalization callbacks. Shared invalidation immediately clears results/busy selection and aborts export, revokes owned URLs and clears their timers. A new run uses that invalidation before starting. Export checks both controller/generation ownership and the current session result before publishing. Unmount aborts/revokes and advances generation. Explicit Cancel keeps the generation and therefore preserves the completed partial result.

Core7, shared APIs, dependencies, route registration and templates are unchanged. Exact JSX/style/child-component suffix equality to R3 was asserted; no17-image rebaseline or full visual replay. React refs hold transient ownership; visible state remains React state. No new global listener/runtime or eager import added.

**R3 Page SHA:** `844dbfd6f1df6510b38340b99c566de6fdf0a691cc5b3209e72b70208118cb81`.
**R4 Page SHA:** `97602d695a5a4d11808e393964aa951543bc4962a02cbb4e6fe6fcd8133fa71c`.
Exact patch: `Page-R3-to-R4.patch`; source/build/artifact freeze: `source-freeze-R4.json`.

## Scoped verification

- App tsc: `./node_modules/.bin/tsc -p tsconfig.app.json --incremental false`, exit0 (`app-tsc.log`).
- QA only: `VITE_LOCAL_QA=1 ./node_modules/.bin/vite build --outDir /tmp/worklazy-u8-ui-fix/qa-dist --emptyOutDir`, exit0 (`qa-build.log`). Existing eval/large-chunk warnings retained. No prebuild/generated-source changes or production/static claim.
- Existing test harness gains `PDF_COMPARE_UI_SCOPE=lifecycle`, optional dist/case selectors and helper `tests/helpers/pdf-compare-ui-lifecycle.mjs`. Ordinary17-image path is unchanged.
- Baseline old QA: lifecycle scope against `/tmp/worklazy-u8-ui-review/copy/dist` failed at stale Swap export (`baseline-02.log`, exit1). `PDF_COMPARE_UI_LIFECYCLE_CASE=rerun-state` failed at old result visibility (`baseline-rerun.log`, exit1). These are successful negative reproductions, not passes.
- New QA `verification-01`: swap, threshold, replacement, add, remove, mapping and new run each had **late download0 / report URL0 / anchor click0**. New normal XLSX reopened with current swapped names **changed-word.pdf / normal-ascii.pdf**; subsequent invalidation revoked its URL.
- That run exited1 at the first unmount probe: the harness released the report chunk immediately after a SPA link click while the old PDF screen was still present. It had not actually unmounted. The probe now waits for the PDF page to detach before releasing the response. Product code did not change for this correction.
- `PDF_COMPARE_UI_SCOPE=lifecycle PDF_COMPARE_UI_LIFECYCLE_CASE=unmount PDF_COMPARE_UI_DIST=/tmp/worklazy-u8-ui-fix/qa-dist PDF_COMPARE_UI_EVIDENCE=/tmp/worklazy-u8-ui-fix/verification-02 node tests/pdf-compare-ui-smoke.mjs`, exit0: actual unmount has **0 downloads/URLs/clicks**; delayed File.arrayBuffer rerun hides old results and download control; explicit cancel retains **5 complete / 1 canceled /194 unknown**, verified by real XLSX reopening. Seven unchanged successful cases from verification01 plus the corrected actual-unmount case are the8 valid cases; no failed-case expectation was weakened. Verification02's old fixed console label says “lifecycle8”; JSON correctly records1 selected export case. Final console wording now reports the selected count; assertions/product code were unchanged.
- Final `node --check` for both test files and `git diff --check` exit0. `python3 freeze.py` exit0 asserts core7/JSX equality and aggregates the8 actual successful records.

QA entry `assets/index-DNsEgOEW.js`, SHA `e3a2d03219a42a7fd5f21bf970c7d47276dc4053fdbd44b61c1c00f510068a47`.
QA route `assets/PdfComparePage-DS8hdpul.js`, SHA `75337407a3897de54d0318886ad138f7362359ed947ced9a576f02bb604ad546`.

## Handoff / limits

Additional staging allowlist: **Page.tsx, tests/pdf-compare-ui-smoke.mjs, tests/helpers/pdf-compare-ui-lifecycle.mjs** only. All `/tmp/worklazy-u8-ui-fix` evidence/backup/QA files are not product staging. Preserve existing U8 allowlists.

A setup cwd mistake briefly inserted the test branch in the review copy's UI test; that insertion was immediately reversed, verified exact original SHA `c432d5e0b3e7543a4e62c1858183c274c3f07843bae655e2be8f39334cfdb257`. Review product source/dist/probe/evidence were untouched. The attempted run also lacked a copied fixture helper (`baseline-reproduction.log`); subsequent old-build tests run from the implementation harness with a read-only explicit dist override.

Reuse: R3 visual17 by JSX/styles equality; accepted core/output engine/performance evidence by core7 hashes. No full unit/static/core/perf or production publish repeated. Independent reviewer should rerun the two original delay boundaries and current report/partial samples against this new QA identity. Final production integration remains Sol/root's later task.
