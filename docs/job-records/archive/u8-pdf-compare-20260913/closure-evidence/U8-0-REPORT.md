# U8-0 accuracy feasibility — Codx, 2026-09-13

**Automated feasibility passed; independent Gemini visual reading pending.** No U8 product implementation, ToUnicode production repair, commit, push or deployment. This report is stage 0 evidence only; it does not claim future U8 status/UI/report enforcement is implemented.

## Gate and frozen source
- Actual base `1df3c2e50edeb010272d82f15f279c1355f9f8ab` (U7 release). `git merge-base --is-ancestor d9c79b7a16f5b99fa7cddfde741b8d10f08f07d0 1df3c2e50edeb010272d82f15f279c1355f9f8ab` exit0. U7 Pages/live closure is root's prior evidence, not rerun here.
- Detached clean worktree `/tmp/worklazy-u8-preflight/source`, source `git status --short` empty. Relevant source files equal root release files; source/dependency/fixture/script sizes and SHA in `evidence/source-freeze.json`. Root status paths preserved in `evidence/root-status-paths.txt`; user maintenance/unknown files untouched and not content-read or hashed.
- `evidence/base-diff.patch` records actual original-to-U7 relevant diff: `pdfPreview` moved owned-load settle/abort helper to `src/utils/pdfOwnedDocument.ts`; render lifecycle, diffText, alignment unchanged. package lock added U7 DOCX dependencies and xmldom update; PDF.js6.2.108/pdf-lib1.17.1/fontkit1.1.1 unchanged. No alternate PDF runtime installed.
- Current PROJECT_RULES, AGENTS, complete U8 directive, PLAN-INDEX and relevant review-notes1187 read. Original wrong index/helper path reads exited2 and were corrected to `docs/jobs/todo/PLAN-INDEX-20260909.md` / `src/features/pdf-editor/*`; no absent source inferred. Root user authorization supersedes historical implementation prohibition but **this delegation permits U8-0 only**. U9, UI rebaseline/v3, bundle B1/B2 and PDF filename truncation remain separate; root reports no other product writer. U7 archive closure and PDF filename request read-only investigation do not intersect this experiment.

## Inputs, oracle and results
Eight fixed synthetic PDFs / ten pages. `fixtures/manifest.json` fixes independent source strings and extraction expectations. Original historical `pdf-extraction.pdf` is copied unchanged, not regenerated or repaired; its original extraction observations are preserved. New normal fixtures explicitly author known-source per-character glyph codes and ToUnicode in temporary fixture construction. This establishes valid normal extraction controls, **not a fix or support guarantee for the PDF producer**; it does not alter the historical PDF, vendor font, product helper or dependencies.

| Scope | New execution result |
|---|---|
| Normal ASCII/Korean/digits plus controlled changes | 7/7 pages exact source-string extraction |
| Historical source-string accuracy | **0/3 exact**, unchanged known extraction mismatches |
| Historical observed extraction goldens | 3/3 exact matches to original recorded incorrect strings |
| PDF.js identical-input paired rendering | 10/10 pages zero RGB difference at thresholds0/16/32; all RGBA alpha255 |
| Poppler identical-input rerender | 10/10 pages zero RGB difference at thresholds0/16/32 |
| Word / number / Korean / color changes | 4/4 detected independently by PDF.js and Poppler: 8/8 threshold16 nonzero |
| Existing diffText | 3 historical extracted-self pairs have equal spans; 금액100→200 retains deleted100원 / added200원 |
| Negative controls | Wrong historical source-text golden, dropped page observation, false zero for changed digits, removed number-deletion span, prohibited identical acceptance example each rejected (5) |

PDF.js rendering uses current **browser build**6.2.108, Chromium153.0.8010.12, Node22.17.1, Playwright1.63.0; 96dpi, DPR1, independent owned loading tasks, source viewport, opaque white fill/render background, annotation ENABLE, default optional content. It mirrors current `openOwnedPdfDocument` getDocument options including offscreen/image-decoder false; it does **not** claim helper integration or cancellation testing. All fixtures are 600×300pt (800×400px); giant-page/crop/rotation/scale/abort tests belong to later canonical stages.

Raw TextItems are serialized **only in test evidence**, and strings use raw order `str + (hasEOL ? LF : '')`; no normalization or heuristic replacement. `extractionExact` occurs only in known-original test observations. `contract-checks.json` distinguishes genuine existing diffText calls from future product acceptance examples. The example unknown-status rejection is a contract sentinel, not proof against an implemented product mutation. Historical equal extracted strings and pixel0 must retain “추출된 텍스트에서 차이 없음 / No difference in extracted text”, independent pixel result, and permanent limitations; they must never be promoted to semantic/legal document identity. No-text must be unavailable; enforcing these in actual U8 code/UI is U8-1/2 work.

Independent Poppler24.02.0 `pdftotext` is additional observation, not original-text oracle: historical Korean spacing changes and third-page digits disappear from extracted text. Poppler reports existing FontFile2/OTTO type mismatch warnings on these embedded OTF fixtures. Original producer-side root cause has **not** been independently established here. Poppler visual pixels and PDF.js visual pixels differ from antialiasing/raster behavior; ten cross-renderer metrics are informational and never required to be zero. Both renderers' own identical-input results are zero.

## Commands and evidence
All generated evidence lives under `/tmp/worklazy-u8-preflight`; no external network or user documents used. Local browser server serves only synthetic fixtures and installed current PDF.js modules. No product route, ads or analytics loaded.

| Command | Exit / evidence |
|---|---|
| `node /tmp/worklazy-u8-preflight/generate.mjs` | 0; `evidence-generate.log`, fixtures/ |
| `node /tmp/worklazy-u8-preflight/probe.mjs` | 0; `evidence-probe-01.log`, browser.json/raw TextItems/10 PNGs, Poppler PNG/text/per-command exit logs |
| `python /tmp/worklazy-u8-preflight/compare.py` | **127** missing alias; preserved `evidence-compare-01.log` |
| `python3 /tmp/worklazy-u8-preflight/compare.py` | 0; `evidence-compare-02.log`, pixel-comparison.json, repeated Poppler command logs |
| `node /tmp/worklazy-u8-preflight/contract.mjs` | 0; `evidence-contract-01.log`, contract-checks.json, frozen-source bundled diffText |
| `python3 /tmp/worklazy-u8-preflight/freeze.py` | 0; `evidence-freeze-01.log`, source-freeze.json, visual-review-12.json |

`evidence/visual-review-12.json` is the exact ordered 12-PNG delegation (historical3, normalASCII/Korean/number3 × two renderers), with source string, observed extraction, byte size and SHA. Actual visual reading is pending root/Gemini; screenshot generation alone does not close that gate.

**Reuse:** historical script/JSON/PDF are fixed input provenance, not a reused current accuracy verdict. U7 closure and known QR-render limitation record are prior scoped evidence. All ten current extraction/self-render observations are new.

**Not applicable at stage0:** product build, full unit/static/bundle, Word/HWP regression, UI/SEO/ad flows, route memory/cancel smoke. No product changes. **Deferred to canonical U8-1/2/3:** iterator/owned-cancel integration, unavailable status enforcement, mapping/report/UI and comprehensive mutation/scale/unknown gates. Stage0 only needs the current fixed accuracy/visual feasibility acceptance; no new design decision proposed.

**Disposition:** known historical extraction defect remains existing, not repaired and not listed as accurate extraction support. Automated evidence supports proceeding with separate visual and limited extracted-text comparison once independent visual reading is accepted. No new automatic blocking defect observed; visual gate remains unconfirmed here. Root owns final stage0 acceptance and authorization of the next product stage.
