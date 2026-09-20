# U6 final integration report

Final product source is `/tmp/worklazy-u6-impl` at base HEAD `fa0bef7e20e1a578fb37805b60d74e39c9a69b86`. Commit candidate inventory: 63 files, aggregate `3a2956b532f9a75847636e411099692062eef8d25c437ca39bc5915960b46fc8`; manifest SHA `9511b2d2bd8e0c4ad0daa0e602d7a30ccabc1574416f00b0add1c465df4640a2`. `node_modules` and `dist` are excluded.

## Gates

- Synthetic fixture generation: exit 0.
- Full unit: 527/527 pass, exit 0.
- Production build with `LOCAL_QA`/`VITE_LOCAL_QA` unset: exit 0, 73 localized pages.
- Full static: attempts 1/2 correctly failed because the common validator contradicted the P3 contract by requiring the removed AdSense/manifest markers. The final validator asserts those markers absent on redactor and present elsewhere; attempt 3 passed with 122 recovery documents.
- Registry: 21 exact tools, exit 0.
- New-tools smoke: first attempt had no 4173 server; attempt 2 passed after serving the final dist.
- Registered bundle graph: exit 0 using canonical baseline SHA `4caaa9c6…`, five null limits, overrides `{}`, multiplier 1. gzip totals: entry 318,324B; affected route 195,494B; shared 1,944,192B; app 6,143,527B; CSS 39,173B. Report `/tmp/worklazy-u6-final/u6-budget.json`.
- Recovery: 151/151 cases passed against `RECOVERY_DIST=dist` (this harness starts its own final-dist server and did not consume the mistaken 4350 server).
- C3 consumers: QR bulk and Excel compare smokes exited 0. PDF-only browser scope exited 0.
- Broad browser first run stopped at a Word generic error. Independent final-dist Word-only, observed, and prior-Excel→Word runs all passed with identical worker/Pyodide assets; it remains an unexplained transient, neither existing nor new defect, and is non-blocking by root decision. `/tmp/worklazy-u6-final-word-diagnostic/REPORT.md`.

## Final production path

The first logging-server copy accidentally served P3 `dist-first`; its privacy attempt3, `final-captures/`, a11y, and rendering runs are invalid and preserved as such. The corrected server was started with `REDACTOR_DIST=/tmp/worklazy-u6-impl/dist`. Served EN redactor HTML SHA `e0e59674…` matched the final dist; root independently matched entry JS `76e9cad5…` and CSS `049b7593…`.

Corrected privacy representatives `en-direct-small` and `ko-home-denied-small` both exited 0 on the final dist: post-input HTTP0, inflight0, normal CSP0/WS0/server0, one verified PNG each, and expected page/worker/SW observations. Earlier full P3 10-case/startup/BFCache/worker results were reused by source SHA; final AppShell/DocumentPage connection was rerun rather than repeating the matrix.

Final immutable visual corpus: `/tmp/worklazy-u6-final/final-captures2`, manifest SHA `2ac4081102a8ce651f87d78c69376734683e9322cb5f970bbf90f61cebfde683`, 60 PNG inventory SHA `c365baa80732b89d04472226328fca9b9e50bcb22cff802c73b591d065c51d15`. All ko/en × light/dark × desktop/mobile plus EN320 empty/selected/processing/cancel/result/damaged flows completed; overflow/external/page errors0, max CLS `0.0278023323`, U6 direct axe violations0. The only stable violation is the documented shared desktop LanguageSwitcher contrast. Gemini used `view_file` on 24/24 ko and 36/36 en final images with SHA unchanged and found no new blocker: `/tmp/worklazy-u6-final/gemini-final/ROOT-DECISION.md`. Viewport evidence preventing full-page fixed-element misclassification is `/tmp/worklazy-u6-final/final-viewports`.

## Reused evidence

P1 engine/golden/negative/legacy evidence remains valid for 23/25 files; P3 for 53/57; UI independent for all 6 repair files, with invalidation resolved by the final targeted runs. Root source transmission audit covers 470 source files, 167 exact matched paths and 130 generated-public entries. Links are embedded in `source-freeze.json`.

The final scope map did not silently omit the broad utilities, Office, or legacy suites. P3 changed the redactor entry, isolation/static integration, and shared shell connection; it did not change those engines or their callers. Their frozen P1/P2 and parent evidence was therefore reused by the file-SHA and direct-call boundaries recorded in `source-freeze.json`. The stale 4350 accessibility run is invalid. Its U6-relevant UI coverage was recovered by the corrected final-dist 60-state corpus, the independent UI review, and the shared-keyboard sample. Only the directly affected QR/Excel C3 consumers, PDF browser path, registry/static graph, and representative shared-shell routes were rerun.

## Remaining shared backlog

The EN320 global consent accept button clipping and one desktop translucent language switch contrast are parent-identical shared UI issues recorded in `docs/backlog.md`. U6 does not remove the banner or alter the global switch. Owned resource accounting does not claim total heap or physical-device memory bounds.

## Rendering harness environment correction

The first full rendering command used the production build with the harness's granted-consent setup. It exited 1 after recording 500 external provider attempts because that general-page harness does not abort providers; the raw failure is `logs/rendering.log`. It is neither a rendering PASS nor a U6 privacy failure. The supported local review condition was rebuilt separately with `VITE_LOCAL_QA=1` into `/tmp/worklazy-u6-final/dist-qa` (Vite and static generation exit 0). On that build, `RENDER_TARGET_IDS=home,document-compare,pdf-editor` ran the three directly relevant shared-shell representatives and exited 0 (`logs/rendering-qa.log`, `rendering-qa.json`). No threshold, target definition, product constant, allowlist, or final production dist was changed. The final production U6 60-state CLS/privacy/Gemini evidence remains the deployment evidence.
