# U8 final integration verification — Codx, 2026-09-13

Candidate: `/tmp/worklazy-u8-impl`, U7 base `1df3c2e50edeb010272d82f15f279c1355f9f8ab`, R4 page SHA `97602d695a5a4d11808e393964aa951543bc4962a02cbb4e6fe6fcd8133fa71c`. Final source freeze: `source-freeze-final.json`, 38 staged-candidate files, aggregate `bd3c73a0ffcd8038c244227d065bceed4ceeb3315ec54922facb5aeff99f39da`. Reports, prior evidence, generated dist trees and the `node_modules` symlink are excluded.

## New final-candidate execution

| Scope | Result | Evidence |
|---|---|---|
| Production `npm run build` | **PASS, exit 0**. Node 22.17.1; dependency patches, rhwp 77-file snapshot, image assets, QR fonts, tsc, production Vite and 77 localized static pages completed. Existing vm-browserify eval and large-chunk warnings retained. | `01-production-build.log`, `.exit`; production dist hashes in `source-freeze-final.json` |
| Full `npm run test:unit` | **PASS, exit 0: 543 tests passed, 0 failed/canceled/skipped** (525 top-level subtests). | `02-full-unit.log`, `.exit` |
| Production `npm run test:static` | **PASS, exit 0**: localized/hreflang/runtime/ads/robots/sitemap and 128 startup-recovery documents. | `03-production-static.log`, `.exit` |
| `TEST_BASE_URL=http://127.0.0.1:4393 npm run test:utilities` | **PASS, exit 0**: ko/en routes, registration, editors and utility/PDF page-range checks. 131 external HTTP(S) requests were observed and blocked before execution. | `04-utilities.log`, `.exit` |
| `RECOVERY_OUTPUT=... npm run test:recovery` | **PASS, exit 0: 159 cases**, including ko/en `pdf-compare` on desktop and Android. | `05-recovery.log`, `.exit`, `recovery/` |
| Current-environment PDF finish oracle | **PASS, exit 0**: Node22.17.1, Chrome153.0.8010.36, Poppler24.02.0, pdfjs6.2.108; preflight87/allowed56/excluded31, both-renderer SHA56, negative controls caught by both, decoded removal sentinels0. | `06-pdf-finish-oracle.log`, `.exit`, `pdf-finish-oracle.json` |
| `BUNDLE_ROUTES=pdf-compare npm run bundle:measure` | **PASS, exit 0** against schema3 baseline SHA `4caaa9c6…`; all five limits null, overrides `{}`, multiplier1. Gzip: entry322625, route12394, shared2230654, app6708916, CSS39395. Canonical deltas: 23348/12394/246517/865201/1708. | `07-bundle.log`, `.exit`, `bundle-measure.json`, `bundle-summary.json` |
| Production initial/run request graph | **PASS on corrected attempt 3**: initial route/entry/CSS/lazy page dependencies recorded; run adds exactly renderer entry1, renderer worker1 and compare worker1. Duplicate PDF supply0. | `08-request-graph-attempt3.log`, `.exit`, `request-graph.json` |
| U8 visual baseline owner generation and scoped comparison | Six selected captures completed on each run. Generation and comparison commands each exit1 **only at the global set assertion** because the seven pre-existing U6 document-redactor baselines remain missing; no U8 capture comparison failure was reported. Missing7 is preserved for the UI rebaseline backlog. | `09-visual-baseline-owner.log`, `.exit`; `10-visual-compare-owner.log`, `.exit`; six `tests/visual-baselines/pdf-compare-*.png` files |

The request-graph first two attempts are retained as failures. Page-level interception did not observe dedicated/renderer worker requests and the script asserted expected1 against observed0. This was a harness observation boundary: attempt3 moved interception to a fresh browser context and blocked Service Workers, after which the actual worker requests were captured. Product source and production dist were unchanged between attempts.

## Reused accepted evidence

- R4 UI lifetime repair and independent original-boundary probe: `/tmp/worklazy-u8-ui-fix/REPORT.md`, `/tmp/worklazy-u8-ui-review-r4/REPORT.md`. Stale download/URL/click0, old rerun results0, current-direction XLSX and partial workbook reopening are accepted on frozen R4.
- R3 17-screen visual corpus and Gemini inspection are reused because R4 asserts exact JSX/style/child equality; no broad visual replay was added.
- U8 core stage1/stage3 is reused for unchanged core7 hashes. The experimental strict cross-DPR assertion remains a recorded exit1 and is not called a whole-run PASS.
- Document-diff, Word scoped browser, HWP slice and existing PDF scoped browser are reused with byte-identical relevant sources/tests and unchanged relevant dependency integrity as documented in `REUSE-VERIFIED.md`.

## Scope and disposition

No Office/video/full browser/core/performance or 17-image suite was repeated. No user file was read; PDF inputs were the repository's synthetic oracle/UI fixtures. The final integration checks found no new product blocker. Commit, push and live deployment remain pending root's exact-allowlist approval and final documentation integration.
