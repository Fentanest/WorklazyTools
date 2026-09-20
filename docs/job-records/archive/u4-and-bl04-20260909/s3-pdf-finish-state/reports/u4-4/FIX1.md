# U4-4 fix-1 implementation report

- Branch: `s3-pdf-finish`
- Required base: `5767f135443f113e655fbb0801a01e4d3c11de23`
- Fix commit: `15bad33cfb569ee032ba90c4fe42b75c1c48cf73`
- Scope: R1-R9 repair only; no main merge, push, deployment, or synchronization
- User-owned untracked files: `after.docx`, `before.docx`, `naver05161fb06bc9701a23cfc09ad5773578.html`, `newui/` preserved and unstaged

## R1-R9 result

| ID | Repair | Direct verification |
|---|---|---|
| R1 | Made the PDF content lexer advance on every branch; separated comments, nested/escaped literal strings, hex, names/delimiters, and `BI…ID…EI` raw data; joined multiple content streams for graphics-state balance. Uncertain syntax remains a consent warning instead of a blanket rejection. | Inline image containing `0x29`, stray `)`, strings/comments/hex, split `q/Q`, real upload, cancel, retry. |
| R2 | Added font-metric height/ascender/baseline offsets so Form BBoxes contain lowercase descenders and final multiline descenders without shrinking text. | 32 new lowercase/multiline/Noto × four rotations × single/tile renders in PDF.js and Poppler; prior 128 renders retained. |
| R3 | Calculated actual visible signed-offset tile intersections; rejected `empty-placement`; required at least one `Do`, a present referenced XObject, and a visible foreground clip/path. | Marker-only, deleted XObject, zero rectangle, empty path, and zero-placement negative controls. |
| R4 | Made internal finish tabs min-width safe with mobile vertical icon/label flow and wrapping. | 320px/390px bounding-box and non-overlap assertions plus visual baselines. |
| R5 | Restored F1 preview max-width 60%, pre-wrap, break-words, medium weight, 1.2 line height, and 90% opacity. | Actual two-line preview height assertion. |
| R6 | Replaced the fixed 3-column/18-item preview with the production placement function over the PDF.js source viewport and real image proportions. | Size change alters placement width/count; fixed count 18 is rejected. |
| R7 | Applied canonical opacity 0.01-1 step .01, size 1-100%, gap 0-2000pt, offset -2000..2000pt, retained the 400-tile cap, shared the six-region overflow contract, and yielded/check-aborted per tile. Support text now limits UserUnit claims to the PDF.js-style viewport coordinates. | Unit, browser, range, cancellation, visual, and locale checks. |
| R8 | Preserved axe incomplete rules/nodes/targets/reasons, assigned `f2-watermark` vs `shared-existing`, and failed on discarded ownership/reason data. | QA: violations 0, incomplete rules 15, incomplete nodes 925, F2 0, inherited 925, external requests 0. |
| R9 | Removed “stream/internal structure” from ko/en customer errors and replaced it with result/action guidance. | Locale and browser assertions; raw exception boundary retained. |

## Accessibility ownership

F2-owned incomplete target list: `[]`.

| Page | Shared inherited incomplete nodes |
|---|---:|
| home | 5 |
| document-compare | 43 |
| tools | 199 |
| excel-compare | 64 |
| pdf-editor | 47 |
| pdf-finish-ko | 47 |
| pdf-finish-mobile-ko | 31 |
| pdf-finish-en | 47 |
| pdf-watermark-ko | 47 |
| hwp-editor | 44 |
| home-mobile-ko | 171 |
| tools-mobile-ko | 180 |
| **Total** | **925** |

The shared debt is recorded in `docs/backlog.md` under “공용 UI 접근성 incomplete 정리” and assigned to `docs/jobs/todo/ui-theme-redesign-20260907.md`.

## Visual baseline changes

Official generator mode updated 28 PNGs after actual/diff inspection:

- 8 `pdf-finish-page-numbers__interaction__*`: support text and restored F1 wrapper/flow.
- 8 `pdf-finish-header-footer__interaction__*`: same shared F1/support changes.
- 8 `pdf-finish-watermark__interaction__*`: support text and responsive placement preview.
- 4 `pdf-finish-navigation__active__*mobile*`: mobile internal three-tab layout.
- The 8 start/end navigation captures did not change.

Filtered rerun matched 36/36; final full ko/en matrix matched 211/211.

## Bundle

Fixed baseline SHA-256: `2605437e04a5d77ed41c2dbfac4fae864a6a9c8b5e56941e696a80b7f76ac692`; overrides `{}`; multiplier 1.

| gzip metric | Delta | Limit | Remaining |
|---|---:|---:|---:|
| Entry JS | +7,128 B | +20,480 B | 13,352 B |
| PDF route JS | +20,415 B | +61,440 B | 41,025 B |
| Shared JS net, excluding attribution movement | +2,171 B | +30,720 B | 28,549 B |
| App JS | +30,494 B | +81,920 B | 51,426 B |
| CSS | +235 B | +10,240 B | 10,005 B |

The scoped five-gate comparison passed. The unscoped stock comparator first failed closed because `baseline.perRouteJsGzip.audio-studio` is absent; this failure is preserved in `bundle-full.log` and is not counted as a pass. Recounting the unchanged baseline's unique `files[].routeOwners/gzipBytes` reproduced its recorded PDF value 171,864 B and covered all 19 current routes with no missing route: 2,450,827 B baseline vs 1,962,228 B current, delta -488,599 B. See `bundle-full-comparison.json`.

## Final verification

| Check | Result |
|---|---|
| `npx tsc -b --pretty false` | pass, diagnostics 0 |
| `npm run test:unit` | pass 312/312, fail/skip 0 |
| production `npm run build`; `npm run test:static` | pass, 2,847 modules, 69 pages, 116 startup recovery documents |
| `npm run test:pdf-finish` | pass; 16 direct entries and inline/cancel/retry contracts |
| watermark golden | pass; 4 Contents fixtures, 128 existing + 32 descender renders |
| scoped PDF and full `test:browser` | pass |
| `test:new-tools`, `test:utilities`, `test:office` | pass |
| `test:qr-bulk`, `test:qr-font-render` | pass; font oracle changed pixels 0 and extracted text equal |
| `test:recovery` | pass, 147 cases |
| `fixtures:pdf-legacy-oracle` | pass; client/structure/render/output/input total diffs 0 |
| `test:excel-cleaner`, `test:excel-compare` | pass |
| full `test:visual` | pass 211/211, Chrome 152, threshold contract unchanged |
| local-QA build; `A11Y_MAX_TOTAL=0 test:a11y` | pass; violations 0, F2 incomplete 0, inherited 925 preserved |
| `test:rendering` | pass, 7 targets × 3, external 0, watermark max CLS 0.0001480366 |
| bundle scoped / all-route recount | pass / delta -488,599 B; no limit override |
| `css:orphans` | pass, zero-reference selector arms 0 |
| `legacy:manifest` | pass, 155 rules / 153 removed / 0 split / 2 active |
| `node tests/tool-registry-routes.mjs` | pass, 20 tools |
| `git diff --check` | pass |

All explicit Vite services used ports 4280-4287 with `--strictPort`. The legacy oracle's own ephemeral local harness is unchanged.

## Probe constraint and preserved failures

The five original review probes were not present in the allowed repository or dispatch directory. Their only referenced location was the explicitly forbidden `/tmp/worklazy-u4-4-review1`, and the browser probe was recorded as hard-coded to port 4270. Running them would have violated both “do not access review artifacts” and the required 4280-4289 port range; modifying them was also forbidden. No review probe or artifact was read or changed. Equivalent R1/R2/R3/R6 product paths were exercised through unit, real-browser upload, and PDF.js/Poppler golden tests.

Two intermediate new browser-test failures are preserved rather than erased: a stale `ready` locator was reused across a second upload, and a 200pt/10% six-region fixture correctly overflowed the canonical region. The harness now waits for the new file's enabled action and uses a valid 6pt fixture; no product range or overflow contract was weakened. The initial QA accessibility run exposed three F2 tab contrast incomplete nodes, which were fixed with an explicit card background before the final F2=0 run. The stock all-route bundle comparator failure is documented above.

All raw logs and JSON reports are in this directory.
