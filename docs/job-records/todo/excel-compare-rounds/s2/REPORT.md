# Excel duplicate-key S2 implementation report

## Scope and gate

- Worktree: `/tmp/worklazy-xd`
- Branch: `excel-dupkey-20260907`
- Starting HEAD: `c1e44f60096dfad33e6c225fdb96f5323516edf6`
- Final commit: `ebba5203d2984b9ddcb8b321beaf80f4b953f2a4`
- S0 bundle baseline SHA-256: `726a2d5be21ca250c76a5a9c9220affb8931da9286769f762f3531fd64d002c8`
- The ignored canonical plan was absent from the target worktree; the preserved S0 copy and all adopted round 1–3 amendments were read. The S1 review at the same HEAD had already verified all 19 open plans had no conflict.
- S3 header detection, main merge, push, and deployment were excluded.

## Implementation

- Duplicate records now render one result row per group using `displayKey`, never the internal normalized key.
- Left and right source rows/values are separate collapsed lists. A zero side is text-only. Opening creates only 50 item nodes per side and each side loads 50 more independently.
- Search indexes the complete display key, both complete value arrays, and all source row numbers regardless of collapsed DOM or the 500-result viewport.
- The outer 500-item limit counts one duplicate group as one item.
- Values longer than 160 code points have a wrapped preview and a Base UI modal with the lossless full value. Keyboard opening, accessible naming, Escape closing, and focus return are covered in Chrome smoke tests.
- Horizontal result/support tables are named focusable regions on mobile. Status filters have an explicit group role.
- Korean and English result strings, plural forms, zero states, guidance, guide/FAQ, tool description, SEO description/feature list, and static FAQ were updated together. The copy states that same-line left/right items are not automatic matches.

## Contract evidence

The 501-group browser fixture produced:

- 500 initial duplicate rows, `1` remaining, and zero list item DOM while collapsed.
- A closed group found by a value only in the last source row and by source row number.
- Independent left/right states of 50/0, 51/50, then 0/50.
- Zero-side text with no button, no nested buttons, and 44px minimum targets.
- No `string:`, `number:`, or raw duplicate reason/error code in rendered output.
- Nine report sheets and 13 Duplicate columns preserved in individual and ZIP-reopened downloads.

## User-file reproduction

Only copies under `/tmp/worklazy-userfiles/` were read. Full evidence is `evidence/user-browser.json`.

| Header/key | Duplicate groups/UI rows | matched | changed | added |
|---|---:|---:|---:|---:|
| row 1 / B | 1 / 1 | 713 | 37 | 48 |
| row 4 / A | 6 / 6 | 486 | 134 | 31 |
| row 4 / B | 0 / 0 | 703 | 37 | 48 |

The displayed keys exactly matched each record's `displayKey`; all lists were initially closed and internal text was absent.

## Visual and accessibility

Eight new baselines were added, all for the new actual duplicate-result state:

- `excel-compare-empty__interaction-duplicate-result__ko__light__desktop.png`
- `excel-compare-empty__interaction-duplicate-result__ko__light__mobile.png`
- `excel-compare-empty__interaction-duplicate-result__ko__dark__desktop.png`
- `excel-compare-empty__interaction-duplicate-result__ko__dark__mobile.png`
- `excel-compare-empty__interaction-duplicate-result__en__light__desktop.png`
- `excel-compare-empty__interaction-duplicate-result__en__light__mobile.png`
- `excel-compare-empty__interaction-duplicate-result__en__dark__desktop.png`
- `excel-compare-empty__interaction-duplicate-result__en__dark__mobile.png`

The targeted visual run updated 8/8 and a clean rerun matched 8/8. The first update attempt completed 7 profiles before a file-upload state race caused the last profile to produce no duplicate row; explicit waits for the first selection and second inspection made the scenario deterministic.

The final axe run covered 16 pages, including all eight result profiles: 0 violations and 0 external requests. `incomplete` findings are recorded rather than counted as passes. The existing support-table mobile scroll region found in the first run was made focusable and named; the status-filter ARIA review item was also removed. Browser-rendered contrast for the new result text was at least 5.273:1 in light mode and 5.733:1 in dark mode. Full evidence is `evidence/a11y.json`.

## URL and bundle invariants

- SEO path-key set: unchanged, 31.
- Sitemap URL set: unchanged, 61; canonical/hreflang/static validation passed.
- No route, registry, ad, isolation, network/API, server, or dependency change.

S0 baseline comparison (`evidence/bundle.json`):

| Metric | Current gzip bytes | Delta | Limit |
|---|---:|---:|---:|
| entry JS | 300,694 | +1,406 | +20,480 |
| affected-route JS | 2,453,004 | +1,423 | +61,440 |
| shared JS | 2,715,789 | +1,281 | +30,720 |
| application JS | 5,469,487 | +4,110 | +81,920 |
| CSS | 37,818 | +125 | +10,240 |

All five budgets passed.

## Final verification

| Check | Result |
|---|---|
| `./node_modules/.bin/tsc -b` | pass, 0 diagnostics |
| `npm run test:unit` | pass, 380/380 |
| production `npm run build` | pass, 2,835 modules and 61 static pages |
| `npm run test:static` | pass, startup recovery 104 documents |
| `npm run test:excel-compare` | pass, grouped UI/search/dialog/report/ZIP plus existing suite |
| `npm run test:excel-cleaner` | pass |
| `npm run test:qr-bulk` | pass |
| `npm run test:browser` | pass |
| targeted result-state visual regression | pass, 8/8 |
| QA accessibility audit | pass, 16 pages / 0 violations |
| bundle baseline comparison | pass, all five metrics |
| `npm run css:orphans` | pass, 0 orphan selector arms |
| `node tests/tool-registry-routes.mjs` | pass, 20 tools / 0 discrepancies |
| `git diff --check` | pass |

The preview server used `127.0.0.1:4350 --strictPort` and was stopped after browser verification.
