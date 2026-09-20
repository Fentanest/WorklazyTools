# Excel duplicate-key S1 implementation report

## Result

- Branch: `excel-dupkey-20260907`
- Worktree: `/tmp/worklazy-xd`
- Required base/parent: `597a92ff56ed9c3eb23755a58df2580b0269b8bd`
- Commit: `2c338cffea71c91531107dd5fce4273f04386c45` (`Implement grouped Excel duplicate reports`)
- Repository status after commit: clean
- Merge/push/deploy: not performed; S1 alone is not a deployment candidate

## Implemented S1 contract

- Duplicate-error records are emitted once per internal key. `leftRows`, `rightRows`, `leftValues`, and `rightValues` are required for duplicate records; missing sides are empty arrays and each side's row/value indices correspond.
- Duplicate scalar row/column fields are `null`; scalar values are empty strings. Opposite singleton rows are included in the group and excluded from ordinary comparison. A 1:1 key remains on the existing comparison path.
- `displayKey` uses the selected key columns in order, joined by ` | `, from the first left source row or the first right source row when the left is absent. It is never used as group identity and the internal normalized key is never parsed for display.
- `summary.duplicate` now counts duplicate-key groups. The previous duplicate golden changed from 4 records to 1 group.
- `groupRows` now appends without repeated array spreading. Group creation, duplicate scanning/value collection, report source-row processing, and long-value chunks have cancellation checkpoints.
- The Duplicates report keeps the existing nine sheets and thirteen columns. Row lists use `, ` and value lists use LF-separated `source-row: value` entries.
- Lists use a 16,000 UTF-16-code-unit budget, greedy source-row packing, independent left/right chunks, dedicated long-row pieces, and `r [i/n]` notation without splitting surrogate pairs or CRLF.
- `displayKey` is rejected only above 32,767 code units for a single line or above 16,000 when CR/LF is present, with code `DUPLICATE_KEY_TOO_LONG`; the key is not truncated or substituted.
- Parameters contains nine fixed duplicate-report fields plus one range field per group. A one-group report therefore contains the requested ten entries. Non-key/error modes record the nine fixed fields as `UNUSED`.
- Existing XLSX text safety, sparse data-row scanning, finite widths, and Row/Column `numFmt` backstops were not changed.
- S2 UI record consumption and S3 header detection were not implemented.

## User workbook reproduction

Read-only inputs:

- `2026년 설 선물 발송처_20260204_취합중.xlsx`: 19,605 bytes, SHA-256 `3152fb517e80370c5a3c8a80aadddf6f3066bb69bd421c2657ddabf3d296a4a9`
- `2026년 설 선물 발송처_20260204_취합_송창훈.xlsx`: 20,263 bytes, SHA-256 `faab6f10958de04faca2f2bc49dfd001bd8d7ac6b43e40065ea1ecf5677319cf`

| Header/key | S0 duplicate records/groups | S1 summary/groups | Duplicates data rows | Other S1 summary |
|---|---:|---:|---:|---|
| row 1 / B | 4 / 1 | 1 / 1 | 1 | matched 713, changed 37, added 48 |
| row 4 / A | 24 / 6 | 6 / 6 | 6 | matched 486, changed 134, added 31 |
| row 4 / B | 0 / 0 | 0 / 0 | 0 | matched 703, changed 37, added 48 |

All three reports reopened with nine sheets, thirteen Duplicates columns, and finite widths from 12 through 48. A synthetic 17,000-character source-row report also reopened. ElementTree parsed all 18 XML/rels parts in each of the four generated XLSX files.

Artifacts:

- `/tmp/worklazy-xd-s1/user-file-results.json`
- `/tmp/worklazy-xd-s1/user-h1-c2.xlsx`
- `/tmp/worklazy-xd-s1/user-h4-c1.xlsx`
- `/tmp/worklazy-xd-s1/user-h4-c2.xlsx`
- `/tmp/worklazy-xd-s1/synthetic-split.xlsx`
- `/tmp/worklazy-xd-s1/bundle-after.json`

## Verification

| Command/check | Result |
|---|---|
| `./node_modules/.bin/tsc -b --pretty false` | pass, zero diagnostics after fixing the initially detected union-narrowing diagnostic |
| `npm run test:unit` | pass, 371 top-level / 379 total tests |
| focused Excel/XLSX safety tests | pass, 64/64 including writer, sparse, Row/Column `numFmt`, grouped duplicates, and report integrity |
| `npm run build` | pass, 2,835 modules and 61 localized static pages |
| `npm run test:static` | pass, 104 startup documents |
| `npm run test:excel-compare` | pass; two direct and two ZIP-contained grouped reports, splitting, metadata, cancellation, mobile, integrity, and overlong-key pair isolation |
| `npm run test:excel-cleaner` | pass |
| `npm run test:qr-bulk` | pass; helper proxy fixed to strict port 4351 |
| `npm run test:browser` | pass; Excel, Word, PDF edit/split/conversion |
| `npm run css:orphans` | pass, zero orphan selector arms |
| `node tests/tool-registry-routes.mjs` | pass, 20 tools and no missing/unexpected/duplicate entries |
| `git diff --check` | pass |
| production preview | `127.0.0.1:4350 --strictPort`; stopped, no listener remains in 4350-4359 |

Bundle gzip measurements against the immutable S0 baseline:

| Metric | Current | Delta | Result |
|---|---:|---:|---|
| entry JS | 299,294 B | +6 B | pass |
| affected-route JS | 2,451,591 B | +10 B | pass |
| shared JS | 2,715,815 B | +1,307 B | pass |
| app JS | 5,466,700 B | +1,323 B | pass |
| CSS | 37,693 B | 0 B | pass |

No locale, SEO/static-page input, URL/canonical/hreflang/sitemap, ad path, dependency, backend/API, or server-runtime surface changed. The browser isolation test confirmed that the raw `DUPLICATE_KEY_TOO_LONG` code is hidden while a sibling pair still produces its report.
