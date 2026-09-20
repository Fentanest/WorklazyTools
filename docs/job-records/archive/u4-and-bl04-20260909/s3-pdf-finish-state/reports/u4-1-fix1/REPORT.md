# U4-1 fix-1 implementation report — Codx

## Scope and gate

- Branch: `s3-pdf-finish`
- Baseline HEAD: `fd37ceab057ced2941fb752b2511124dbeaafda4`
- Fix commit: `ba762b4` (`fix: enforce PDF finish policy invariants`)
- Main/origin-main: `5bc6854175331bdd73b267784d9633cdccda8446`
- Existing untracked user files preserved: `after.docx`, `before.docx`, `naver05161fb06bc9701a23cfc09ad5773578.html`
- No main merge, push, route/UI/locale/SEO/ad-path change, dependency addition, or generated/vendor direct edit.

## F1–F5 changes

- F1: removed `maximumTiles` from `TileLayoutInput`; the module-owned limit is the literal 400. A source type assertion fixes key absence. Unit probes show 400 placements/400 creations, and both ordinary 420 and an untyped `maximumTiles:1000` attempt are rejected before any placement is created.
- F2: `layoutTextLines` now checks `region.width < ellipsisWidth` immediately after validating the ellipsis width. At width 5pt, a long line, short `i` (2.664pt), and an empty line all return `narrow-region`; width 12pt still emits only `…` for overflow.
- F3: raw RGBA ledger input is a timeline whose entries each contain every simultaneously live canvas/bitmap resource. Each resource records per-copy pixels/bytes and live count. Per-time-point pixels/bytes/count are summed; `peakRawRgbaBytes` is the maximum point total. Golden timeline: 100px+200px = 1,200B/2 resources; one 100px resource copied twice = 800B/2; after release next point = 200B/1. Cumulative document pixels/raw bytes remain measurement-only and do not drive peak or blocking.
- F4: the helper is exactly one static re-export line. `test:pdf-finish-oracle` owns `node --experimental-strip-types`. Native execution proves helper/product export identity and oracle 56 allowed/31 excluded.
- F5: committed unit goldens now cover an actual generated four-page PDF.js mixed-visual-size fixture and 24 literal margin anchors, all 10 E6-2 preprocessing/coverage inputs, actual legacy-fixture PDF.js stamp conversion for 16 DPR/CSS-scale/rotation combinations with literal expected coordinates, actual UserUnit=2 viewport measurements for 12 rotation/DPI rows, raw ledger snapshots, and placement-generation counts.

## Verification

| Command | Result |
|---|---|
| `npx tsc -b --pretty false` | exit 0, diagnostics 0 |
| `npm run test:unit` | exit 0, 272/272; PDF finish 13/13 |
| `NODE_OPTIONS=--max-old-space-size=4096 npm run build` | exit 0, 2,834 modules, 61 static pages |
| `npm run test:static` | exit 0, 61 localized pages, startup recovery 104 |
| production preview + `TEST_SCOPE=pdf npm run test:browser` | exit 0, existing PDF edit/range split/conversion passed; fixed Excel/Word message not used as their execution evidence |
| `npm run test:pdf-finish-oracle` | exit 0 with native strip; 87 = 56 allowed + 31 excluded, transformed/deep-residual/SHA 56, excluded attempts 0 |
| `NODE_OPTIONS=--max-old-space-size=4096 BUNDLE_ROUTES=pdf-editor BUNDLE_BASELINE=/tmp/s3-bundle-baseline.json ... npm run bundle:measure` | exit 0; entry 299,287B, route 171,864B, shared 2,716,473B, app 5,466,587B, CSS 37,687B; all five deltas 0B |
| `npm run css:orphans` | exit 0, orphan selector arms 0 |
| `node tests/tool-registry-routes.mjs` | exit 0, expected 20, missing/unexpected/duplicates 0 |
| `git diff --check` | exit 0 |

## Astra defect script note

The exact command `node --experimental-strip-types /tmp/worklazy-u4-1-review/defects.mjs` still prints the four old defects and exits 0 because that script imports its own immutable audit copy at `/tmp/worklazy-u4-1-review/head`, not this repository working tree. The audit copy was not altered. A current-source equivalent probe exited 0 with:

```json
{"F1":{"ok":false,"count":420,"maximumTiles":400,"generated":0},"F2":["narrow-region","narrow-region","narrow-region"],"F3":{"ledger":[{"pixels":300,"bytes":1200,"resourceCount":2},{"pixels":200,"bytes":800,"resourceCount":2},{"pixels":50,"bytes":200,"resourceCount":1}],"peakRawRgbaBytes":1200,"peakRawResourceCount":2},"F4":{"sameExport":true}}
```

The original script's extra `maximumTiles` property is no longer part of the product type or read by runtime code; JavaScript structural extra properties are ignored and the fixed 400 cap applies.
